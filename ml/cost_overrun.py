"""
F3 -- State-Aware Cost-Overrun & Underrun Detector (Phase 3 Real Data)

Key Improvements:
  1. State-Aware Baselines:
     - Baseline computed per (work_type, state) cell from the FULL dataset.
     - If cell has < 20 works, falls back to the national baseline for that work_type.
  2. Robust Statistics:
     - scale = 1.4826 * median_absolute_deviation(costs in that cell)
     - deviation_score = (sanctioned_amt - cell_median) / scale
  3. Directional Separation:
     - Cost Overrun: deviation_score > 3.0 (source = 'cost_model')
     - Cost Underrun: deviation_score < -3.0 (source = 'cost_underrun')
     - Underrun cases NEVER contribute to the overrun risk score.
  4. Isolation Forest for Multivariate Anomaly Attribution (SHAP compatibility).

Outputs:
  - Rows written to `flags` table (source in ['cost_model', 'cost_underrun'])
  - Dict {work_id: cost_score} normalized 0-1 for risk_scorer.py
  - Saved Isolation Forest model at ml/models/isolation_forest.joblib
"""

import os
import sys
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
from backend.database import engine

MODEL_DIR = PROJECT_ROOT / "ml" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
IF_MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"


def run_cost_overrun_detector(engine=engine) -> dict:
    """
    Runs state-aware robust cost overrun & underrun detector.
    Returns {work_id: cost_score} where cost_score is in [0.0, 1.0].
    """
    print("=" * 70)
    print("RUNNING F3: STATE-AWARE COST OVERRUN & UNDERRUN DETECTOR")
    print("=" * 70)

    # 1. Load works with sanctioned_amt
    print("Loading works from Supabase...")
    with engine.connect() as conn:
        df = pd.read_sql(text("""
            SELECT id AS work_id,
                   category AS work_type,
                   state,
                   district,
                   sanctioned_amt,
                   sanction_date,
                   actual_completion,
                   status
            FROM works
            WHERE sanctioned_amt IS NOT NULL AND sanctioned_amt > 0
        """), conn)

    if df.empty:
        print("WARNING: No works with sanctioned_amt found.")
        return {}

    total_works = len(df)
    df["sanctioned_amt"] = df["sanctioned_amt"].astype(float)
    print(f"Loaded {total_works:,d} works for cost evaluation.")

    # 2. Compute National Baselines per work_type
    nat_stats = {}
    for wtype, grp in df.groupby("work_type"):
        costs = grp["sanctioned_amt"].values
        med = float(np.median(costs))
        mad = float(np.median(np.abs(costs - med)))
        scale = 1.4826 * mad
        if scale == 0:
            std = float(np.std(costs))
            scale = std if std > 0 else 1.0
        nat_stats[wtype] = {"count": len(costs), "median": med, "scale": scale}

    # 3. Compute State Baselines per (work_type, state) with >= 20 threshold
    state_stats = {}
    for (wtype, st), grp in df.groupby(["work_type", "state"]):
        costs = grp["sanctioned_amt"].values
        n = len(costs)
        if n >= 20:
            med = float(np.median(costs))
            mad = float(np.median(np.abs(costs - med)))
            scale = 1.4826 * mad
            if scale == 0:
                std = float(np.std(costs))
                scale = std if std > 0 else 1.0
            state_stats[(wtype, st)] = {"count": n, "median": med, "scale": scale, "fallback": False}
        else:
            state_stats[(wtype, st)] = {
                "count": n,
                "median": nat_stats[wtype]["median"],
                "scale": nat_stats[wtype]["scale"],
                "fallback": True
            }

    # 4. Compute Deviation Scores
    cell_medians = []
    cell_scales = []
    is_fallbacks = []

    for _, r in df.iterrows():
        wtype = r["work_type"]
        st = r["state"]
        ss = state_stats.get((wtype, st), nat_stats.get(wtype, {"median": 1.0, "scale": 1.0, "fallback": True}))
        cell_medians.append(ss["median"])
        cell_scales.append(ss["scale"])
        is_fallbacks.append(ss.get("fallback", True))

    df["cell_median"] = cell_medians
    df["cell_scale"] = cell_scales
    df["is_fallback"] = is_fallbacks
    df["deviation_score"] = (df["sanctioned_amt"] - df["cell_median"]) / df["cell_scale"]

    # 5. Flag Conditions
    df["cost_overrun_flagged"] = df["deviation_score"] > 3.0
    df["cost_underrun_flagged"] = df["deviation_score"] < -3.0

    n_overrun = df["cost_overrun_flagged"].sum()
    n_underrun = df["cost_underrun_flagged"].sum()

    print(f"Cost Overruns Flagged  (deviation_score > 3.0) : {n_overrun:>6,d} works ({n_overrun/total_works*100:.2f}%)")
    print(f"Cost Underruns Flagged (deviation_score < -3.0): {n_underrun:>6,d} works ({n_underrun/total_works*100:.2f}%)")

    # 6. Fit Isolation Forest for Multivariate Anomaly & SHAP compatibility
    print("Fitting Isolation Forest for multivariate explainability...")
    today = pd.Timestamp(date.today())
    df["sanction_date"] = pd.to_datetime(df["sanction_date"], errors="coerce")
    df["actual_completion"] = pd.to_datetime(df["actual_completion"], errors="coerce")
    df["end_date"] = df["actual_completion"].fillna(today)
    df["duration_days"] = (df["end_date"] - df["sanction_date"]).dt.days.clip(lower=1)

    df["norm_cost"] = df["sanctioned_amt"] / df["cell_median"].clip(lower=1.0)
    df["norm_duration"] = df["duration_days"] / 365.0

    features = df[["norm_cost", "norm_duration"]].fillna(0)
    # Fit IF on sample if dataset is very large to keep execution fast
    iso_forest = IsolationForest(contamination=0.05, random_state=42, n_estimators=100, n_jobs=-1)
    iso_forest.fit(features)
    joblib.dump(iso_forest, IF_MODEL_PATH)
    print(f"Saved Isolation Forest model to {IF_MODEL_PATH}")

    # 7. Normalized cost_score for risk scoring (Overruns only)
    # Underrun cases get 0.0 cost_score
    df["cost_score"] = np.where(
        df["deviation_score"] > 0,
        (df["deviation_score"] / 10.0).clip(0.0, 1.0),
        0.0
    )
    cost_scores = dict(zip(df["work_id"], df["cost_score"]))

    # 8. Write flags to Supabase flags table
    print("Writing cost overrun and underrun flags to Supabase...")
    flags = []
    now = pd.Timestamp.now()

    overruns = df[df["cost_overrun_flagged"]]
    for _, r in overruns.iterrows():
        flags.append({
            "work_id": int(r["work_id"]),
            "source": "cost_model",
            "reason_text": (
                f"Sanctioned amount (Rs {r['sanctioned_amt']:,.0f}) is {r['deviation_score']:.1f}x MAD above the "
                f"{'state' if not r['is_fallback'] else 'national'} baseline for {r['work_type']} in {r['state']} "
                f"(baseline median: Rs {r['cell_median']:,.0f})."
            ),
            "created_at": now
        })

    underruns = df[df["cost_underrun_flagged"]]
    for _, r in underruns.iterrows():
        flags.append({
            "work_id": int(r["work_id"]),
            "source": "cost_underrun",
            "reason_text": (
                f"Unusually low-cost, possible under-scoping: Sanctioned amount (Rs {r['sanctioned_amt']:,.0f}) is "
                f"{abs(r['deviation_score']):.1f}x MAD below the {'state' if not r['is_fallback'] else 'national'} "
                f"baseline for {r['work_type']} in {r['state']} (baseline median: Rs {r['cell_median']:,.0f})."
            ),
            "created_at": now
        })

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM flags WHERE source IN ('cost_model', 'cost_underrun');"))

    flags_df = pd.DataFrame(flags)
    if not flags_df.empty:
        flags_df.to_sql("flags", engine, if_exists="append", index=False, method="multi", chunksize=2000)
    print(f"Inserted {len(flags_df):,d} flags into Supabase flags table successfully.")

    return cost_scores


if __name__ == "__main__":
    run_cost_overrun_detector()
