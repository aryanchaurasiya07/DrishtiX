"""
ML Pipeline Runner  (Phase 3)

Orchestrates the full detection pipeline in order:
  1. Cost-Overrun Detector  (F3)
  2. Duplicate-Work Detector (F4)
  3. Delay Detector          (F5)
  4. Rules Engine            (F6)
  5. Risk Scorer             (F7)

Idempotent: each detector clears its own previous flags before inserting,
and risk_scorer truncates risk_scores before writing.

Usage:
    python ml/run_pipeline.py
"""

import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _load_env() -> str:
    for name in (".env", ".env.txt"):
        candidate = PROJECT_ROOT / name
        if candidate.exists():
            load_dotenv(candidate, override=True)
            break
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not found.")
    return db_url


def main():
    db_url = _load_env()
    engine = create_engine(db_url)

    start = time.time()
    print("=" * 60)
    print("MPLADS Detection Pipeline")
    print("=" * 60)

    # ── Step 1: Cost-Overrun Detector ─────────────────────────────────────
    print("\n[1/5] Cost-Overrun Detector (F3) ...")
    from ml.cost_overrun import run_cost_overrun_detector
    cost_scores = run_cost_overrun_detector(engine)
    print(f"       Scores: {len(cost_scores)} works")

    # ── Step 2: Duplicate-Work Detector ───────────────────────────────────
    print("\n[2/5] Duplicate-Work Detector (F4) ...")
    from ml.duplicate_detector import run_duplicate_detector
    duplicate_scores = run_duplicate_detector(engine)
    print(f"       Scores: {len(duplicate_scores)} works")

    # ── Step 3: Delay Detector ────────────────────────────────────────────
    print("\n[3/5] Delay Detector (F5) ...")
    from ml.delay_detector import run_delay_detector
    delay_scores = run_delay_detector(engine)
    print(f"       Scores: {len(delay_scores)} works")

    # ── Step 4: Rules Engine ──────────────────────────────────────────────
    print("\n[4/5] Rules Engine (F6) ...")
    from ml.rules_engine import run_rules_engine
    rule_triggered = run_rules_engine(engine)
    print(f"       Triggered: {len(rule_triggered)} works")

    # ── Step 5: Risk Scorer ───────────────────────────────────────────────
    print("\n[5/5] Risk Scorer (F7) ...")
    from ml.risk_scorer import run_risk_scorer
    count = run_risk_scorer(
        engine, cost_scores, duplicate_scores, delay_scores, rule_triggered
    )
    print(f"       Scored: {count} works")

    # ── Summary ───────────────────────────────────────────────────────────
    elapsed = time.time() - start

    import pandas as pd

    with engine.connect() as conn:
        band_dist = pd.read_sql(text("""
            SELECT risk_band, COUNT(*) as count,
                   ROUND(AVG(risk_score)::numeric, 1) as avg_score
            FROM risk_scores
            GROUP BY risk_band
            ORDER BY avg_score DESC
        """), conn)

        flag_dist = pd.read_sql(text("""
            SELECT source, COUNT(*) as count
            FROM flags
            GROUP BY source
            ORDER BY count DESC
        """), conn)

        top5 = pd.read_sql(text("""
            SELECT work_id, risk_score, risk_band
            FROM risk_scores
            ORDER BY risk_score DESC
            LIMIT 5
        """), conn)

    print("\n" + "=" * 60)
    print(f"Pipeline complete in {elapsed:.1f}s")
    print("=" * 60)

    print("\nRisk band distribution:")
    print(band_dist.to_string(index=False))

    print("\nFlags by source:")
    print(flag_dist.to_string(index=False))

    print("\nTop 5 highest-risk works:")
    print(top5.to_string(index=False))

    engine.dispose()


if __name__ == "__main__":
    main()
