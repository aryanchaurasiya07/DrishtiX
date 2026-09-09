"""
F10 — Dashboard Summary Router (PRD Section 11).

GET /dashboard/summary — single endpoint reused by all 4 dashboards.
Returns KPI metrics, category breakdown, and 6-month trend, all scoped.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, extract, case, Integer
from sqlalchemy.orm import Session

from backend.auth import CurrentUser, get_current_user
from backend.database import get_db
from backend.dependencies import apply_scope_filter
from backend.models import Work, RiskScore, Flag
from backend.schemas import DashboardSummary, CategoryBreakdown, TrendPoint, DistrictHeatmapStats

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    mp_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """
    GET /dashboard/summary
    One endpoint, all 4 roles — scope filtering determines what data is returned.
    """
    # ── Base scoped query ─────────────────────────────────────────────────
    base_query = db.query(Work)
    base_query = apply_scope_filter(base_query, user)

    if user.role == "mp" and mp_id is not None and mp_id != user.mp_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: cannot view another MP's dashboard",
        )

    if mp_id is not None:
        base_query = base_query.filter(Work.mp_id == mp_id)

    # ── Total works ───────────────────────────────────────────────────────
    total_works = base_query.count()

    # ── Flagged count (works that have at least one flag) ─────────────────
    scoped_work_ids = base_query.with_entities(Work.id).subquery()

    flagged_count = (
        db.query(func.count(RiskScore.work_id))
        .filter(RiskScore.work_id.in_(db.query(scoped_work_ids.c.id)))
        .filter(RiskScore.risk_band.in_(["amber", "red"]))
        .scalar()
    ) or 0
    
    batch_entry_review_count = (
        db.query(func.count(func.distinct(Flag.work_id)))
        .join(RiskScore, Flag.work_id == RiskScore.work_id)
        .filter(Flag.work_id.in_(db.query(scoped_work_ids.c.id)))
        .filter((Flag.reason_text.ilike("%batch entry%")) | (Flag.reason_text.ilike("%template match%")))
        .filter(RiskScore.risk_band == "green")
        .scalar()
    ) or 0

    # ── Average risk score ────────────────────────────────────────────────
    avg_risk = (
        db.query(func.avg(RiskScore.risk_score))
        .filter(RiskScore.work_id.in_(db.query(scoped_work_ids.c.id)))
        .scalar()
    )
    avg_risk_score = round(float(avg_risk), 1) if avg_risk else 0.0

    # ── Fund utilisation % (released / sanctioned) ────────────────────────
    fund_data = (
        base_query
        .with_entities(
            func.sum(Work.released_amt),
            func.sum(Work.sanctioned_amt),
        )
        .first()
    )
    total_released = float(fund_data[0] or 0)
    total_sanctioned = float(fund_data[1] or 0)
    fund_utilisation_pct = (
        round((total_released / total_sanctioned) * 100, 1)
        if total_sanctioned > 0 else None
    )

    # ── Category breakdown (flagged count per category) ───────────────────
    cat_breakdown_rows = (
        db.query(
            Work.category,
            func.count(func.distinct(Flag.work_id)).label("flagged_count"),
        )
        .join(Flag, Work.id == Flag.work_id)
        .filter(Work.id.in_(db.query(scoped_work_ids.c.id)))
        .group_by(Work.category)
        .order_by(func.count(func.distinct(Flag.work_id)).desc())
        .all()
    )
    category_breakdown = [
        CategoryBreakdown(category=row.category, flagged_count=row.flagged_count)
        for row in cat_breakdown_rows
    ]

    # ── Trend: flagged works by month (last 6 months) ─────────────────────
    # Uses flags.created_at, NOT risk_scores.computed_at (Conflict C3 from plan)
    trend_rows = (
        db.query(
            func.to_char(Flag.created_at, 'YYYY-MM').label("month"),
            func.count(func.distinct(Flag.work_id)).label("flagged_count"),
        )
        .filter(Flag.work_id.in_(db.query(scoped_work_ids.c.id)))
        .group_by(func.to_char(Flag.created_at, 'YYYY-MM'))
        .order_by(func.to_char(Flag.created_at, 'YYYY-MM'))
        .limit(6)
        .all()
    )
    trend = [
        TrendPoint(month=row.month, flagged_count=row.flagged_count)
        for row in trend_rows
    ]

    # ── Risk band counts across the entire scoped population ─────────────
    band_rows = (
        db.query(RiskScore.risk_band, func.count(RiskScore.work_id))
        .filter(RiskScore.work_id.in_(db.query(scoped_work_ids.c.id)))
        .group_by(RiskScore.risk_band)
        .all()
    )
    band_counts = {b: 0 for b in ["red", "amber", "green", "insufficient_data"]}
    for band, count in band_rows:
        if band in band_counts:
            band_counts[band] = count

    return DashboardSummary(
        total_works=total_works,
        flagged_count=flagged_count,
        batch_entry_review_count=batch_entry_review_count,
        avg_risk_score=avg_risk_score,
        red_count=band_counts["red"],
        amber_count=band_counts["amber"],
        green_count=band_counts["green"],
        insufficient_data_count=band_counts["insufficient_data"],
        fund_utilisation_pct=fund_utilisation_pct,
        category_breakdown=category_breakdown,
        trend=trend,
    )


@router.get("/dashboard/heatmap", response_model=list[DistrictHeatmapStats])
def district_heatmap(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
):
    """
    GET /dashboard/heatmap
    Returns district-level aggregates for the heat map in one server-side SQL query.
    Computes: total_count, flagged_count (Amber+Red), avg_risk_score per district.
    No pagination — returns all districts that have at least one work scored.
    Ministry-only: not scope-filtered, always national view.
    """
    rows = (
        db.query(
            Work.district.label("district"),
            func.count(Work.id).label("total_count"),
            func.sum(
                func.cast(RiskScore.risk_band.in_(["amber", "red"]), Integer)
            ).label("flagged_count"),
            func.coalesce(func.avg(RiskScore.risk_score), 0.0).label("avg_risk_score"),
        )
        .join(RiskScore, Work.id == RiskScore.work_id)
        .filter(Work.district.isnot(None))
        .group_by(Work.district)
        .order_by(func.count(Work.id).desc())
        .all()
    )

    return [
        DistrictHeatmapStats(
            district=row.district,
            total_count=int(row.total_count),
            flagged_count=int(row.flagged_count or 0),
            avg_risk_score=round(float(row.avg_risk_score or 0.0), 1),
        )
        for row in rows
    ]

