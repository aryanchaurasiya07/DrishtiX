"""
F2 — Category Baselines (Phase 2)

Computes per-category statistics from the `works` table and upserts them into
`category_baselines`.  Safe to re-run: uses INSERT … ON CONFLICT … DO UPDATE.

Reads DATABASE_URL from .env or .env.txt in the project root.

Usage:
    python -m ml.baselines          # from the repo root
    python ml/baselines.py          # also works
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# 1.  Load DATABASE_URL
# ---------------------------------------------------------------------------

def _load_env() -> str:
    """Return DATABASE_URL, trying .env then .env.txt in the project root."""
    project_root = Path(__file__).resolve().parent.parent

    for name in (".env", ".env.txt"):
        candidate = project_root / name
        if candidate.exists():
            load_dotenv(candidate, override=True)
            break

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not found in environment or .env / .env.txt")
    return db_url


# ---------------------------------------------------------------------------
# 2.  Compute baselines
# ---------------------------------------------------------------------------

def compute_baselines(engine) -> pd.DataFrame:
    """
    Read the `works` table, group by `category`, and compute:
      - median_cost        — median of sanctioned_amt
      - std_cost           — std-dev of sanctioned_amt  (floor = 1.0 to avoid /0)
      - median_duration_days — median days between sanction_date and
                               actual_completion (completed works only)

    Returns a DataFrame indexed by `category`.
    """

    # Pull only the columns we need
    query = text("""
        SELECT category,
               sanctioned_amt,
               sanction_date,
               actual_completion,
               status
        FROM works
        WHERE category IS NOT NULL
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn)

    if df.empty:
        sys.exit("ERROR: works table is empty — nothing to compute baselines from.")

    # ── Cost baselines (all works with a valid sanctioned_amt) ─────────────
    cost_df = df.dropna(subset=["sanctioned_amt"]).copy()
    cost_df["sanctioned_amt"] = cost_df["sanctioned_amt"].astype(float)

    cost_stats = cost_df.groupby("category")["sanctioned_amt"].agg(
        median_cost="median",
        std_cost="std",
    ).reset_index()

    # Floor std_cost to 1.0 so single-work categories don't cause division
    # by zero in the cost-overrun detector  (Risk R6 mitigation)
    cost_stats["std_cost"] = cost_stats["std_cost"].fillna(1.0).clip(lower=1.0)

    # ── Duration baselines (completed works only) ──────────────────────────
    completed = df[
        (df["status"].str.lower() == "completed")
        & df["sanction_date"].notna()
        & df["actual_completion"].notna()
    ].copy()

    completed["sanction_date"] = pd.to_datetime(completed["sanction_date"], errors="coerce")
    completed["actual_completion"] = pd.to_datetime(completed["actual_completion"], errors="coerce")
    completed = completed.dropna(subset=["sanction_date", "actual_completion"])

    completed["duration_days"] = (
        completed["actual_completion"] - completed["sanction_date"]
    ).dt.days

    # Keep only positive durations (guard against bad data)
    completed = completed[completed["duration_days"] > 0]

    if completed.empty:
        # If no completed works exist, fall back: use median of ALL works'
        # elapsed time since sanction_date as a rough proxy.
        print("WARNING: No completed works found. Duration baselines will be NULL.")
        duration_stats = pd.DataFrame(columns=["category", "median_duration_days"])
    else:
        duration_stats = (
            completed.groupby("category")["duration_days"]
            .median()
            .reset_index()
            .rename(columns={"duration_days": "median_duration_days"})
        )
        duration_stats["median_duration_days"] = (
            duration_stats["median_duration_days"].round().astype("Int64")
        )

    # ── Merge cost + duration ──────────────────────────────────────────────
    baselines = cost_stats.merge(duration_stats, on="category", how="left")

    return baselines


# ---------------------------------------------------------------------------
# 3.  Upsert into category_baselines
# ---------------------------------------------------------------------------

def upsert_baselines(engine, baselines: pd.DataFrame) -> int:
    """
    INSERT … ON CONFLICT (category) DO UPDATE for each row.
    Returns the number of rows upserted.
    """

    upsert_sql = text("""
        INSERT INTO category_baselines (category, median_cost, std_cost, median_duration_days)
        VALUES (:category, :median_cost, :std_cost, :median_duration_days)
        ON CONFLICT (category) DO UPDATE SET
            median_cost          = EXCLUDED.median_cost,
            std_cost             = EXCLUDED.std_cost,
            median_duration_days = EXCLUDED.median_duration_days
    """)

    rows = baselines.where(baselines.notna(), None).to_dict("records")

    with engine.begin() as conn:
        for row in rows:
            conn.execute(upsert_sql, row)

    return len(rows)


# ---------------------------------------------------------------------------
# 4.  Main
# ---------------------------------------------------------------------------

def main():
    db_url = _load_env()
    engine = create_engine(db_url)

    print("Computing category baselines from works table …")
    baselines = compute_baselines(engine)

    print(f"\nBaselines computed for {len(baselines)} categories:")
    print(baselines.to_string(index=False))

    count = upsert_baselines(engine, baselines)
    print(f"\n[OK] Upserted {count} rows into category_baselines.")

    # ── Quick verification query ───────────────────────────────────────────
    with engine.connect() as conn:
        verify = pd.read_sql(text("SELECT * FROM category_baselines ORDER BY category"), conn)
    print(f"\nVerification — category_baselines table now has {len(verify)} rows:")
    print(verify.to_string(index=False))

    engine.dispose()


if __name__ == "__main__":
    main()
