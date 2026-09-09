"""
MPLADS Anomaly Detection — FastAPI Application Entrypoint

Registers all routers, configures CORS locked to FRONTEND_ORIGIN.

Usage:
    uvicorn backend.main:app --reload --port 8000
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load env
_project_root = Path(__file__).resolve().parent.parent
for _name in (".env", ".env.txt"):
    _candidate = _project_root / _name
    if _candidate.exists():
        load_dotenv(_candidate, override=True)
        break

# Import routers
from backend.auth import router as auth_router
from backend.routers.works import router as works_router
from backend.routers.risk import router as risk_router
from backend.routers.dashboard import router as dashboard_router
from backend.routers.coverage import router as coverage_router


app = FastAPI(
    title="MPLADS Anomaly Detection API",
    description="AI-powered anomaly, fraud & inefficiency detection for MPLADS",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# CORS — locked to FRONTEND_ORIGIN, NOT '*' (PRD Section 13)
# ---------------------------------------------------------------------------

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------

app.include_router(auth_router)       # POST /auth/login
app.include_router(works_router)      # GET /works, GET /works/{id}
app.include_router(risk_router)       # GET /risk-ranked
app.include_router(dashboard_router)  # GET /dashboard/summary
app.include_router(coverage_router)   # GET /coverage/summary


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}
