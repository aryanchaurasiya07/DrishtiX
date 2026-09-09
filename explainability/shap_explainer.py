"""
F8 — SHAP Feature Attribution Explainer (Phase 4)

Computes per-feature contributions using SHAP TreeExplainer on the
trained Isolation Forest model (saved in ml/models/isolation_forest.joblib).

Features:
  - norm_cost: sanctioned_amt / median_cost
  - norm_duration: duration_days / median_duration_days

Outputs:
  - explainability/shap_attributions.csv (per-work SHAP values for QA/judges)
  - Console summary of top feature contributions for high-anomaly works
"""

import os
import sys
from datetime import date
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import joblib
import numpy as np
import pandas as pd
import shap
from sqlalchemy import create_engine, text
from ml.baselines import _load_env


def run_shap_explainer():
    db_url = _load_env()
    engine = create_engine(db_url)

    model_path = PROJECT_ROOT / "ml" / "models" / "isolation_forest.joblib"
    if not model_path.exists():
        sys.exit(f"ERROR: Model file not found at {model_path}. Run ml/cost_overrun.py first.")

    print(f"Loading Isolation Forest model from {model_path} ...")
    model = joblib.load(model_path)

    # ── 1. Query works and baselines ─────────────────────────────────────
    print("Loading works dataset from database ...")
    query = text("""
        SELECT w.id AS work_id,
               w.category,
               w.district,
               w.state,
               w.sanctioned_amt,
               w.sanction_date,
               w.actual_completion,
               cb.median_cost,
               cb.median_duration_days
        FROM works w
        JOIN category_baselines cb ON w.category = cb.category
        WHERE w.sanctioned_amt IS NOT NULL
          AND w.category IS NOT NULL
        ORDER BY w.id
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn)

    if df.empty:
        print("ERROR: No works found.")
        return

    # ── 2. Compute features exactly as cost_overrun.py ─────────────────────
    today = pd.Timestamp(date.today())
    df["sanction_date"] = pd.to_datetime(df["sanction_date"], errors="coerce")
    df["actual_completion"] = pd.to_datetime(df["actual_completion"], errors="coerce")

    df["end_date"] = df["actual_completion"].fillna(today)
    df["duration_days"] = (df["end_date"] - df["sanction_date"]).dt.days
    df["duration_days"] = df["duration_days"].fillna(0).clip(lower=0)

    for col in ("sanctioned_amt", "median_cost", "median_duration_days"):
        df[col] = df[col].astype(float)

    df["norm_cost"] = df["sanctioned_amt"] / df["median_cost"].clip(lower=1)
    df["norm_duration"] = df["duration_days"] / df["median_duration_days"].clip(lower=1)

    feature_cols = ["norm_cost", "norm_duration"]
    X = df[feature_cols].fillna(0)

    # ── 3. SHAP TreeExplainer ─────────────────────────────────────────────
    print("Computing SHAP values using TreeExplainer ...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # If shap_values is a list/3D, handle format
    if isinstance(shap_values, list):
        shap_matrix = shap_values[0]
    elif len(shap_values.shape) == 3:
        shap_matrix = shap_values[:, :, 0]
    else:
        shap_matrix = shap_values

    # ── 4. Build output dataframe ─────────────────────────────────────────
    df["shap_norm_cost"] = shap_matrix[:, 0]
    df["shap_norm_duration"] = shap_matrix[:, 1]
    df["base_value"] = explainer.expected_value if not isinstance(explainer.expected_value, (list, np.ndarray)) else explainer.expected_value[0]

    # Negative SHAP value in IsolationForest means pushing sample toward anomaly
    df["primary_driver"] = np.where(
        df["shap_norm_cost"].abs() >= df["shap_norm_duration"].abs(),
        "Cost Multiplier",
        "Timeline Duration"
    )

    out_csv = PROJECT_ROOT / "explainability" / "shap_attributions.csv"
    save_cols = [
        "work_id", "category", "state", "district", "sanctioned_amt",
        "norm_cost", "norm_duration", "shap_norm_cost", "shap_norm_duration",
        "primary_driver"
    ]
    df[save_cols].to_csv(out_csv, index=False)
    print(f"[OK] Saved SHAP feature attributions for {len(df)} works to {out_csv}")

    # Display sample top anomalous works
    top_anomalies = df.sort_values(by="shap_norm_cost", ascending=True).head(5)
    print("\nSample SHAP attributions for top cost outliers:")
    print(top_anomalies[["work_id", "category", "norm_cost", "shap_norm_cost", "primary_driver"]].to_string(index=False))


if __name__ == "__main__":
    run_shap_explainer()
