"""
Coverage & Data Quality Router.

GET /coverage/summary — data gap metrics for the Coverage & Data Quality screen.
No authentication required (public-facing statistics about data completeness).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Work, RiskScore
from backend.schemas import CoverageSummary, DataGap, StateCoverage

router = APIRouter(prefix="/coverage", tags=["coverage"])


@router.get("/summary", response_model=CoverageSummary)
def coverage_summary(db: Session = Depends(get_db)):
    """
    GET /coverage/summary
    Returns data completeness metrics across the full dataset.
    Used by the Coverage & Data Quality screen.
    """
    total_works = db.query(func.count(Work.id)).scalar() or 0

    # Count missing values for each key field
    missing_completion = db.query(func.count(Work.id)).filter(
        Work.actual_completion.is_(None)
    ).scalar() or 0

    missing_expenditure = db.query(func.count(Work.id)).filter(
        Work.expenditure.is_(None)
    ).scalar() or 0

    missing_agency = db.query(func.count(Work.id)).filter(
        Work.agency_id.is_(None)
    ).scalar() or 0

    # Data gap list
    gaps = []
    if total_works > 0:
        gaps = [
            DataGap(
                field="completion_date",
                missing_count=missing_completion,
                missing_pct=round(missing_completion / total_works * 100, 1),
            ),
            DataGap(
                field="expenditure",
                missing_count=missing_expenditure,
                missing_pct=round(missing_expenditure / total_works * 100, 1),
            ),
            DataGap(
                field="agency",
                missing_count=missing_agency,
                missing_pct=round(missing_agency / total_works * 100, 1),
            ),
        ]

    # Measurability counts:
    # "measurable" = has completion + expenditure + agency data
    # "partially measurable" = has 1 or 2 of the 3
    # "not measurable" = has none of the 3
    from sqlalchemy import and_, or_

    has_completion = Work.actual_completion.isnot(None)
    has_expenditure = and_(Work.expenditure.isnot(None), Work.expenditure > 0)
    has_agency = Work.agency_id.isnot(None)

    measurable_count = db.query(func.count(Work.id)).filter(
        and_(has_completion, has_expenditure, has_agency)
    ).scalar() or 0

    not_measurable_count = db.query(func.count(Work.id)).filter(
        and_(~has_completion, ~has_expenditure, ~has_agency)
    ).scalar() or 0

    partially_measurable_count = total_works - measurable_count - not_measurable_count

    # Band distribution from risk_scores
    band_rows = db.query(
        RiskScore.risk_band, func.count(RiskScore.work_id)
    ).group_by(RiskScore.risk_band).all()
    band_distribution = {b: c for b, c in band_rows}

    # State-level coverage
    state_rows = db.query(
        Work.state,
        func.count(Work.id).label("total"),
        func.count(
            case((and_(has_completion, has_expenditure, has_agency), Work.id), else_=None)
        ).label("measurable"),
    ).group_by(Work.state).order_by(func.count(Work.id).desc()).limit(20).all()

    state_coverage = [
        StateCoverage(
            state=row.state,
            total_works=row.total,
            measurable_count=row.measurable,
            measurable_pct=round(row.measurable / row.total * 100, 1) if row.total > 0 else 0.0,
        )
        for row in state_rows
    ]

    return CoverageSummary(
        total_works=total_works,
        measurable_count=measurable_count,
        partially_measurable_count=partially_measurable_count,
        not_measurable_count=not_measurable_count,
        gaps=gaps,
        band_distribution=band_distribution,
        state_coverage=state_coverage,
    )

