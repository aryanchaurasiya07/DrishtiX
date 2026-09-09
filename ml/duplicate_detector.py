"""
F4 -- Duplicate-Work Detector  (Phase 3)

Uses Sentence-BERT (all-MiniLM-L6-v2) to embed work descriptions, then
computes pairwise cosine similarity *within each district* (PRD Section 9.2).

Flag condition:
    cosine_similarity > 0.90 between any two works in the same district

Outputs:
  - Rows written to `flags` table           (source = 'duplicate_model')
  - Rows written to `duplicate_pairs` table  (work_id_a, work_id_b, similarity)
  - Dict  {work_id: duplicate_score}         (max similarity, for risk_scorer.py)

Safe to re-run: deletes previous duplicate_model flags and duplicate_pairs
before inserting new ones.
"""

import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
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
# Core logic
# ---------------------------------------------------------------------------

SIMILARITY_THRESHOLD = 0.90


def run_duplicate_detector(engine) -> dict:
    """
    Returns {work_id: duplicate_score} where duplicate_score is the max
    cosine similarity that work has with any other work in the same district.
    Works with no near-duplicate get a score of 0.0.
    """

    # ── 1. Load works with descriptions ───────────────────────────────────
    query = text("""
        SELECT id AS work_id,
               district,
               description,
               sanctioned_amt
        FROM works
        WHERE description IS NOT NULL
          AND TRIM(description) != ''
        ORDER BY id
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn)

    if df.empty:
        print("  Duplicate: No works with descriptions found. Skipping.")
        return {}

    print(f"  Duplicate: {len(df)} works with descriptions loaded across "
          f"{df['district'].nunique()} districts")

    # ── 2. Load model and encode (with disk caching) ───────────────────────
    project_root = Path(__file__).resolve().parent.parent
    models_dir = project_root / "ml" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    emb_path = models_dir / "sbert_embeddings.npy"
    ckpt_path = models_dir / "sbert_unique_checkpoint.npy"

    if emb_path.exists():
        print(f"  Duplicate: Loading cached embeddings from {emb_path} ...")
        embeddings = np.load(emb_path)
        if len(embeddings) != len(df):
            print(f"  Duplicate: Cached embeddings length ({len(embeddings)}) != works count ({len(df)}), recomputing...")
            embeddings = None
    else:
        embeddings = None

    if embeddings is None:
        from sentence_transformers import SentenceTransformer

        print("  Duplicate: Loading all-MiniLM-L6-v2 model ...")
        torch.set_num_threads(8)
        model = SentenceTransformer("all-MiniLM-L6-v2")
        model.max_seq_length = 64

        unique_descs = df["description"].unique().tolist()
        n_unique = len(unique_descs)
        print(f"  Duplicate: Encoding {n_unique} unique descriptions (batch_size=128, max_seq_length=64) ...")

        # Check if partial checkpoint exists
        start_idx = 0
        unique_emb_list = []
        if ckpt_path.exists():
            try:
                ckpt_arr = np.load(ckpt_path)
                if len(ckpt_arr) <= n_unique:
                    start_idx = len(ckpt_arr)
                    unique_emb_list.append(ckpt_arr)
                    print(f"  Duplicate: Resuming from checkpoint at {start_idx}/{n_unique} ...")
            except Exception as e:
                print(f"  Duplicate: Checkpoint load error ({e}), starting fresh...")
                start_idx = 0
                unique_emb_list = []

        chunk_size = 10000
        t_start = time.time()
        for idx in range(start_idx, n_unique, chunk_size):
            chunk = unique_descs[idx:idx + chunk_size]
            t0 = time.time()
            chunk_emb = model.encode(
                chunk,
                batch_size=128,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            unique_emb_list.append(chunk_emb)
            elapsed = time.time() - t0
            done = min(idx + chunk_size, n_unique)
            rate = len(chunk) / elapsed if elapsed > 0 else 0
            eta = (n_unique - done) / rate if rate > 0 else 0
            print(f"  Duplicate: Encoded {done}/{n_unique} ({done/n_unique:.1%}) - {rate:.1f} texts/s - ETA {eta/60:.1f}m")

            # Save checkpoint
            if len(unique_emb_list) > 1:
                cur_emb = np.vstack(unique_emb_list)
            else:
                cur_emb = unique_emb_list[0]
            np.save(ckpt_path, cur_emb)

        unique_embeddings = np.vstack(unique_emb_list)
        print(f"  Duplicate: All {n_unique} unique descriptions encoded in {(time.time() - t_start)/60:.1f}m")

        # Map back to all works
        print("  Duplicate: Mapping unique embeddings to full works dataset ...")
        desc_to_idx = {d: i for i, d in enumerate(unique_descs)}
        full_indices = [desc_to_idx[d] for d in df["description"]]
        embeddings = unique_embeddings[full_indices]

        np.save(emb_path, embeddings)
        if ckpt_path.exists():
            try:
                ckpt_path.unlink()
            except OSError:
                pass
        print(f"  Duplicate: Saved full embeddings cache to {emb_path}, shape: {embeddings.shape}")

    # Map work_id -> index
    df["embedding_idx"] = np.arange(len(df))

    # ── 3. Pairwise cosine similarity within each district (Two-Tier Evaluation) ───
    all_pairs = []       # list of dicts for duplicate_pairs table
    work_tier1_max_sim = np.zeros(len(df), dtype=np.float32)
    work_tier1_match_wid = np.zeros(len(df), dtype=np.int64)
    work_tier1_match_amt = np.zeros(len(df), dtype=np.float64)
    work_tier1_cap = np.ones(len(df), dtype=np.float32)
    work_tier1_capped_sim = np.zeros(len(df), dtype=np.float32)

    work_tier2_max_sim = np.zeros(len(df), dtype=np.float32)
    work_tier2_match_wid = np.zeros(len(df), dtype=np.int64)
    work_tier2_match_amt = np.zeros(len(df), dtype=np.float64)

    amts_all = df["sanctioned_amt"].fillna(0.0).values

    print(f"  Duplicate: Computing pairwise similarity across {df['district'].nunique()} districts ...")

    total_pairs_count = 0
    for district, group in df.groupby("district"):
        if len(group) < 2:
            continue

        idx = group["embedding_idx"].values
        wids = group["work_id"].values
        amts = amts_all[idx]

        # Compute cosine similarity matrix for this district (shape k x k)
        district_embeddings = embeddings[idx]
        sim_matrix = district_embeddings @ district_embeddings.T
        np.fill_diagonal(sim_matrix, 0.0)

        n = len(group)
        for i_loc in range(n):
            sims_i = sim_matrix[i_loc]
            matches = np.where(sims_i >= SIMILARITY_THRESHOLD)[0]
            if len(matches) == 0:
                continue

            amt_i = amts[i_loc]
            for j_loc in matches:
                sim_val = float(sims_i[j_loc])

                # FIX: Require character-level identity to exclude boilerplate templates 
                # where only the specific village/location string differs.
                import difflib
                char_ratio = difflib.SequenceMatcher(None, group["description"].iloc[i_loc], group["description"].iloc[j_loc]).ratio()
                if char_ratio < 0.98:
                    continue

                desc_len = max(len(str(group["description"].iloc[i_loc])), len(str(group["description"].iloc[j_loc])))
                if desc_len < 30:
                    cap = 0.60
                elif desc_len < 60:
                    cap = 0.75
                else:
                    cap = 1.0

                amt_j = amts[j_loc]
                max_amt = max(amt_i, amt_j)
                amt_diff_pct = (abs(amt_i - amt_j) / max_amt) if max_amt > 0 else 0.0

                if amt_diff_pct <= 0.05:
                    # Tier 1 (High Confidence Duplicate / Split Tendering within 5% budget)
                    if sim_val > work_tier1_max_sim[idx[i_loc]]:
                        work_tier1_max_sim[idx[i_loc]] = sim_val
                        work_tier1_match_wid[idx[i_loc]] = wids[j_loc]
                        work_tier1_match_amt[idx[i_loc]] = amt_j
                        work_tier1_cap[idx[i_loc]] = cap
                else:
                    # Tier 2 (Template Match / Manual Review, budget differs > 5%)
                    if sim_val > work_tier2_max_sim[idx[i_loc]]:
                        work_tier2_max_sim[idx[i_loc]] = sim_val
                        work_tier2_match_wid[idx[i_loc]] = wids[j_loc]
                        work_tier2_match_amt[idx[i_loc]] = amt_j

            # Extract pairs for duplicate_pairs table (only j > i)
            matches_upper = np.where(sim_matrix[i_loc, i_loc + 1:] >= SIMILARITY_THRESHOLD)[0] + (i_loc + 1)
            
            # Filter matches_upper by char_ratio as well
            valid_upper = []
            for m_loc in matches_upper:
                char_r = difflib.SequenceMatcher(None, group["description"].iloc[i_loc], group["description"].iloc[m_loc]).ratio()
                if char_r >= 0.98:
                    valid_upper.append(m_loc)

            if len(valid_upper) > 0:
                total_pairs_count += len(valid_upper)
                valid_upper_arr = np.array(valid_upper)
                sorted_matches = valid_upper_arr[np.argsort(-sim_matrix[i_loc, valid_upper_arr])][:3]
                wid_a = int(wids[i_loc])
                for m_loc in sorted_matches:
                    wid_b = int(wids[m_loc])
                    sim = float(sim_matrix[i_loc, m_loc])
                    all_pairs.append({
                        "work_id_a": wid_a,
                        "work_id_b": wid_b,
                        "similarity_score": round(sim, 4),
                    })

    # ── 4. Build two-tier flag reasons ────────────────────────────────────
    tier1_mask = work_tier1_max_sim >= SIMILARITY_THRESHOLD
    tier2_mask = (~tier1_mask) & (work_tier2_max_sim >= SIMILARITY_THRESHOLD)

    flag_rows = []

    # Tier 1: High confidence duplicate or split tender (within 5% budget)
    for i in np.where(tier1_mask)[0]:
        wid = int(df["work_id"].iloc[i])
        matched_wid = int(work_tier1_match_wid[i])
        matched_amt = float(work_tier1_match_amt[i])
        raw_sim = float(work_tier1_max_sim[i])
        cap = float(work_tier1_cap[i])
        sim = min(raw_sim, cap)
        
        if cap == 0.60:
            reason = f"Possible batch entry ({raw_sim:.0%} match) — description too short to confirm distinct location. Human review required. (Matched Work #{matched_wid}, Rs {matched_amt:,.0f})."
        elif cap == 0.75:
            reason = f"Likely template match ({raw_sim:.0%} match) — description moderately short. (Matched Work #{matched_wid}, Rs {matched_amt:,.0f})."
        else:
            reason = f"High-confidence duplicate text match ({raw_sim:.0%}) with matching budget (within 5%) in same district (Work ID #{matched_wid}, Rs {matched_amt:,.0f})."
            
        work_tier1_capped_sim[i] = sim
        flag_rows.append({
            "work_id": wid,
            "source": "duplicate_model",
            "reason_text": reason,
        })

    # Tier 2: Template match, needs manual review (budget differs > 5%)
    for i in np.where(tier2_mask)[0]:
        wid = int(df["work_id"].iloc[i])
        matched_wid = int(work_tier2_match_wid[i])
        matched_amt = float(work_tier2_match_amt[i])
        sim = float(work_tier2_max_sim[i])
        reason = (
            f"Possible boilerplate template match ({sim:.0%}) with another work in same district "
            f"(Work ID #{matched_wid}), but budget differs (needs manual review)."
        )
        flag_rows.append({
            "work_id": wid,
            "source": "template_match",
            "reason_text": reason,
        })

    print(f"  Duplicate: {tier1_mask.sum():,d} Tier 1 high-confidence works flagged ({tier1_mask.sum()/len(df):.2%})")
    print(f"  Duplicate: {tier2_mask.sum():,d} Tier 2 template-match works flagged ({tier2_mask.sum()/len(df):.2%})")
    print(f"  Duplicate: {len(flag_rows):,d} total flag rows to insert")

    # ── 5. Write to DB (batched) ──────────────────────────────────────────
    print("  Duplicate: Writing flags and duplicate_pairs to Supabase PostgreSQL ...")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM flags WHERE source IN ('duplicate_model', 'template_match')"))
        conn.execute(text("DELETE FROM duplicate_pairs"))

    if flag_rows:
        flags_df = pd.DataFrame(flag_rows)
        flags_df.to_sql("flags", engine, if_exists="append", index=False, chunksize=5000, method="multi")

    if all_pairs:
        pairs_df = pd.DataFrame(all_pairs)
        pairs_df.to_sql("duplicate_pairs", engine, if_exists="append", index=False, chunksize=5000, method="multi")

    print(f"  Duplicate: {len(flag_rows):,d} flag rows + {len(all_pairs):,d} pair rows written to DB")

    # ── 6. Build per-work scores for risk_scorer ──────────────────────────
    # ONLY Tier 1 (high confidence duplicate / split tendering) contributes to duplicate_score!
    # Tier 2 works receive 0.0 duplicate_score so they don't inflate risk score or mislead judges.
    scores = {}
    for i in range(len(df)):
        wid = int(df["work_id"].iloc[i])
        if tier1_mask[i]:
            scores[wid] = min(float(work_tier1_capped_sim[i]), 1.0)
        else:
            scores[wid] = 0.0

    return scores


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    db_url = _load_env()
    engine = create_engine(db_url)

    print("Running Duplicate-Work Detector (F4) ...")
    scores = run_duplicate_detector(engine)

    print(f"\n[OK] Duplicate Detector complete. Scores computed for {len(scores)} works.")

    # Show top 5 highest duplicate scores
    if scores:
        top5 = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:5]
        print("\nTop 5 most likely duplicates (by duplicate_score):")
        for work_id, score in top5:
            print(f"  Work #{work_id}: duplicate_score = {score:.4f}")

    # Show a sample pair
    with engine.connect() as conn:
        sample = pd.read_sql(
            text("SELECT * FROM duplicate_pairs ORDER BY similarity_score DESC LIMIT 3"),
            conn,
        )
    if not sample.empty:
        print("\nTop 3 duplicate pairs:")
        print(sample[["work_id_a", "work_id_b", "similarity_score"]].to_string(index=False))

    engine.dispose()


if __name__ == "__main__":
    main()
