"""
F10 — Risk-Ranked Router (PRD Section 11).

GET /risk-ranked — top-N works by risk_score descending, within caller's scope.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.auth import CurrentUser, get_current_user
from backend.database import get_db
from backend.dependencies import apply_scope_filter
from backend.models import Work, RiskScore, Flag
from backend.schemas import RiskRankedItem

router = APIRouter(tags=["risk"])


@router.get("/risk-ranked", response_model=list[RiskRankedItem])
def risk_ranked(
    mp_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """
    GET /risk-ranked — top-N works by risk_score DESC, within caller's scope.
    Powers the "Top Flagged Works" table on all dashboards.
    """
    # Base query: join works with risk_scores
    query = (
        db.query(Work, RiskScore)
        .join(RiskScore, Work.id == RiskScore.work_id)
    )

    # RBAC scope filter
    query = apply_scope_filter(query, user)

    # If MP user tries to query another MP's works, block it
    if user.role == "mp" and mp_id is not None and mp_id != user.mp_id:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: cannot view another MP's risk-ranked works",
        )

    if mp_id is not None:
        query = query.filter(Work.mp_id == mp_id)

    # Order by risk_score descending, limit
    results = (
        query
        .order_by(RiskScore.risk_score.desc())
        .limit(limit)
        .all()
    )

    items = []
    for work, rs in results:
        # Get top flag reason (first non-llm_summary flag)
        top_flag = (
            db.query(Flag)
            .filter(Flag.work_id == work.id, Flag.source != 'llm_summary')
            .order_by(Flag.id)
            .first()
        )
        top_reason = None
        if top_flag:
            top_reason = top_flag.reason_text[:100] + '…' if len(top_flag.reason_text) > 100 else top_flag.reason_text

        items.append(RiskRankedItem(
            id=work.id,
            category=work.category,
            district=work.district,
            state=work.state,
            risk_score=float(rs.risk_score),
            risk_band=rs.risk_band,
            top_reason=top_reason,
        ))

    return items
