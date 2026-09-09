"""
F7 -- Risk Scorer  (Phase 3)

Combines the three detector scores into a single 0-100 risk score per work
using the 40/30/30 weighting from PRD Section 9.5.

Formula:
    risk_score = 100 * (0.40 * cost_score + 0.30 * duplicate_score + 0.30 * delay_score)

Risk bands:
    0-39   -> 'green'  ("Low risk")
    40-70  -> 'amber'  ("Needs review")
    71-100 -> 'red'    ("High priority")

Rule override:
    If any flags.source = 'rule' exists for a work AND computed band is 'green',
    upgrade to 'amber'. A rule violation should never be silently outscored
    by a low ML score.

Outputs:
  - Upserts to `risk_scores` table (one row per work, overwritten on re-run)

Safe to re-run: truncates risk_scores before inserting.
"""

import os
import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------

def _load_env() -> str:
    project_root = Path(__file__).resolve().parent.parent
    for name in (".env", ".env.txt"):
        candidate = project_root / name
        if candidate.exists():
            load_dotenv(candidate, override=True)
            break
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not found.")
    return db_url


# ---------------------------------------------------------------------------
# Weights and bands
# ---------------------------------------------------------------------------

COST_WEIGHT = 0.40
DUPLICATE_WEIGHT = 0.30
DELAY_WEIGHT = 0.30

def assign_band(score: float) -> str:
    if score >= 71:
        return "red"
    elif score >= 40:
        return "amber"
    else:
        return "green"


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def run_risk_scorer(engine,
                    cost_scores: dict,
                    duplicate_scores: dict,
                    delay_scores: dict,
                    rule_triggered_works: list) -> int:
    """
    Computes combined risk score for every work and upserts to risk_scores.

    Overrides:
      1. Single-detector override: if any detector score >= 0.90, force minimum Amber.
         (Eliminates single-detector blind spot where duplicate or delay alone cannot reach Amber 40.0)
      2. Statutory rule override: if work triggered any rule, force minimum Amber.
      3. Insufficient data band: if work is missing data across > 1 detector and not Red/Amber,
         label as 'insufficient_data' rather than false-sense-of-security Green.

    Args:
        cost_scores:          {work_id: float 0-1} from cost_overrun.py
        duplicate_scores:     {work_id: float 0-1} from duplicate_detector.py
        delay_scores:         {work_id: float 0-1} from delay_detector.py
        rule_triggered_works: [work_id, ...] from rules_engine.py

    Returns:
        Number of rows upserted.
    """

    rule_set = set(rule_triggered_works)

    # Get all work IDs with completeness columns from the database
    with engine.connect() as conn:
        works_df = pd.read_sql(text("""
            SELECT id AS work_id,
                   (actual_completion IS NOT NULL) AS has_completion_data,
                   (expenditure IS NOT NULL AND expenditure > 0) AS has_payment_data,
                   (agency_id IS NOT NULL) AS has_vendor_data
            FROM works
            ORDER BY id
        """), conn)

    rows = []
    for _, row in works_df.iterrows():
        wid = int(row["work_id"])
        has_comp = bool(row["has_completion_data"])
        has_pay = bool(row["has_payment_data"])
        has_vend = bool(row["has_vendor_data"])

        cs = cost_scores.get(wid, 0.0)
        ds = duplicate_scores.get(wid, 0.0)
        dls = delay_scores.get(wid, 0.0)

        risk_score = 100.0 * (
            COST_WEIGHT * cs +
            DUPLICATE_WEIGHT * ds +
            DELAY_WEIGHT * dls
        )
        risk_score = round(min(max(risk_score, 0.0), 100.0), 2)

        band = assign_band(risk_score)

        # 1. Single-detector override: any single detector >= 0.90 severity forces minimum Amber
        if any(s >= 0.90 for s in (cs, ds, dls)) and band == "green":
            band = "amber"

        # 2. Rule override: force minimum Amber if any statutory rule was triggered
        if wid in rule_set and band == "green":
            band = "amber"

        # 3. Explicit "insufficient_data" band: for works missing data across > 1 detector
        # (Missing count >= 2 among completion, payment, vendor)
        missing_count = (0 if has_comp else 1) + (0 if has_pay else 1) + (0 if has_vend else 1)
        if missing_count > 1 and band == "green":
            band = "insufficient_data"

        rows.append({
            "work_id": wid,
            "cost_score": round(cs, 4),
            "duplicate_score": round(ds, 4),
            "delay_score": round(dls, 4),
            "risk_score": risk_score,
            "risk_band": band,
        })

    # ── Write to DB (truncate + insert for clean idempotent re-run) ───────
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM risk_scores"))

        if rows:
            scores_df = pd.DataFrame(rows)
            scores_df.to_sql(
                "risk_scores",
                conn,
                if_exists="append",
                index=False,
                chunksize=2500,
                method="multi"
            )

    return len(rows)


# ---------------------------------------------------------------------------
# Standalone main — for testing; normally called from run_pipeline.py
# ---------------------------------------------------------------------------

def main():
    """
    Standalone run: re-reads scores by running each detector fresh.
    In production use, run_pipeline.py calls run_risk_scorer() with
    the score dicts already in memory.
    """
    db_url = _load_env()
    engine = create_engine(db_url)

    print("Running Risk Scorer (F7) in standalone mode ...")
    print("  Re-running detectors to collect scores ...")

    from ml.cost_overrun import run_cost_overrun_detector
    from ml.duplicate_detector import run_duplicate_detector
    from ml.delay_detector import run_delay_detector
    from ml.rules_engine import run_rules_engine

    cost_scores = run_cost_overrun_detector(engine)
    duplicate_scores = run_duplicate_detector(engine)
    delay_scores = run_delay_detector(engine)
    rule_triggered = run_rules_engine(engine)

    count = run_risk_scorer(engine, cost_scores, duplicate_scores,
                            delay_scores, rule_triggered)

    print(f"\n[OK] Risk Scorer complete. {count} rows written to risk_scores.")

    # ── Summary stats ─────────────────────────────────────────────────────
    with engine.connect() as conn:
        summary = pd.read_sql(text("""
            SELECT risk_band, COUNT(*) as count,
                   ROUND(AVG(risk_score)::numeric, 1) as avg_score
            FROM risk_scores
            GROUP BY risk_band
            ORDER BY avg_score DESC
        """), conn)

        top5 = pd.read_sql(text("""
            SELECT work_id, risk_score, risk_band,
                   cost_score, duplicate_score, delay_score
            FROM risk_scores
            ORDER BY risk_score DESC
            LIMIT 5
        """), conn)

    print("\nRisk band distribution:")
    print(summary.to_string(index=False))

    print("\nTop 5 highest-risk works:")
    print(top5.to_string(index=False))

    engine.dispose()


if __name__ == "__main__":
    main()
