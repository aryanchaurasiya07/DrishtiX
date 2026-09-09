"""
Fix Ongoing Works Sanction Dates in works.csv and Database

Fix description:
- For status='ongoing' (not delay anomalies, ~1131 works):
    age (today - sanction_date) between 0.3x and 1.3x category median duration
- For ~52 planted delay anomalies (status='ongoing'):
    age (today - sanction_date) between 2.5x and 4.0x category median duration
- Completed works left untouched.
- Updates c:\\Users\\itsar\\Downloads\\mplads\\works.csv
- Updates Supabase Postgres works table
"""

import os
import sys
import random
from datetime import date, timedelta
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from ml.baselines import _load_env

def main():
    today = date.today()
    random.seed(42)
    np.random.seed(42)

    csv_path = Path(r"c:\Users\itsar\Downloads\mplads\works.csv")
    backup_path = Path(r"c:\Users\itsar\Downloads\mplads\works_backup.csv")
    
    print(f"Reading works from {csv_path} ...")
    df = pd.read_csv(csv_path)
    
    # Create backup if not exists
    if not backup_path.exists():
        df.to_csv(backup_path, index=False)
        print(f"Backup saved to {backup_path}")

    # Connect to DB to get category_baselines
    engine = create_engine(_load_env())
    baselines = pd.read_sql("SELECT category, median_duration_days FROM category_baselines", engine)
    cat_median = dict(zip(baselines["category"], baselines["median_duration_days"].astype(int)))
    print(f"Loaded baselines for {len(cat_median)} categories: {cat_median}")

    ongoing_mask = df["status"].str.lower() == "ongoing"
    ongoing_indices = df[ongoing_mask].index.tolist()
    print(f"Total ongoing works: {len(ongoing_indices)}")

    # Pick 52 planted delay anomalies deterministically
    num_anomalies = 52
    delay_anomaly_indices = set(random.sample(ongoing_indices, num_anomalies))
    print(f"Selected {len(delay_anomaly_indices)} ongoing works as planted delay anomalies.")

    # Apply date fixes
    updated_rows = 0
    for idx in ongoing_indices:
        cat = df.at[idx, "category"]
        median_dur = cat_median.get(cat, 150)

        # Compute original expected duration if available
        orig_s_date = pd.to_datetime(df.at[idx, "sanction_date"])
        orig_e_date = pd.to_datetime(df.at[idx, "expected_completion"]) if pd.notna(df.at[idx, "expected_completion"]) else None
        
        expected_span_days = (orig_e_date - orig_s_date).days if (orig_e_date is not None and pd.notna(orig_e_date)) else int(median_dur * 1.1)
        if expected_span_days <= 0:
            expected_span_days = int(median_dur * 1.1)

        if idx in delay_anomaly_indices:
            # Planted delay anomaly: 2.5x to 4.0x median duration
            factor = random.uniform(2.5, 4.0)
        else:
            # Normal WIP ongoing work: 0.3x to 1.3x median duration
            factor = random.uniform(0.3, 1.3)

        age_days = int(factor * median_dur)
        new_sanction_date = today - timedelta(days=age_days)
        new_expected_completion = new_sanction_date + timedelta(days=expected_span_days)

        df.at[idx, "sanction_date"] = new_sanction_date.strftime("%Y-%m-%d")
        df.at[idx, "expected_completion"] = new_expected_completion.strftime("%Y-%m-%d")
        updated_rows += 1

    print(f"Updated dates for {updated_rows} ongoing works.")

    # Save to CSV
    df.to_csv(csv_path, index=False)
    print(f"[OK] Saved updated works.csv to {csv_path}")

    # Also update Supabase database directly
    print("Updating Supabase PostgreSQL 'works' table ...")
    ongoing_df = df[ongoing_mask][["id", "sanction_date", "expected_completion"]].copy()
    records = []
    for _, r in ongoing_df.iterrows():
        records.append({
            "id": int(r["id"]),
            "sanction_date": date.fromisoformat(r["sanction_date"]) if pd.notna(r["sanction_date"]) else None,
            "expected_completion": date.fromisoformat(r["expected_completion"]) if pd.notna(r["expected_completion"]) else None,
        })

    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE works
                SET sanction_date = :sanction_date,
                    expected_completion = :expected_completion
                WHERE id = :id
            """),
            records
        )
    print(f"[OK] Database 'works' table successfully updated for {len(records)} ongoing works.")

if __name__ == "__main__":
    main()
