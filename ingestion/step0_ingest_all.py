"""
Step 0: Ingest and Normalize All Four Term-Groups

Renames files with (1), (2), (Lok Sabha) suffixes to canonical names.
Loads each of the 6 file types across all 4 term-groups:
  - 17th_term_lok_sabha -> 17th_LS
  - 18th_term_lok_sabha -> 18th_LS
  - Rajya Sabha(Retired) -> RS_Retired
  - Rajya Sabha(Sitting) -> RS_Sitting

Tags each row with `source_term`.
Drops trailing 'Grand Total' summary rows.
Reports row counts per file-type per term-group and grand totals.
"""

import os
import re
import sys
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BASE_DIR = PROJECT_ROOT / "ingestion" / "raw_data" / "mplads-real-data"

# ─── SCOPE LOCK ───────────────────────────────────────────────────────────────
# Must match ingestion/step2_join_and_clean.py SOURCE_BUCKETS exactly.
SOURCE_BUCKETS = {
    "18th_LS",
    "RS_Sitting",
}

_ALL_TERM_CONFIG = [
    ("17th_LS",    BASE_DIR / "17th_term_lok_sabha"),
    ("18th_LS",    BASE_DIR / "18th_term_lok_sabha"),
    ("RS_Retired", BASE_DIR / "Rajya Sabha(Retired)"),
    ("RS_Sitting", BASE_DIR / "Rajya Sabha(Sitting)"),
]

TERM_CONFIG = [(code, path) for code, path in _ALL_TERM_CONFIG if code in SOURCE_BUCKETS]


CANONICAL_NAMES = {
    "allocated": "Allocated Limit for Honble MPs.csv",
    "calamity": "Amount consented for Calamity.csv",
    "expenditure": "Expenditure on Completed and On-going Works as on Date.csv",
    "completed": "Works Completed.csv",
    "recommended": "Works Recommended.csv",
    "sanctioned": "Works Sanctioned.csv",
}

def identify_file_type(filename: str) -> str:
    name_lower = filename.lower()
    if "allocated limit" in name_lower:
        return "allocated"
    elif "calamity" in name_lower:
        return "calamity"
    elif "expenditure" in name_lower:
        return "expenditure"
    elif "works completed" in name_lower:
        return "completed"
    elif "works recommended" in name_lower:
        return "recommended"
    elif "works sanctioned" in name_lower:
        return "sanctioned"
    return "unknown"


def rename_files_strip_suffixes():
    """Rename any browser duplicate download filenames e.g. (1), (2) in place."""
    print("=" * 70)
    print("STEP 0.1: Renaming raw CSV files to strip browser download suffixes")
    print("=" * 70)
    renamed_count = 0
    for term_code, term_path in TERM_CONFIG:
        for f in list(term_path.iterdir()):
            if f.is_file() and f.suffix.lower() == ".csv":
                ftype = identify_file_type(f.name)
                if ftype in CANONICAL_NAMES:
                    target_name = CANONICAL_NAMES[ftype]
                    if f.name != target_name:
                        target_path = term_path / target_name
                        print(f"  [{term_code}] Renaming '{f.name}' -> '{target_name}'")
                        f.rename(target_path)
                        renamed_count += 1
    print(f"Total files renamed: {renamed_count}\n")


def load_file_clean(filepath: Path, source_term: str) -> pd.DataFrame:
    """Reads a CSV, drops 'Grand Total' row, and adds source_term."""
    try:
        df = pd.read_csv(filepath, encoding="utf-8-sig", low_memory=False)
    except UnicodeDecodeError:
        df = pd.read_csv(filepath, encoding="latin1", low_memory=False)

    # Drop trailing Grand Total row if present
    if "Sr. No." in df.columns:
        df = df[df["Sr. No."].astype(str).str.strip().str.lower() != "grand total"]
        # Drop rows where Sr. No. is not a number
        df = df[pd.to_numeric(df["Sr. No."], errors="coerce").notna()]

    df["source_term"] = source_term
    return df


def run_step0():
    rename_files_strip_suffixes()

    print("=" * 70)
    print("STEP 0.2: Ingesting all term-groups and counting rows")
    print("=" * 70)

    stats = [] # per term, per file_type, count
    combined_dfs = {k: [] for k in CANONICAL_NAMES.keys()}

    for term_code, term_path in TERM_CONFIG:
        print(f"\n--- Loading Term: {term_code} ---")
        for ftype, fname in CANONICAL_NAMES.items():
            fpath = term_path / fname
            if not fpath.exists():
                print(f"  WARNING: {fname} missing in {term_code}")
                stats.append({"term": term_code, "file_type": ftype, "filename": fname, "rows": 0})
                continue
            df = load_file_clean(fpath, term_code)
            row_count = len(df)
            print(f"  {fname:<55}: {row_count:>7,d} rows")
            stats.append({"term": term_code, "file_type": ftype, "filename": fname, "rows": row_count})
            combined_dfs[ftype].append(df)

    # Combine per file type
    print("\n" + "=" * 70)
    print("COMBINED DATASET SUMMARY (Across all 4 Term-Groups)")
    print("=" * 70)
    grand_totals = {}
    for ftype, dfs in combined_dfs.items():
        if dfs:
            combined = pd.concat(dfs, ignore_index=True)
            grand_totals[ftype] = len(combined)
            print(f"  {CANONICAL_NAMES[ftype]:<55}: {len(combined):>8,d} rows")
        else:
            grand_totals[ftype] = 0

    print("-" * 70)
    print(f"  GRAND TOTAL ROWS ACROSS ALL FILES: {sum(grand_totals.values()):>8,d}")
    print("=" * 70)

    # Save stats summary to scratch for reference
    stats_df = pd.DataFrame(stats)
    stats_pivot = stats_df.pivot(index="filename", columns="term", values="rows")
    stats_pivot["Grand Total"] = stats_pivot.sum(axis=1)
    print("\nDetailed Breakdown Table:")
    print(stats_pivot.to_string())

    return combined_dfs, stats_pivot


if __name__ == "__main__":
    run_step0()
