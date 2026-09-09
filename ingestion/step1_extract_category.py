"""
Step 1: Extract Real Work Category

Parses the embedded work category from the `Work` column:
  "WS/\t MP620/2024-2025/133166-Construction of buildings for community cultural activities"
Method: Split on "/", take the last segment, strip leading digits and hyphen.
For rows that fail, falls back to "Uncategorized".

Reports:
  - Parse success rate (count and percentage)
  - Uncategorized count
  - Full distinct list of `work_type` values and their counts
"""

import re
import sys
from pathlib import Path
import pandas as pd
from collections import Counter

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BASE_DIR = PROJECT_ROOT / "ingestion" / "raw_data" / "mplads-real-data"

TERM_CONFIG = [
    ("17th_LS", BASE_DIR / "17th_term_lok_sabha"),
    ("18th_LS", BASE_DIR / "18th_term_lok_sabha"),
    ("RS_Retired", BASE_DIR / "Rajya Sabha(Retired)"),
    ("RS_Sitting", BASE_DIR / "Rajya Sabha(Sitting)"),
]

def parse_work_type_strict(work_val: str):
    """
    Split on '/', take the last segment, strip leading digits and hyphen.
    Returns (work_type, is_success).
    """
    if not isinstance(work_val, str):
        return "Uncategorized", False
    
    parts = work_val.split("/")
    if not parts:
        return "Uncategorized", False
    
    last = parts[-1].strip()
    m = re.match(r"^\d+\s*-\s*(.+)$", last)
    if m:
        work_type = m.group(1).strip()
        if work_type:
            return work_type, True
    
    return "Uncategorized", False


def run_step1():
    print("=" * 70)
    print("STEP 1: Extracting Real Work Category from 'Work' Column")
    print("=" * 70)

    total_rows = 0
    success_rows = 0
    failed_rows = 0
    category_counts = Counter()
    term_breakdown = {}

    for term_code, term_path in TERM_CONFIG:
        fpath = term_path / "Works Sanctioned.csv"
        try:
            df = pd.read_csv(fpath, encoding="utf-8-sig", low_memory=False)
        except UnicodeDecodeError:
            df = pd.read_csv(fpath, encoding="latin1", low_memory=False)

        # Drop Grand Total
        if "Sr. No." in df.columns:
            df = df[df["Sr. No."].astype(str).str.strip().str.lower() != "grand total"]
            df = df[pd.to_numeric(df["Sr. No."], errors="coerce").notna()]

        t_total = len(df)
        t_success = 0
        t_failed = 0

        for w in df["Work"]:
            w_type, ok = parse_work_type_strict(w)
            category_counts[w_type] += 1
            if ok:
                t_success += 1
            else:
                t_failed += 1

        total_rows += t_total
        success_rows += t_success
        failed_rows += t_failed
        term_breakdown[term_code] = {
            "total": t_total,
            "success": t_success,
            "failed": t_failed,
            "success_rate": (t_success / t_total * 100) if t_total > 0 else 0
        }

    success_rate = (success_rows / total_rows * 100) if total_rows > 0 else 0
    uncat_rate = (failed_rows / total_rows * 100) if total_rows > 0 else 0

    print(f"Total Works Sanctioned Scanned: {total_rows:>8,d}")
    print(f"Successfully Parsed Category : {success_rows:>8,d} ({success_rate:.2f}%)")
    print(f"Failed / Uncategorized Fallback: {failed_rows:>8,d} ({uncat_rate:.2f}%)")

    print("\n--- Breakdown by Source Term ---")
    for t_code, stats in term_breakdown.items():
        print(f"  {t_code:<12}: {stats['total']:>7,d} total | {stats['success']:>7,d} success ({stats['success_rate']:.2f}%) | {stats['failed']:>6,d} uncategorized")

    print("\n" + "=" * 70)
    print(f"DISTINCT WORK TYPES AND COUNTS ({len(category_counts)} distinct values)")
    print("=" * 70)

    # Sort by frequency descending
    sorted_cats = category_counts.most_common()
    for idx, (ctype, cnt) in enumerate(sorted_cats, 1):
        pct = (cnt / total_rows * 100)
        print(f"{idx:>3d}. {ctype:<90} : {cnt:>7,d} ({pct:>5.2f}%)")

    # Save to a text artifact for later inspection
    out_file = PROJECT_ROOT / "ingestion" / "work_types_inventory.txt"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"Total Works: {total_rows}\n")
        f.write(f"Parsed: {success_rows} ({success_rate:.2f}%)\n")
        f.write(f"Uncategorized: {failed_rows} ({uncat_rate:.2f}%)\n\n")
        f.write("Rank | Count | Pct | Work Type\n")
        f.write("-" * 80 + "\n")
        for idx, (ctype, cnt) in enumerate(sorted_cats, 1):
            pct = (cnt / total_rows * 100)
            f.write(f"{idx:>4d} | {cnt:>7d} | {pct:>5.2f}% | {ctype}\n")
    print(f"\nFull inventory saved to {out_file}")

    return category_counts, success_rate, failed_rows


if __name__ == "__main__":
    run_step1()
