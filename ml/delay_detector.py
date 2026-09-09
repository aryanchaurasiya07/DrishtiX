"""
F5 -- Delay Detector using Survival Analysis (Kaplan-Meier Estimator)

Replaces the naive "completed works only" baseline with the Kaplan-Meier
estimator from `lifelines` to correct for right-censoring bias.

Process:
  1. For every work across the full dataset:
     - Event = 1, Duration = (actual_completion - sanction_date) for completed works
     - Event = 0, Duration = (today - sanction_date) for ongoing works (censored)
  2. Fit KaplanMeierFitter per work_type, extract .median_survival_time_
  3. Update `category_baselines.median_duration_days` in Supabase
  4. Compare each ongoing work against (MULTIPLIER * km_median)
  5. Compute delay_score = min(1.0, days_ongoing / (MULTIPLIER * km_median))
  6. Write flags to `flags` table with source = 'delay_model'
"""

import os
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from lifelines import KaplanMeierFitter
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
from backend.database import engine

DEFAULT_MULTIPLIER = float(os.getenv("DELAY_MULTIPLIER", "1.75"))


def fit_kaplan_meier_baselines(df: pd.DataFrame, today: pd.Timestamp) -> pd.DataFrame:
    """
    Fits Kaplan-Meier survival curve per category.
    Returns DataFrame with category, km_median_days, naive_median_days.
    """
    df["event"] = np.where(df["actual_completion"].notna(), 1, 0)
    df["duration"] = np.where(
        df["event"] == 1,
        (df["actual_completion"] - df["sanction_date"]).dt.days,
        (today - df["sanction_date"]).dt.days
    ).clip(min=1)

    baselines = []
    for cat, grp in df.groupby("category"):
        completed = grp.loc[grp["event"] == 1, "duration"]
        naive_median = float(completed.median()) if len(completed) > 0 else np.nan

        kmf = KaplanMeierFitter()
        kmf.fit(grp["duration"], event_observed=grp["event"])
        km_median = float(kmf.median_survival_time_)

        if np.isinf(km_median) or np.isnan(km_median):
            km_median = naive_median if not np.isnan(naive_median) else 365.0

        baselines.append({
            "category": cat,
            "total_works": len(grp),
            "naive_median_days": naive_median,
            "km_median_days": km_median,
        })

    return pd.DataFrame(baselines)


def run_delay_detector(engine=engine, multiplier: float = DEFAULT_MULTIPLIER) -> dict:
    """
    Runs survival-corrected delay detector.
    Returns {work_id: delay_score} where delay_score is normalized in [0.0, 1.0].
    """
    print("=" * 70)
    print(f"RUNNING F5: DELAY DETECTOR (Survival Analysis, Multiplier={multiplier}x)")
    print("=" * 70)

    # 1. Load all works with sanction dates
    print("Loading works from Supabase...")
    with engine.connect() as conn:
        df = pd.read_sql(text("""
            SELECT id AS work_id,
                   category,
                   state,
                   district,
                   sanction_date,
                   actual_completion,
                   status,
                   source_term
            FROM works
            WHERE sanction_date IS NOT NULL
        """), conn)

    if df.empty:
        print("WARNING: No works with sanction_date found.")
        return {}

    today = pd.Timestamp(date.today())
    df["sanction_date"] = pd.to_datetime(df["sanction_date"], errors="coerce")
    df["actual_completion"] = pd.to_datetime(df["actual_completion"], errors="coerce")

    # 2. Fit Kaplan-Meier baselines per category
    print(f"Fitting Kaplan-Meier survival curves on {len(df):,d} works...")
    base_df = fit_kaplan_meier_baselines(df, today)
    km_map = dict(zip(base_df["category"], base_df["km_median_days"]))

    # Update category_baselines in Supabase
    print("Updating category_baselines table in Supabase with KM median durations...")
    with engine.begin() as conn:
        for _, r in base_df.iterrows():
            conn.execute(text("""
                INSERT INTO category_baselines (category, median_duration_days)
                VALUES (:cat, :km_days)
                ON CONFLICT (category) DO UPDATE
                SET median_duration_days = EXCLUDED.median_duration_days;
            """), {"cat": r["category"], "km_days": int(r["km_median_days"])})

    # 3. Evaluate ongoing and partially completed works
    ongoing_mask = df["status"].isin(["ongoing", "partially_completed"])
    ongoing_df = df[ongoing_mask].copy()
    print(f"Evaluating {len(ongoing_df):,d} ongoing / partially completed works...")

    overall_km_median = float(np.median(list(km_map.values())))
    ongoing_df["km_median"] = ongoing_df["category"].map(km_map).fillna(overall_km_median)
    ongoing_df["days_ongoing"] = (today - ongoing_df["sanction_date"]).dt.days.clip(lower=0)

    # Threshold and delay score
    threshold_days = multiplier * ongoing_df["km_median"]
    ongoing_df["flagged"] = ongoing_df["days_ongoing"] > threshold_days
    ongoing_df["delay_score"] = (ongoing_df["days_ongoing"] / threshold_days).clip(0.0, 1.0)

    n_flagged = ongoing_df["flagged"].sum()
    pct_flagged = n_flagged / len(ongoing_df) * 100
    print(f"Stalled / Delayed Works Flagged (Age > {multiplier}x KM median): {n_flagged:,d} ({pct_flagged:.2f}%)")

    # Breakdown by term
    for term, grp in ongoing_df.groupby("source_term"):
        t_flagged = grp["flagged"].sum()
        print(f"  {term:<12}: {t_flagged:>5,d} flagged out of {len(grp):>6,d} ({t_flagged/len(grp)*100:.1f}%)")

    # 4. Write flags to Supabase flags table
    print("Writing delay flags to Supabase...")
    flags = []
    now = pd.Timestamp.now()
    for _, r in ongoing_df[ongoing_df["flagged"]].iterrows():
        flags.append({
            "work_id": int(r["work_id"]),
            "source": "delay_model",
            "reason_text": (
                f"Work ongoing for {int(r['days_ongoing'])} days, exceeding {multiplier}x "
                f"the Kaplan-Meier survival median ({int(r['km_median'])} days) for {r['category']}."
            ),
            "created_at": now
        })

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM flags WHERE source = 'delay_model';"))

    flags_df = pd.DataFrame(flags)
    if not flags_df.empty:
        flags_df.to_sql("flags", engine, if_exists="append", index=False, method="multi", chunksize=2000)
    print(f"Inserted {len(flags_df):,d} delay flags into Supabase flags table.")

    # 5. Return full dictionary of delay scores
    delay_scores = {int(wid): 0.0 for wid in df["work_id"]}
    for wid, score in zip(ongoing_df["work_id"], ongoing_df["delay_score"]):
        delay_scores[int(wid)] = float(score)

    return delay_scores


if __name__ == "__main__":
    run_delay_detector()
