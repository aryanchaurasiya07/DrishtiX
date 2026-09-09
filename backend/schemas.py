"""
Pydantic request/response schemas for the API (PRD Section 11).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    scope: dict  # e.g. {"mp_id": 42} or {"district": "..."} or {"state": "..."} or {}


# ---------------------------------------------------------------------------
# Works
# ---------------------------------------------------------------------------

class WorkListItem(BaseModel):
    id: int
    mp_id: Optional[int] = None
    category: str
    mp_name: Optional[str] = None
    agency_name: Optional[str] = None
    district: str
    state: str
    risk_band: Optional[str] = None
    risk_score: Optional[float] = None
    top_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class FlagOut(BaseModel):
    id: int
    source: str
    reason_text: str

    model_config = {"from_attributes": True}


class DuplicatePairOut(BaseModel):
    id: int
    work_id_a: int
    work_id_b: int
    similarity_score: float

    model_config = {"from_attributes": True}


class RiskScoreOut(BaseModel):
    cost_score: Optional[float] = None
    duplicate_score: Optional[float] = None
    delay_score: Optional[float] = None
    risk_score: Optional[float] = None
    risk_band: Optional[str] = None

    model_config = {"from_attributes": True}


class WorkDetail(BaseModel):
    id: int
    mp_id: Optional[int] = None
    agency_id: Optional[int] = None
    agency_name: Optional[str] = None
    category: str
    description: Optional[str] = None
    state: str
    district: str
    sanctioned_amt: Optional[float] = None
    released_amt: Optional[float] = None
    expenditure: Optional[float] = None
    sanction_date: Optional[date] = None
    expected_completion: Optional[date] = None
    actual_completion: Optional[date] = None
    status: str
    risk_scores: Optional[RiskScoreOut] = None
    flags: list[FlagOut] = []
    duplicate_pairs: list[DuplicatePairOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Risk-ranked
# ---------------------------------------------------------------------------

class RiskRankedItem(BaseModel):
    id: int
    category: str
    district: str
    state: str
    risk_score: float
    risk_band: str
    top_reason: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

class CategoryBreakdown(BaseModel):
    category: str
    flagged_count: int


class TrendPoint(BaseModel):
    month: str  # "YYYY-MM"
    flagged_count: int


class DashboardSummary(BaseModel):
    total_works: int
    flagged_count: int
    batch_entry_review_count: int = 0
    avg_risk_score: float
    red_count: int = 0
    amber_count: int = 0
    green_count: int = 0
    insufficient_data_count: int = 0
    fund_utilisation_pct: Optional[float] = None
    category_breakdown: list[CategoryBreakdown] = []
    trend: list[TrendPoint] = []


# ---------------------------------------------------------------------------
# Paginated response wrapper
# ---------------------------------------------------------------------------

class PaginatedWorks(BaseModel):
    items: list[WorkListItem]
    total_count: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Coverage / Data Quality
# ---------------------------------------------------------------------------

class DataGap(BaseModel):
    field: str
    missing_count: int
    missing_pct: float


class StateCoverage(BaseModel):
    state: str
    total_works: int
    measurable_count: int
    measurable_pct: float


class CoverageSummary(BaseModel):
    total_works: int
    measurable_count: int
    partially_measurable_count: int
    not_measurable_count: int
    gaps: list[DataGap] = []
    band_distribution: dict = {}
    state_coverage: list[StateCoverage] = []

class DistrictHeatmapStats(BaseModel):
    district: str
    total_count: int
    flagged_count: int
    avg_risk_score: float

    model_config = {"from_attributes": True}
