"""
F9 — RBAC Scope Enforcement (PRD Section 13 — the single most important
security requirement in the document).

enforce_scope() is a FastAPI dependency applied to EVERY data-returning
endpoint.  It filters SQLAlchemy queries so users can ONLY see data within
their role's jurisdiction:

    mp       -> WHERE works.mp_id  = user.mp_id
    district -> WHERE works.district = user.district
    state    -> WHERE works.state    = user.state
    ministry -> no restriction (sees everything)

Query parameters can narrow within scope but NEVER widen beyond it.
Out-of-scope access returns 403 Forbidden.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Query

from backend.auth import CurrentUser
from backend.models import Work


def apply_scope_filter(query: Query, user: CurrentUser) -> Query:
    """
    Apply row-level scope filtering to a SQLAlchemy query over the Work table.

    This is the server-side enforcement — the frontend's UI scoping is
    irrelevant. Even if a request manually crafts query params to widen
    scope, this filter ensures only in-scope rows are returned.
    """
    if user.role == "ministry":
        # Ministry sees everything — no filter
        return query

    elif user.role == "state":
        if not user.state:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="State user has no state scope configured",
            )
        return query.filter(Work.state == user.state)

    elif user.role == "district":
        if not user.district:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="District user has no district scope configured",
            )
        return query.filter(Work.district == user.district)

    elif user.role == "mp":
        if not user.mp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MP user has no mp_id scope configured",
            )
        return query.filter(Work.mp_id == user.mp_id)

    else:
        # Unknown role — deny everything
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unknown role: {user.role}",
        )


def check_work_in_scope(work: Work, user: CurrentUser) -> None:
    """
    Check if a specific Work record is within the user's scope.
    Raises 403 if not.

    Used by GET /works/{id} to prevent enumeration attacks —
    a user cannot access a specific work by guessing its ID if
    that work is outside their jurisdiction.
    """
    if user.role == "ministry":
        return  # ministry sees everything

    elif user.role == "state":
        if work.state != user.state:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: work is outside your state scope",
            )

    elif user.role == "district":
        if work.district != user.district:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: work is outside your district scope",
            )

    elif user.role == "mp":
        if work.mp_id != user.mp_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: work does not belong to your constituency",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unknown role: {user.role}",
        )
