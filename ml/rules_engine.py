"""
F6 -- Rules Engine (Phase 3 Real Data)

Hard-coded statutory MPLADS norms, independent of the ML detectors.
Rules:
  1. Per-MP annual fund cap: total sanctioned > Rs 5 crore/year
  2. Category cost ceiling: sanctioned_amt > 95th percentile for that category
  3. Maximum timeline: days_ongoing > 2x KM median duration days (hard fallback)

Outputs:
  - Rows written to `flags` table (source = 'rule')
  - Returns list of unique work_ids triggering at least one rule (forces min Amber)
"""

import os
import sys
from datetime import date
from pathlib import Path
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
from backend.database import engine

ANNUAL_CAP = 50_000_000  # Rs 5 crore
TIMELINE_MULTIPLIER = 2.0  # hard fallback: 2x KM median duration


def run_rules_engine(engine=engine) -> list:
    """
    Runs statutory rules against the works table.
    Returns list of work_ids that triggered at least one rule.
    """
    print("=" * 70)
    print("RUNNING F6: STATUTORY RULES ENGINE")
    print("=" * 70)

    with engine.connect() as conn:
        works_df = pd.read_sql(text("""
            SELECT w.id AS work_id,
                   w.mp_id,
                   w.category,
                   w.sanctioned_amt,
                   w.sanction_date,
                   w.status,
                   cb.median_duration_days
            FROM works w
            LEFT JOIN category_baselines cb ON w.category = cb.category
            WHERE w.sanctioned_amt IS NOT NULL
        """), conn)

    total_works = len(works_df)
    print(f"Loaded {total_works:,d} works for rules evaluation.")

    works_df["sanctioned_amt"] = works_df["sanctioned_amt"].astype(float)
    works_df["sanction_date"] = pd.to_datetime(works_df["sanction_date"], errors="coerce")
    works_df["sanction_year"] = works_df["sanction_date"].dt.year
    today = date.today()

    all_flags = []
    rule_triggered_works = set()

    # ── Rule 1: Per-MP annual cap ─────────────────────────────────────────
    mp_year_totals = works_df.dropna(subset=["mp_id", "sanction_year"]).groupby(
        ["mp_id", "sanction_year"]
    )["sanctioned_amt"].sum().reset_index()

    breaching_mp_years = mp_year_totals[mp_year_totals["sanctioned_amt"] > ANNUAL_CAP]
    breaching_pairs = set(zip(breaching_mp_years["mp_id"].astype(int), breaching_mp_years["sanction_year"].astype(int)))

    rule1_count = 0
    for _, row in works_df.dropna(subset=["mp_id", "sanction_year"]).iterrows():
        mid = int(row["mp_id"])
        yr = int(row["sanction_year"])
        if (mid, yr) in breaching_pairs:
            wid = int(row["work_id"])
            all_flags.append({
                "work_id": wid,
                "source": "rule",
                "reason_text": f"Sanctioned under MP #{mid} in {yr}, when total recommendations breached the statutory Rs 5 crore annual cap."
            })
            # FIX: Record the informational flag, but do NOT force Amber band promotion
            # rule_triggered_works.add(wid)
            rule1_count += 1

    print(f"  Rule 1 (Rs 5 Cr/Year MP Cap): {rule1_count:,d} flags ({rule1_count/total_works*100:.2f}%)")

    # ── Rule 2: Category cost ceiling (95th percentile) ───────────────────
    p95_map = works_df.groupby("category")["sanctioned_amt"].quantile(0.95).to_dict()
    rule2_count = 0
    for _, row in works_df.iterrows():
        cat = row["category"]
        amt = row["sanctioned_amt"]
        p95 = p95_map.get(cat)
        if p95 and amt > p95:
            wid = int(row["work_id"])
            all_flags.append({
                "work_id": wid,
                "source": "rule",
                "reason_text": f"Sanctioned amount (Rs {amt:,.0f}) exceeds the 95th percentile cost ceiling (Rs {p95:,.0f}) for {cat}."
            })
            rule_triggered_works.add(wid)
            rule2_count += 1

    print(f"  Rule 2 (95th-Percentile Cost Ceiling): {rule2_count:,d} flags ({rule2_count/total_works*100:.2f}%)")

    # ── Rule 3: Maximum timeline fallback (> 2x KM median) ────────────────
    ongoing_mask = works_df["status"].isin(["ongoing", "partially_completed"]) & works_df["sanction_date"].notna()
    ongoing = works_df[ongoing_mask].copy()
    ongoing["days_ongoing"] = (pd.Timestamp(today) - ongoing["sanction_date"]).dt.days
    ongoing["median_duration_days"] = ongoing["median_duration_days"].fillna(365.0).astype(float)

    rule3_count = 0
    for _, row in ongoing.iterrows():
        max_days = int(TIMELINE_MULTIPLIER * row["median_duration_days"])
        if row["days_ongoing"] > max_days:
            wid = int(row["work_id"])
            all_flags.append({
                "work_id": wid,
                "source": "rule",
                "reason_text": f"Ongoing for {int(row['days_ongoing'])} days, exceeding hard statutory maximum of {max_days} days (2x baseline)."
            })
            rule_triggered_works.add(wid)
            rule3_count += 1

    print(f"  Rule 3 (Hard Timeline Fallback > 2x KM Median): {rule3_count:,d} flags ({rule3_count/total_works*100:.2f}%)")
    print(f"  Total Unique Works Triggering Any Rule: {len(rule_triggered_works):,d} ({len(rule_triggered_works)/total_works*100:.2f}%)")

    # ── Write to DB ───────────────────────────────────────────────────────
    print("Writing rule flags to Supabase...")
    now = pd.Timestamp.now()
    for f in all_flags:
        f["created_at"] = now

    with engine.begin() as conn:
        conn.execute(text("DELETE FROM flags WHERE source = 'rule'"))

    flags_df = pd.DataFrame(all_flags)
    if not flags_df.empty:
        flags_df.to_sql("flags", engine, if_exists="append", index=False, method="multi", chunksize=2000)

    print(f"Inserted {len(flags_df):,d} rule flags into Supabase flags table.")
    return list(rule_triggered_works)


if __name__ == "__main__":
    run_rules_engine()
