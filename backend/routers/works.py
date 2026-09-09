"""
F10 — Works Router (PRD Section 11).

GET /works       — paginated, filtered, scope-enforced work list
GET /works/{id}  — full work detail with risk scores, flags, duplicate pairs
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.auth import CurrentUser, get_current_user
from backend.database import get_db
from backend.dependencies import apply_scope_filter, check_work_in_scope
from backend.models import Work, RiskScore, Flag, DuplicatePair, MP, Agency
from backend.schemas import (
    PaginatedWorks, WorkListItem, WorkDetail,
    RiskScoreOut, FlagOut, DuplicatePairOut,
)

router = APIRouter(prefix="/works", tags=["works"])


@router.get("", response_model=PaginatedWorks)
def list_works(
    mp_id: Optional[int] = Query(None),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    risk_band: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """
    GET /works — paginated list of works within the caller's scope.
    Query params narrow within scope but never widen beyond it.
    """
    # Start with base query
    query = db.query(Work)

    # RBAC scope filter — the critical line
    query = apply_scope_filter(query, user)

    # If MP user tries to query another MP's works, block it
    if user.role == "mp" and mp_id is not None and mp_id != user.mp_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: cannot view another MP's works",
        )

    # Additional filters (narrow within scope only)
    if mp_id is not None:
        query = query.filter(Work.mp_id == mp_id)
    if state:
        query = query.filter(Work.state == state)
    if district:
        query = query.filter(Work.district == district)
    if category:
        query = query.filter(Work.category == category)

    # Join risk_scores for risk_band filter and sort
    query = query.outerjoin(RiskScore, Work.id == RiskScore.work_id)

    if risk_band:
        query = query.filter(RiskScore.risk_band == risk_band)

    # Total count before pagination
    total_count = query.count()

    # Paginate
    offset = (page - 1) * page_size
    works = query.order_by(Work.id).offset(offset).limit(page_size).all()

    # Build response items
    items = []
    for w in works:
        # Get MP name
        mp = db.query(MP).filter(MP.id == w.mp_id).first() if w.mp_id else None
        # Get agency name
        agency = db.query(Agency).filter(Agency.id == w.agency_id).first() if w.agency_id else None
        # Get risk info
        rs = db.query(RiskScore).filter(RiskScore.work_id == w.id).first()
        # Get top flag reason (first non-llm_summary flag)
        top_flag = (
            db.query(Flag)
            .filter(Flag.work_id == w.id, Flag.source != 'llm_summary')
            .order_by(Flag.id)
            .first()
        )
        top_reason = None
        if top_flag:
            top_reason = top_flag.reason_text[:100] + '…' if len(top_flag.reason_text) > 100 else top_flag.reason_text

        items.append(WorkListItem(
            id=w.id,
            mp_id=w.mp_id,
            category=w.category,
            mp_name=mp.name if mp else None,
            agency_name=agency.name if agency else None,
            district=w.district,
            state=w.state,
            risk_band=rs.risk_band if rs else None,
            risk_score=float(rs.risk_score) if rs else None,
            top_reason=top_reason,
        ))

    return PaginatedWorks(
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


@router.get("/{work_id}", response_model=WorkDetail)
def get_work(
    work_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """
    GET /works/{id} — full work detail.
    Returns 404 if not found, 403 if outside caller's scope.
    """
    work = db.query(Work).filter(Work.id == work_id).first()
    if not work:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Work not found")

    # RBAC check — 403 if out of scope
    check_work_in_scope(work, user)

    # Get risk scores
    rs = db.query(RiskScore).filter(RiskScore.work_id == work_id).first()
    risk_out = None
    if rs:
        risk_out = RiskScoreOut(
            cost_score=rs.cost_score,
            duplicate_score=rs.duplicate_score,
            delay_score=rs.delay_score,
            risk_score=rs.risk_score,
            risk_band=rs.risk_band,
        )

    # Get agency name
    agency = db.query(Agency).filter(Agency.id == work.agency_id).first() if work.agency_id else None

    # Get flags — LLM summary first, then others (PRD Section 12.1)
    flags_raw = (
        db.query(Flag)
        .filter(Flag.work_id == work_id)
        .order_by(
            # llm_summary first, then everything else
            Flag.source != "llm_summary",
            Flag.id,
        )
        .all()
    )
    flags_out = [FlagOut(id=f.id, source=f.source, reason_text=f.reason_text)
                 for f in flags_raw]

    # Get duplicate pairs (where this work appears on either side)
    dup_pairs = (
        db.query(DuplicatePair)
        .filter(
            (DuplicatePair.work_id_a == work_id) |
            (DuplicatePair.work_id_b == work_id)
        )
        .all()
    )
    dups_out = [DuplicatePairOut(
        id=d.id,
        work_id_a=d.work_id_a,
        work_id_b=d.work_id_b,
        similarity_score=d.similarity_score,
    ) for d in dup_pairs]

    return WorkDetail(
        id=work.id,
        mp_id=work.mp_id,
        agency_id=work.agency_id,
        agency_name=agency.name if agency else None,
        category=work.category,
        description=work.description,
        state=work.state,
        district=work.district,
        sanctioned_amt=float(work.sanctioned_amt) if work.sanctioned_amt else None,
        released_amt=float(work.released_amt) if work.released_amt else None,
        expenditure=float(work.expenditure) if work.expenditure else None,
        sanction_date=work.sanction_date,
        expected_completion=work.expected_completion,
        actual_completion=work.actual_completion,
        status=work.status,
        risk_scores=risk_out,
        flags=flags_out,
        duplicate_pairs=dups_out,
    )
