"""
Step 2: Join and Clean Each Term-Group, Union, and Load into Supabase

For each term-group:
  - Join Works Sanctioned + Works Completed + Expenditure on (full_work_id, district)
  - Map Work Status -> completed, partially_completed, ongoing
  - Parse district from IDA
  - Track completeness explicitly: has_completion_data, has_payment_data, has_vendor_data
  - Union all 4 cleaned term-groups
  - Build master mps and agencies tables
  - Upload cleaned datasets into Supabase
"""

import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
from backend.database import DATABASE_URL, engine

BASE_DIR = PROJECT_ROOT / "ingestion" / "raw_data" / "mplads-real-data"

# ─── SCOPE LOCK ───────────────────────────────────────────────────────────────
# Only these two source buckets are in scope for this audit build.
# Raw files for excluded buckets (17th_term_lok_sabha, Rajya Sabha(Retired))
# remain on disk but are NOT ingested — change SOURCE_BUCKETS here to re-add them.
SOURCE_BUCKETS = {
    "18th_LS",      # 18th_term_lok_sabha
    "RS_Sitting",   # Rajya Sabha(Sitting)
}

_ALL_TERM_CONFIG = [
    ("17th_LS",    "Lok Sabha",     BASE_DIR / "17th_term_lok_sabha"),
    ("18th_LS",    "Lok Sabha",     BASE_DIR / "18th_term_lok_sabha"),
    ("RS_Retired", "Rajya Sabha",   BASE_DIR / "Rajya Sabha(Retired)"),
    ("RS_Sitting", "Rajya Sabha",   BASE_DIR / "Rajya Sabha(Sitting)"),
]

# Filtered to SOURCE_BUCKETS only — do not edit; change SOURCE_BUCKETS above
TERM_CONFIG = [(code, house, path) for code, house, path in _ALL_TERM_CONFIG if code in SOURCE_BUCKETS]

print(f"[config] Ingesting {len(TERM_CONFIG)} bucket(s): {[c for c, *_ in TERM_CONFIG]}")
print(f"[config] Excluded (files kept on disk): {[c for c, *_ in _ALL_TERM_CONFIG if c not in SOURCE_BUCKETS]}")


def parse_work_column(val):
    if not isinstance(val, str):
        return None, None, "Uncategorized"
    clean = re.sub(r"[\t\r\n]+", " ", val).strip()
    parts = clean.split("/")
    if len(parts) >= 4:
        mp = re.sub(r"\s+", "", parts[1])
        yr = re.sub(r"\s+", "", parts[2])
        rest = "/".join(parts[3:]).strip()
        m = re.match(r"^(\d+)", rest)
        if m:
            code = m.group(1)
            full_id = f"WS/{mp}/{yr}/{code}"
            last_segment = parts[-1].strip()
            m_type = re.match(r"^\d+\s*-\s*(.+)$", last_segment)
            work_type = m_type.group(1).strip() if m_type else "Uncategorized"
            return code, full_id, work_type
    parts_all = clean.split("/")
    last = parts_all[-1].strip()
    m_last = re.match(r"^(\d+)\s*-\s*(.+)$", last)
    if m_last:
        code = m_last.group(1)
        return code, f"WS/{code}", m_last.group(2).strip()
    return None, None, "Uncategorized"

def parse_exp_work_id(val):
    if not isinstance(val, str):
        return None
    return re.sub(r"\s+", "", val).strip()

def parse_dist(ida):
    if not isinstance(ida, str):
        return "Unknown"
    return ida.split("(")[0].strip().title()

def extract_agency_name(ida):
    if not isinstance(ida, str):
        return "Unknown"
    m = re.search(r"\(([^)]+)\)", ida)
    if m:
        return m.group(1).strip()
    return ida.strip()

def clean_mp_name(name):
    if not isinstance(name, str):
        return "Unknown"
    n = re.sub(r"\s*\([^)]*\)", "", name)
    return re.sub(r"\s+", " ", n).strip()


def run_step2():
    print("=" * 70)
    print("STEP 2: Joining, Cleaning, and Unioning All Term-Groups")
    print("=" * 70)

    term_dfs = []
    completeness_records = []

    for term_code, house, term_path in TERM_CONFIG:
        print(f"\nProcessing Term: {term_code} ({house})...")

        # 1. Sanctioned
        df_s = pd.read_csv(term_path / "Works Sanctioned.csv", encoding="utf-8-sig", low_memory=False)
        df_s = df_s[pd.to_numeric(df_s["Sr. No."], errors="coerce").notna()]

        parsed = [parse_work_column(w) for w in df_s["Work"]]
        df_s["work_code"] = [p[0] for p in parsed]
        df_s["full_work_id"] = [p[1] for p in parsed]
        df_s["work_type"] = [p[2] for p in parsed]
        df_s["district"] = df_s["IDA"].apply(parse_dist)
        df_s["agency_name"] = df_s["IDA"].apply(extract_agency_name)
        df_s["sanction_date"] = pd.to_datetime(df_s["Sanction Date"], dayfirst=True, errors="coerce").dt.date
        df_s["sanctioned_amt"] = pd.to_numeric(df_s["Sanction Amount ( ₹ )"], errors="coerce")
        df_s["raw_status"] = df_s["Work Status"].astype(str).str.strip()
        df_s["state"] = df_s["State"].astype(str).str.strip()
        df_s["description"] = df_s["Work description"].astype(str).str.strip()

        mp_col = "Hon'ble Members of Parliament" if "Hon'ble Members of Parliament" in df_s.columns else "Hon'ble Members of Parliaments"
        const_col = "Constituency" if "Constituency" in df_s.columns else "Elected/Nominated"
        df_s["mp_name"] = df_s[mp_col].apply(clean_mp_name)
        df_s["constituency"] = df_s[const_col].astype(str).str.strip()
        df_s["house"] = house
        df_s["source_term"] = term_code

        # 2. Completed
        df_c = pd.read_csv(term_path / "Works Completed.csv", encoding="utf-8-sig", low_memory=False)
        df_c = df_c[pd.to_numeric(df_c["Sr. No."], errors="coerce").notna()]
        parsed_c = [parse_work_column(w) for w in df_c["Work"]]
        df_c["full_work_id"] = [p[1] for p in parsed_c]
        df_c["district"] = df_c["IDA"].apply(parse_dist)
        df_c["completion_date"] = pd.to_datetime(df_c["Completion Date"], dayfirst=True, errors="coerce").dt.date
        df_c["comp_disbursed"] = pd.to_numeric(df_c["Amount Disbursed ( ₹ )"], errors="coerce")

        comp_agg = df_c.groupby(["full_work_id", "district"], as_index=False).agg({
            "completion_date": "max",
            "comp_disbursed": "sum"
        })

        # 3. Expenditure
        df_e = pd.read_csv(term_path / "Expenditure on Completed and On-going Works as on Date.csv", encoding="utf-8-sig", low_memory=False)
        df_e = df_e[pd.to_numeric(df_e["Sr. No."], errors="coerce").notna()]
        df_e["full_work_id"] = df_e["Work ID"].apply(parse_exp_work_id)
        df_e["district"] = df_e["IDA"].apply(parse_dist)
        df_e["fund_disbursed"] = pd.to_numeric(df_e["Fund Disbursed Amount ( ₹ )"], errors="coerce").fillna(0)
        df_e["vendor_clean"] = df_e["Vendor Name"].astype(str).str.strip().replace(["nan", "None", ""], np.nan)

        exp_agg = df_e.groupby(["full_work_id", "district"], as_index=False).agg({
            "fund_disbursed": "sum",
            "vendor_clean": "first"
        }).rename(columns={"fund_disbursed": "expenditure", "vendor_clean": "vendor_name"})

        # 4. Join
        merged = pd.merge(df_s, comp_agg, on=["full_work_id", "district"], how="left")
        merged = pd.merge(merged, exp_agg, on=["full_work_id", "district"], how="left")

        # Map status
        def map_status(row):
            if pd.notna(row["completion_date"]) or row["raw_status"] == "Work Completed":
                return "completed"
            elif row["raw_status"] == "Work partially Completed":
                return "partially_completed"
            else:
                return "ongoing"

        merged["status"] = merged.apply(map_status, axis=1)

        # Completeness flags
        merged["has_completion_data"] = merged["completion_date"].notna()
        merged["has_payment_data"] = merged["expenditure"].notna() & (merged["expenditure"] > 0)
        merged["has_vendor_data"] = merged["vendor_name"].notna() & (merged["vendor_name"] != "")

        # Released amt: comp_disbursed if > 0 else expenditure if > 0 else 0
        merged["released_amt"] = np.where(
            merged["comp_disbursed"].notna() & (merged["comp_disbursed"] > 0),
            merged["comp_disbursed"],
            merged["expenditure"].fillna(0)
        )
        merged["expenditure"] = merged["expenditure"].fillna(0)

        n_rows = len(merged)
        n_comp = merged["has_completion_data"].sum()
        n_pay = merged["has_payment_data"].sum()
        n_vend = merged["has_vendor_data"].sum()

        completeness_records.append({
            "source_term": term_code,
            "total_works": n_rows,
            "has_completion_data": n_comp,
            "completion_pct": (n_comp / n_rows * 100) if n_rows > 0 else 0,
            "has_payment_data": n_pay,
            "payment_pct": (n_pay / n_rows * 100) if n_rows > 0 else 0,
            "has_vendor_data": n_vend,
            "vendor_pct": (n_vend / n_rows * 100) if n_rows > 0 else 0,
        })

        term_dfs.append(merged)
        print(f"  Unified {n_rows:>7,d} works: {n_comp:>6,d} completed ({n_comp/n_rows*100:.1f}%), {n_pay:>6,d} with expenditure ({n_pay/n_rows*100:.1f}%)")

    # Union all terms
    unified_df = pd.concat(term_dfs, ignore_index=True)
    unified_total = len(unified_df)
    print("\n" + "=" * 70)
    print(f"UNIFIED DATASET ROW COUNT: {unified_total:>8,d} WORKS")
    print("=" * 70)

    # Completeness summary table
    comp_df = pd.DataFrame(completeness_records)
    total_comp = comp_df["has_completion_data"].sum()
    total_pay = comp_df["has_payment_data"].sum()
    total_vend = comp_df["has_vendor_data"].sum()
    
    comp_df.loc[len(comp_df)] = {
        "source_term": "Grand Total",
        "total_works": unified_total,
        "has_completion_data": total_comp,
        "completion_pct": (total_comp / unified_total * 100),
        "has_payment_data": total_pay,
        "payment_pct": (total_pay / unified_total * 100),
        "has_vendor_data": total_vend,
        "vendor_pct": (total_vend / unified_total * 100),
    }

    print("\nCompleteness Summary by Source Term:")
    print(comp_df.to_string(index=False))

    # Save local CSV backup
    local_csv_path = PROJECT_ROOT / "ingestion" / "works_cleaned_unified.csv"
    print(f"\nSaving local cleaned dataset to {local_csv_path}...")
    unified_df.to_csv(local_csv_path, index=False, encoding="utf-8")
    print("Local CSV backup saved successfully.")

    # Build and Load into Supabase
    load_to_supabase(unified_df)


def load_to_supabase(unified_df: pd.DataFrame):
    print("\n" + "=" * 70)
    print("LOADING CLEANED REAL DATA INTO SUPABASE POSTGRESQL")
    print("=" * 70)

    with engine.connect() as conn:
        print("Connected to Supabase. Updating schema columns...")
        # Add tracking columns if not present
        conn.execute(text("""
            ALTER TABLE works ADD COLUMN IF NOT EXISTS source_term VARCHAR(20);
            ALTER TABLE works ADD COLUMN IF NOT EXISTS has_completion_data BOOLEAN DEFAULT FALSE;
            ALTER TABLE works ADD COLUMN IF NOT EXISTS has_payment_data BOOLEAN DEFAULT FALSE;
            ALTER TABLE works ADD COLUMN IF NOT EXISTS has_vendor_data BOOLEAN DEFAULT FALSE;
            ALTER TABLE works ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);
            ALTER TABLE works ADD COLUMN IF NOT EXISTS work_code VARCHAR(100);
        """))
        conn.commit()

    # 1. Build MPs Table
    print("\nBuilding master `mps` table from real data...")
    # Distinct MPs
    mp_tuples = unified_df[["mp_name", "house", "constituency", "state", "district"]].drop_duplicates(subset=["mp_name", "house", "state", "constituency"]).copy()
    mp_tuples = mp_tuples.reset_index(drop=True)
    mp_tuples["id"] = mp_tuples.index + 1
    mp_tuples = mp_tuples.rename(columns={"mp_name": "name"})
    
    # Fast map dict: (name, house, state, constituency) -> mp_id
    mp_lookup = {}
    for _, r in mp_tuples.iterrows():
        mp_lookup[(r["name"], r["house"], r["state"], r["constituency"])] = r["id"]

    # 2. Build Agencies Table
    print("Building master `agencies` table from real data...")
    agency_tuples = unified_df[["agency_name", "district", "state"]].drop_duplicates(subset=["agency_name", "district", "state"]).copy()
    agency_tuples = agency_tuples.reset_index(drop=True)
    agency_tuples["id"] = agency_tuples.index + 1
    agency_tuples = agency_tuples.rename(columns={"agency_name": "name"})

    agency_lookup = {}
    for _, r in agency_tuples.iterrows():
        agency_lookup[(r["name"], r["district"], r["state"])] = r["id"]

    # Map foreign keys to works
    print("Mapping Foreign Keys (mp_id, agency_id) to works...")
    unified_df["mp_id"] = [
        mp_lookup.get((r["mp_name"], r["house"], r["state"], r["constituency"]), 1)
        for _, r in unified_df[["mp_name", "house", "state", "constituency"]].iterrows()
    ]
    unified_df["agency_id"] = [
        agency_lookup.get((r["agency_name"], r["district"], r["state"]), 1)
        for _, r in unified_df[["agency_name", "district", "state"]].iterrows()
    ]

    # Prepare final works DataFrame matching DB schema
    unified_df["id"] = unified_df.index + 1
    unified_df["category"] = unified_df["work_type"]
    unified_df["actual_completion"] = unified_df["completion_date"]
    unified_df["is_synthetic"] = False
    unified_df["created_at"] = datetime.now()

    works_db = unified_df[[
        "id", "mp_id", "agency_id", "category", "description", "state", "district",
        "sanctioned_amt", "released_amt", "expenditure", "sanction_date",
        "actual_completion", "status", "is_synthetic", "created_at",
        "source_term", "has_completion_data", "has_payment_data", "has_vendor_data",
        "vendor_name", "work_code"
    ]].copy()

    # Clear and populate Supabase tables
    with engine.begin() as conn:
        print("Clearing old data from dependent tables and works/mps/agencies...")
        conn.execute(text("TRUNCATE TABLE flags, duplicate_pairs, risk_scores CASCADE;"))
        conn.execute(text("TRUNCATE TABLE works, mps, agencies RESTART IDENTITY CASCADE;"))

    print(f"Uploading {len(mp_tuples):,d} MPs to Supabase...")
    mp_tuples[["id", "name", "house", "constituency", "state", "district"]].to_sql(
        "mps", engine, if_exists="append", index=False, method="multi", chunksize=1000
    )

    print(f"Uploading {len(agency_tuples):,d} Agencies to Supabase...")
    agency_tuples[["id", "name", "district", "state"]].to_sql(
        "agencies", engine, if_exists="append", index=False, method="multi", chunksize=1000
    )

    print(f"Uploading {len(works_db):,d} Works to Supabase in multi-row batches...")
    works_db.to_sql(
        "works", engine, if_exists="append", index=False, method="multi", chunksize=1500
    )

    print("Checking live Supabase row counts...")
    with engine.connect() as conn:
        w_cnt = conn.execute(text("SELECT COUNT(*) FROM works;")).scalar()
        m_cnt = conn.execute(text("SELECT COUNT(*) FROM mps;")).scalar()
        a_cnt = conn.execute(text("SELECT COUNT(*) FROM agencies;")).scalar()
        print(f"Supabase Database Confirmed: {w_cnt:,d} works, {m_cnt:,d} MPs, {a_cnt:,d} agencies live!")


if __name__ == "__main__":
    run_step2()
