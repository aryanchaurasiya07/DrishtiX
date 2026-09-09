# Product Requirements Document
## AI-Powered Anomaly, Fraud & Inefficiency Detection System for MPLADS

| | |
|---|---|
| **Problem Statement ID** | 26102 |
| **Organization** | Ministry of Statistics & Programme Implementation (MoSPI) |
| **Event** | Smart India Hackathon 2026 |
| **Team** | Dead Neurons |
| **Document Version** | 1.0 (Final — supersedes both reference documents for build purposes) |
| **Date** | 1 September 2026 |
| **Submission Deadline** | 20 September 2026 |
| **Status** | Approved for development — single source of truth |
| **Source documents reconciled** | (1) "MPLADS AI Roadmap" — general roadmap; (2) "MPLADS AI Solution Brief" — Dead Neurons technical plan. Where they conflicted, this PRD adopts the more implementation-ready choice, noted inline. |

---

## 1. Executive Summary

We are building a working software prototype — not a report — that ingests MPLADS work-level data (sanctions, expenditure, progress, payments) and automatically surfaces a short, prioritized, explainable list of works that look like cost overruns, duplicate works, or abnormal delays. Four role-scoped dashboards (MP, District Authority, State Nodal Authority, Ministry) let each user see only what's relevant to them, with every flagged item backed by a plain-language reason a non-technical official can act on.

The system is intentionally narrow: **three detectors, one rules engine, one combined risk score.** Every feature beyond that is explicitly deferred (Section 4). This document is the single source of truth for all five workstreams — Backend, ML, AI/Explainability, Frontend, and QA/Domain — for the remainder of the build.

---

## 2. Problem Statement, Condensed

MPLADS lets ~800 MPs recommend local development works, funded and tracked through District Authorities, Implementing Agencies, and the eSAKSHI portal. At this scale, manual review cannot catch every cost overrun, duplicate work, or stalled project. The Ministry wants an **auditable, role-aware early-warning system** that turns thousands of unreviewed records into a short "look at this one" list — not a novel research model, and not a black box. Every flag must be explainable well enough to survive an audit question.

---

## 3. Goals & Non-Goals

**Goals**
- Detect the three highest-frequency, most provable fraud/inefficiency patterns: cost overruns, duplicate works, abnormal delays.
- Make every flag explainable in plain language, not just a score.
- Give four different official roles a dashboard scoped to their own jurisdiction, with zero cross-role data leakage.
- Ship a working, deployable, end-to-end prototype — not slides — by the deadline.

**Non-Goals (for this build)**
- Proving fraud with legal certainty. The system produces **investigation priorities**, not verdicts.
- Real-time streaming ingestion. Batch ingestion is sufficient.
- National-scale production infrastructure. This is a demo-scale prototype on free/low-cost infrastructure.

---

## 4. Scope Definition

### 4.1 MVP — Must Have (build this, nothing more, until it all works end-to-end)

| # | Item |
|---|---|
| 1 | CSV ingestion + cleaning pipeline (Dataful.in 17th Lok Sabha dataset as primary source) |
| 2 | PostgreSQL schema: `works`, `mps`, `agencies`, `users`, `risk_scores`, `flags`, `duplicate_pairs`, `category_baselines` |
| 3 | **Cost-Overrun Detector** (Isolation Forest + category deviation score) |
| 4 | **Duplicate-Work Detector** (Sentence-BERT `all-MiniLM-L6-v2` + cosine similarity, same-district pairing) |
| 5 | **Delay Detector** (median-per-category baseline; ML/Prophet only if time remains) |
| 6 | Rules engine (per-MP annual cap, per-category cost ceiling, max timeline) running alongside the ML detectors |
| 7 | Combined **Risk Score (0–100)** with Green/Amber/Red banding |
| 8 | Explainability: SHAP-backed detector scores + a short LLM-generated plain-language sentence per flagged work |
| 9 | FastAPI backend with JWT auth, 4 roles (mp / district / state / ministry), server-side row-level scope filtering |
| 10 | 4 role-based React dashboards: Ministry, State, District, MP |
| 11 | Leaflet risk heat map (district-level) on Ministry and State views |
| 12 | Synthetic data top-up (Faker) with 3–5% deliberately injected anomalies, used only where real data is thin |
| 13 | Dockerized deployment to a public demo URL |

### 4.2 Post-MVP (build only after every MVP item above works end-to-end; do not start early)

| # | Item | Why deferred |
|---|---|---|
| 1 | Reviewer feedback / case status ("confirmed" / "false alarm") | Not needed to prove detection works; adds a write-workflow and audit trail scope |
| 2 | Chat-style Q&A over the data (LangChain agent) | Nice demo polish, not core to the Ministry's stated ask |
| 3 | PDF/Excel export of flagged-work reports | Pure convenience feature |
| 4 | Email alert on new high-risk flag | Needs a scheduler; out of scope for a batch-run demo |
| 5 | Agency drill-down endpoint/view (`/agencies/{id}/works`) | Useful but not required to demonstrate the three core detectors |
| 6 | Fund-utilisation-pattern detector (year-end spending spikes) | A 4th detector — explicitly excluded to protect the 3-detector scope lock |

### 4.3 Future Scope (not part of this hackathon build in any form)

| # | Item | Why excluded |
|---|---|---|
| 1 | Vendor/contractor payment-network fraud (NetworkX graph analysis) | Needs a richer payments dataset than is publicly available |
| 2 | Ghost/fake-asset detection via geo-tagged photo verification | Needs an image + GPS metadata pipeline |
| 3 | Human-in-the-loop labelled dataset (reviewer confirmations feeding a supervised model) | Requires months of production usage to accumulate labels |
| 4 | Airflow-based scheduling / continuous ingestion | Requires production infrastructure |
| 5 | Multi-language dashboard support | Not needed to demonstrate the core system |
| 6 | Official eSAKSHI data-sharing integration | Requires Ministry approval, outside hackathon control |
| 7 | SSO / Google Cloud IAM-grade auth hardening | Appropriate only at real deployment scale |

> **Scope discipline rule:** if a team member wants to add anything not in Section 4.1, it goes into 4.2 or 4.3 and is not built until every MVP item is done and demo-ready.

---

## 5. User Roles & Personas

| Role | Who they are | What they can see | Primary need |
|---|---|---|---|
| **MP** | The Member of Parliament or their office staff | Only their own constituency's works | "Is anything in my constituency flagged, and why?" |
| **District Authority** | District-level sanctioning officer | All works in their district, across all MPs/agencies in it | "Which works in my district need a second look?" |
| **State Nodal Authority** | State-level MPLADS coordinator | All districts in their state, agency comparisons | "Which districts/agencies in my state are outliers?" |
| **Ministry (MoSPI)** | National oversight | Everything, nationally | "Where should national audit attention go this month?" |

No "citizen/public" role in MVP — this is an internal oversight tool, not a public transparency portal (that's a reasonable Future Scope item, not built now).

---

## 6. User Flows

### 6.1 Common: Login & Auth
1. User opens the app → login screen (username + password).
2. `POST /auth/login` validates credentials, returns a JWT containing `role` and a `scope` claim (`mp_id`, `district`, or `state`, depending on role; `null`/unrestricted for `ministry`).
3. Frontend stores the token, redirects to the dashboard matching the role in the token. Users can never manually switch role/scope client-side — every API call is filtered server-side by the token's claims regardless of what the UI requests.

### 6.2 Ministry Flow
1. Lands on **Ministry Dashboard**: national KPI cards (works scanned, % flagged, high-risk count) + Leaflet map of all districts, colored by aggregate risk band.
2. Clicks a district on the map → drills into that district's work list (reuses the District dashboard view, scoped by map selection, not by login).
3. Clicks "Top Flagged Works" table row → **Work Detail** panel opens.
4. Work Detail shows: work metadata, Risk Score badge (color + text label), the three sub-scores, the plain-language reason list, and — if flagged as a duplicate — a link to the paired work.
5. Closes panel, optionally views the "flagged cases over time" trend chart.

### 6.3 State Nodal Authority Flow
1. Lands on **State Dashboard**, pre-scoped to their state only (enforced server-side).
2. Sees a district-comparison bar chart (works count / flagged count per district) and an implementing-agency comparison chart.
3. Drills into a district or a specific flagged work exactly as in the Ministry flow, but can never leave their own state's data — attempting to via a crafted API call returns `403`.

### 6.4 District Authority Flow
1. Lands on **District Dashboard**, scoped to their district only.
2. Sees the full works list for the district with filter/sort by category, status, risk band.
3. Opens Work Detail for any flagged item, same panel as above.

### 6.5 MP Flow
1. Lands on **MP Dashboard**, scoped to their own `mp_id` only.
2. Sees their fund-utilisation summary (released / sanctioned, as a simple percentage — a display metric, not a detector), their works list, and any flagged items with the plain-language reason shown inline (MPs are the least likely to read a SHAP chart — the LLM sentence is the primary explanation surface here).

---

## 7. System Architecture — Final Stack

Reconciling both reference documents: the Solution Brief's production-grade stack is adopted as-is, with one infrastructure fix (Postgres hosting) and one addition (the LLM explanation layer) carried over from the Roadmap document.

| Layer | Technology | Source decision |
|---|---|---|
| Ingestion | Python + pandas | Both docs agreed |
| Database | PostgreSQL, hosted on **Supabase or Neon** (not Render's Postgres — it expires after 30 days) | Brief's schema choice + Roadmap's hosting fix |
| ML preprocessing | scikit-learn | Both docs agreed |
| Cost-overrun model | `sklearn.ensemble.IsolationForest` + category z-score | Brief (named implementation) |
| Duplicate model | `sentence-transformers` `all-MiniLM-L6-v2`, cosine similarity | Brief (named model) |
| Delay model | Median-per-category baseline (Prophet only if time allows) | Brief |
| Rules engine | Plain Python functions returning `(bool, reason)` | Brief |
| Explainability | SHAP (technical) + short LLM rewrite pass, free Gemini Flash API (plain-language) | Hybrid — Brief's SHAP + Roadmap's LLM layer |
| Backend | FastAPI + SQLAlchemy + JWT (`python-jose`, `passlib`) | Brief |
| Frontend | React + Vite + Tailwind CSS + Recharts + react-leaflet | Brief |
| Deployment | Docker; backend/frontend on Render free web-service tier; DB on Supabase/Neon | Brief + Roadmap fix |
| Excluded from stack | Airflow, NetworkX, LangChain/agent chatbot, Streamlit | Explicitly out of MVP scope (Section 4) |

**Data flow:** CSV/synthetic data → pandas cleaning → PostgreSQL → detectors read from `works` + `category_baselines` → write to `risk_scores` + `flags` + `duplicate_pairs` → FastAPI serves role-filtered reads → React dashboards render.

---

## 8. Feature Specifications

| Module | Description | Owner (see Section 18) |
|---|---|---|
| **F1 — Ingestion Pipeline** | `load_data.py`: reads Dataful.in CSV, standardises column names/dates/amounts, drops invalid rows, tops up with synthetic Faker records where a field (e.g. free-text description) is too thin for a detector to work on. Writes to Postgres via `df.to_sql()`. | Backend/Data Engineer |
| **F2 — Category Baselines** | Precomputed lookup table: median cost, cost std-dev, and median duration per work category. Detectors read from this instead of recomputing on every request. | ML Engineer |
| **F3 — Cost-Overrun Detector** | See Section 9.1 | ML Engineer |
| **F4 — Duplicate-Work Detector** | See Section 9.2 | ML Engineer |
| **F5 — Delay Detector** | See Section 9.3 | ML Engineer |
| **F6 — Rules Engine** | See Section 9.4 | ML Engineer |
| **F7 — Risk Scoring** | See Section 9.5 | ML Engineer |
| **F8 — Explainability Layer** | See Section 9.6 | AI/Agent Engineer |
| **F9 — Auth & RBAC** | Login endpoint, JWT issuance, role/scope enforcement middleware applied to every data-returning endpoint | Backend Engineer |
| **F10 — Core API** | `/works`, `/works/{id}`, `/risk-ranked`, `/dashboard/summary` — see Section 11 | Backend Engineer |
| **F11 — Ministry Dashboard** | KPI cards, national heat map, top-flagged table, trend chart | Frontend Engineer |
| **F12 — State Dashboard** | State-scoped map, district comparison chart, agency comparison chart | Frontend Engineer |
| **F13 — District Dashboard** | District-scoped works table with filters | Frontend Engineer |
| **F14 — MP Dashboard** | Constituency-scoped works list, fund-utilisation %, inline reasons | Frontend Engineer |
| **F15 — Work Detail Panel** | Shared component across all 4 dashboards: full work info, risk badge, sub-scores, reasons, duplicate link | Frontend Engineer |
| **F16 — Deployment** | Dockerfiles per service, deployed to Render + Supabase/Neon | Backend Engineer |

---

## 9. ML / AI Logic

### 9.1 Cost-Overrun Detector
- **Input features:** `sanctioned_amt` (or `expenditure` if available), `category`, `district`.
- **Step 1 (statistical):** `deviation_score = (work_cost − category_median_cost) / category_std_cost`.
- **Step 2 (model):** `IsolationForest(contamination=0.05)` fit on `[normalized_cost, normalized_duration]` per category; outputs an anomaly score per work.
- **Combined cost score:** normalize both to 0–1 and average them.
- **Flag threshold:** `deviation_score > 2.0` **or** Isolation Forest anomaly score in the top 5% → flagged, with reason text e.g. *"Sanctioned amount is ~3.2× the median for [category] works in this district."*

### 9.2 Duplicate-Work Detector
- **Input:** `description` field (title + free-text description).
- **Model:** `SentenceTransformer('all-MiniLM-L6-v2')` — embed every work's description.
- **Comparison scope:** only compare works **within the same district** (avoids an O(n²) national comparison and avoids false positives across unrelated regions).
- **Threshold:** cosine similarity `> 0.85` → both works written to `duplicate_pairs` and flagged, with reason text e.g. *"92% text match with another sanctioned work in the same district (Work ID #4471)."*

### 9.3 Delay Detector
- **Baseline:** median completion duration per category, from `category_baselines`.
- **Rule:** if `status = 'ongoing'` and `(today − sanction_date) > 1.5 × category_median_duration` → flagged, with reason text e.g. *"This work has been ongoing for 420 days; similar works typically finish in 210 days."*
- Prophet-based forecasting is **optional, time-permitting only** — the median baseline is sufficient for MVP and is explicitly preferred under time pressure.

### 9.4 Rules Engine
Independent of the ML models — hard-coded MPLADS norms, each a pure function returning `(triggered: bool, reason: str)`:
- Per-MP annual fund cap (₹5 crore/year) exceeded.
- Category cost ceiling exceeded (derived from the data's own 95th percentile per category, not an assumed number).
- Maximum allowed timeline per category exceeded regardless of ML delay score (a hard-coded fallback in case the ML detector misses it).

All triggered rule reasons are appended to the same `flags` table as the ML-generated ones — the dashboard does not distinguish source to the end user; it distinguishes it internally (`source` column) for QA/testing.

### 9.5 Risk Scoring — Combination Logic
```
cost_component      = normalize(cost_score)        # 0–1
duplicate_component = normalize(duplicate_score)    # 0–1
delay_component      = normalize(delay_score)        # 0–1

risk_score (0–100) = 100 × (
    0.40 × cost_component +
    0.30 × duplicate_component +
    0.30 × delay_component
)
```
Weights are intentionally simple (40/30/30) so they are explainable to a non-technical judge or official — this is a deliberate design choice, not a simplification of a "real" model. Rule-engine triggers do **not** change the numeric risk score; they add independent reasons and, if any hard rule is triggered, force a minimum band of **Amber** regardless of the numeric score (a rule violation should never be silently outscored by a low ML score).

**Risk bands:**
| Score | Band | Color | Text label (always shown alongside color) |
|---|---|---|---|
| 0–39 | Low | Green | "Low risk" |
| 40–70 | Medium | Amber | "Needs review" |
| 71–100 | High | Red | "High priority" |

> UX requirement: never rely on color alone for the risk badge — colorblind users must be able to read the band from the text label. This applies to every dashboard.

### 9.6 Explainability Layer
- **SHAP:** attached to the `IsolationForest` cost model to show per-feature contribution — stored for the QA/demo team to reference if a judge asks "how do you know this isn't just a big project?"
- **LLM rewrite pass (the one addition from the Roadmap document):** once the rules engine and all three detectors have produced their `reason` strings for a work, a single free Gemini Flash API call rewrites the combined list into **one plain-language sentence**, e.g. *"This road work was flagged because it costs over three times similar projects nearby and has been listed as unfinished for more than a year."* This is a rewrite step only — it does not generate new findings, does not run per-request (batch-generated once per detection run), and has no conversational/chat capability in MVP (that's Post-MVP, Section 4.2).
- API key for the LLM call lives server-side only, in an environment variable — never shipped to the frontend.

---

## 10. Database Schema

```sql
-- Reference / master data
CREATE TABLE mps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    house VARCHAR(20) NOT NULL,        -- 'Lok Sabha' | 'Rajya Sabha'
    constituency VARCHAR(150),
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL
);

CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    district VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL
);

-- Core fact table
CREATE TABLE works (
    id SERIAL PRIMARY KEY,
    mp_id INTEGER REFERENCES mps(id),
    agency_id INTEGER REFERENCES agencies(id),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    sanctioned_amt NUMERIC(14,2),
    released_amt NUMERIC(14,2),
    expenditure NUMERIC(14,2),
    sanction_date DATE,
    expected_completion DATE,
    actual_completion DATE,
    status VARCHAR(20) NOT NULL,        -- 'sanctioned' | 'ongoing' | 'completed'
    created_at TIMESTAMP DEFAULT now()
);

-- Precomputed detector inputs
CREATE TABLE category_baselines (
    category VARCHAR(100) PRIMARY KEY,
    median_cost NUMERIC(14,2),
    std_cost NUMERIC(14,2),
    median_duration_days INTEGER
);

-- Detector outputs
CREATE TABLE risk_scores (
    work_id INTEGER PRIMARY KEY REFERENCES works(id),
    cost_score FLOAT,
    duplicate_score FLOAT,
    delay_score FLOAT,
    risk_score FLOAT,                   -- 0–100
    risk_band VARCHAR(10),              -- 'green' | 'amber' | 'red'
    computed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE flags (
    id SERIAL PRIMARY KEY,
    work_id INTEGER REFERENCES works(id),
    source VARCHAR(20) NOT NULL,        -- 'rule' | 'cost_model' | 'duplicate_model' | 'delay_model' | 'llm_summary'
    reason_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE duplicate_pairs (
    id SERIAL PRIMARY KEY,
    work_id_a INTEGER REFERENCES works(id),
    work_id_b INTEGER REFERENCES works(id),
    similarity_score FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,          -- 'mp' | 'district' | 'state' | 'ministry'
    mp_id INTEGER REFERENCES mps(id),   -- set only if role = 'mp'
    district VARCHAR(100),              -- set if role = 'district'
    state VARCHAR(100),                 -- set if role = 'district' or 'state'
    created_at TIMESTAMP DEFAULT now()
);
```

**Design notes for the Backend Engineer:**
- `risk_scores` is one-to-one with `works` for MVP (each detection run overwrites, doesn't version). Historical score tracking is Post-MVP.
- `flags` is one-to-many — a single work can carry multiple reasons from multiple sources.
- `duplicate_pairs` is intentionally separate from `flags` because it's a relationship between two works, not a property of one.

---

## 11. API Requirements

| Method | Path | Auth | Query / Body | Response | Notes |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | None | `{username, password}` | `{access_token, role, scope}` | Issues JWT; `passlib` bcrypt check |
| `GET` | `/works` | JWT | `state, district, category, risk_band, page, page_size` | Paginated list: `id, category, mp_name, district, risk_band, risk_score` | Server auto-applies role scope filter — query params **narrow** within scope, never widen beyond it |
| `GET` | `/works/{id}` | JWT | — | Full work record + `risk_scores` + `flags[]` + `duplicate_pairs` (if any) | 403 if `id` is outside caller's scope |
| `GET` | `/risk-ranked` | JWT | `scope, limit` | Top-N works by `risk_score` desc, within caller's scope | Powers the "Top Flagged Works" table |
| `GET` | `/dashboard/summary` | JWT | `scope=mp\|district\|state\|ministry`, `scope_id` | `{total_works, flagged_count, avg_risk_score, fund_utilisation_pct, category_breakdown[], trend[]}` | One endpoint, reused by all 4 dashboards with different scope params |

**Auth enforcement rule (applies to every endpoint above except `/auth/login`):** the JWT's `role` + `scope` claims are the only source of truth for what data a request can return. Query parameters can filter *within* that scope but can never be used to request data outside it — this must be enforced in the FastAPI dependency layer, not just hidden in the frontend UI. This is the single most important security requirement in this document (Section 13).

---

## 12. Dashboard Requirements

### 12.1 Shared UX principles (all 4 dashboards)
- Every risk badge shows **color + text label** together (accessibility — Section 9.5).
- Every flagged work's plain-language reason (from Section 9.6) is shown **before** the technical sub-scores, not after — officials should read the sentence first, the numbers second.
- Layout pattern is consistent across all 4 views: **KPI row → main visual (map or chart) → filterable table → detail panel on row click.** Reusing one layout pattern means the Frontend Engineer builds one `DashboardShell` component and passes different data/widgets into it, rather than four unrelated pages.

### 12.2 Per-role dashboard content

| Role | KPI row | Main visual | Table | Detail panel |
|---|---|---|---|---|
| Ministry | Works scanned, % flagged, high-risk count, states covered | National Leaflet heat map, districts colored by aggregate risk band | Top-N flagged works nationally | Full work detail (Section 6.2) |
| State | Works in state, % flagged, districts covered | State-scoped map + district-comparison bar chart + agency-comparison bar chart | Flagged works in state | Same shared component |
| District | Works in district, % flagged | Category breakdown chart | Full works list for district, filterable by category/status/risk band | Same shared component |
| MP | Fund utilisation % (released/sanctioned), works count, flagged count | Simple bar: sanctioned vs. released vs. expenditure | Own constituency's works, flagged items highlighted | Same shared component, reasons shown inline without needing a click |

---

## 13. Security Requirements

1. **Row-level access control is server-side, not UI-side.** Every data endpoint checks the JWT's `role`/`scope` before querying — never trust a frontend-supplied scope parameter.
2. Passwords stored as bcrypt hashes (`passlib`) — never plaintext, never reversible encryption.
3. LLM API key (Section 9.6) stored in a server-side environment variable, never in frontend code or committed to the repo.
4. JWT secret key stored server-side only, rotated if leaked; tokens expire (recommend 8-hour expiry for a demo).
5. CORS restricted to the deployed frontend origin only, not `*`.
6. No PII beyond what MPLADS already makes public (MP names, agency names) is stored or displayed — no citizen personal data is part of this system.
7. All traffic over HTTPS in the deployed demo (Render provides this by default).

---

## 14. Non-Functional Requirements

| Requirement | Target for MVP demo |
|---|---|
| Dataset size | 2,000–5,000 work records (real + synthetic top-up) |
| Dashboard load time | Under 3 seconds on the demo dataset |
| Browser support | Latest Chrome/Edge (judges' likely environment) — no legacy browser support needed |
| Concurrent users | Demo-scale only (a handful of simultaneous judge/team sessions); no load-testing required |
| Accessibility | Risk bands never rely on color alone (Section 9.5); minimum readable contrast on all charts |
| Scalability | Explicitly out of scope for MVP — mention as a "production roadmap" line in the pitch, not something to build |

---

## 15. Testing & QA Plan

| Test type | What to check | Owner |
|---|---|---|
| Unit — detectors | Known synthetic input with a planted anomaly returns a flag; a known-normal work does not | ML Engineer |
| Unit — rules engine | Each rule function triggers correctly on boundary values (e.g. exactly at the ₹5 crore cap) | ML Engineer |
| Integration | Full pipeline run: CSV → Postgres → detectors → API → all 4 dashboards show correct, correctly-scoped data | Backend + QA Lead |
| Security | An MP-role token cannot retrieve another MP's `work_id` via `/works/{id}` (expect `403`) | QA Lead |
| UI acceptance | Each of the 4 dashboards renders its full widget set with the demo dataset, risk badges show color + label | Frontend + QA Lead |
| Explainability spot-check | Every flagged work in the final demo dataset has a non-empty, human-readable reason sentence | AI/Agent Engineer + QA Lead |

---

## 16. Acceptance Criteria (Definition of Done)

- [ ] Given a work costing more than 2 standard deviations above its category median, the system flags it and displays a reason naming the deviation.
- [ ] Given two works in the same district with description cosine similarity > 0.85, both are flagged as a duplicate pair and the paired work is linked in the UI.
- [ ] Given an ongoing work exceeding 1.5× its category's median duration, the system flags it and shows days-overdue in the reason text.
- [ ] Every flagged work has a combined Risk Score (0–100), a color+label band, and at least one plain-language reason sentence.
- [ ] A rule-engine violation forces a minimum Amber band even if the numeric ML score alone would be Green.
- [ ] An MP-role user can only ever retrieve works belonging to their own `mp_id`, verified by an explicit denied-access test, not just UI hiding.
- [ ] All 4 dashboards load and render correctly against the full demo dataset in under 3 seconds.
- [ ] The full pipeline (CSV → DB → detectors → API → dashboard) runs start-to-finish without manual intervention.
- [ ] No API key or secret appears in any frontend-shipped code or in the public repo.

---

## 17. Development Phases & Timeline

Today is **1 September 2026**; the submission deadline is **20 September 2026** — roughly 19 days. Phases below are mapped to that calendar. If instead you end up compressing this into a single onsite sprint closer to the deadline, use the hour-budget in the right-hand column, in the same order.

| Phase | Calendar days | What ships | Hour-budget equivalent (if compressed to one sprint) |
|---|---|---|---|
| 1. Problem framing & data design | Sept 1–3 | Locked schema, Dataful.in dataset downloaded, synthetic top-up plan | Hrs 0–4 |
| 2. Data pipeline & storage | Sept 3–6 | Postgres live on Supabase/Neon, `load_data.py` working, `category_baselines` computed | Hrs 4–8 |
| 3. Detection models | Sept 6–10 | All 3 detectors + rules engine producing flags on real data | Hrs 8–16 |
| 4. Explainability | Sept 10–12 | SHAP attached, LLM rewrite pass producing plain-language sentences | Hrs 16–20 |
| 5. Backend API | Sept 10–13 (parallel with Phase 4) | FastAPI endpoints + JWT auth + role scoping, all tested | Hrs 20–24 |
| 6. Dashboards | Sept 12–17 | All 4 React dashboards wired to live API | Hrs 24–32 |
| 7. Integration, testing, demo polish | Sept 17–20 | Full pipeline run end-to-end, 3 demo cases selected, deck + impact slide ready | Hrs 32–36 |

> Phases 4 and 5 can run in parallel (different owners, different codebases) — this is the one place where calendar time can be compressed by running two workstreams simultaneously rather than sequentially.

---

## 18. Team Responsibilities (RACI)

| Person / Role | Primary ownership | Modules (Section 8) |
|---|---|---|
| Data/Backend Engineer | Ingestion, DB schema, FastAPI, deployment | F1, F9, F10, F16 |
| ML Engineer | All 3 detectors, rules engine, risk scoring, SHAP | F2–F7 |
| AI/Agent Engineer | LLM explanation rewrite pass; supports Backend on auth if needed | F8 |
| Frontend Engineer | All 4 dashboards + shared components | F11–F15 |
| Domain & QA Lead | MPLADS rule thresholds, test cases, acceptance testing, accuracy sanity-checks on real data | Testing (Section 15), Acceptance Criteria (Section 16) |
| Presentation Lead | Pitch deck, demo script, video, judge Q&A prep | Demo Flow (Section 19) |

**Hard rule:** nobody's agent/session touches another person's module folder. Merges to `main` happen at phase boundaries (Section 17), reviewed by the Domain & QA Lead.

---

## 19. Demo Flow

**Goal:** 4–5 minutes, live product, not slides-first.

1. **Open on Ministry Dashboard.** Say the one-line problem statement out loud while the heat map loads.
2. **Point to the heat map** — one or two districts should visibly be red/amber (from planted synthetic anomalies). Click one.
3. **Drill to a flagged work** → open Work Detail. Read the plain-language reason sentence aloud — this is the moment that shows the AI/LLM layer, not just a score.
4. **Show the sub-scores briefly** — cost/duplicate/delay breakdown — to demonstrate this isn't a black box.
5. **Switch to MP login** (different browser tab or logout/login) → show the same work, but now the dashboard is scoped only to that MP's constituency. This single moment proves the RBAC requirement (Section 13) live, which judges tend to test themselves if you don't show it.
6. **Close on the impact slide:** works scanned, % flagged, estimated manual-audit hours saved — one concrete number, not a vague claim.
7. **Reserve one planted example per detector** (cost, duplicate, delay) so any judge question about a specific pattern has a ready, on-screen answer.

---

## 20. Appendix

### 20.1 Glossary
- **MVP** — Minimum Viable Product: the smallest complete version that proves the idea.
- **RBAC** — Role-Based Access Control.
- **SHAP** — SHapley Additive exPlanations, a feature-attribution technique for ML models.
- **JWT** — JSON Web Token, a signed token used to prove identity/role on each API call.

### 20.2 Reference Documents
- *MPLADS AI Roadmap* (general zero-cost roadmap, contributed the LLM explanation-layer idea and the Supabase/Neon hosting fix adopted in Section 7).
- *MPLADS AI Solution Brief — Dead Neurons* (primary technical source for stack, schema direction, detector implementations, and the 3-detector scope lock).

### 20.3 Open Question for the Team
Confirm whether the 20 September deadline is a **remote submission** (favoring the calendar-day phase plan in Section 17) or an **onsite sprint** closer to that date (favoring the hour-budget column) — this changes how early Phases 3–6 can start in parallel versus sequentially.
