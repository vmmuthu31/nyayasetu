"""Department-wise view: verified action plans only, grouped by department."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models.base import Directive, Case, CaseStatus, User, UserRole
from app.routers.deps import require_department_or_admin

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("/summary")
async def department_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_department_or_admin),
):
    """
    Aggregated view per department — only VERIFIED directives.
    Used by the department-wise dashboard panel (decision-maker view).
    """
    query = (
        select(
            Directive.department,
            func.count(Directive.id).label("total"),
            func.count(Directive.id).filter(Directive.action_type == "COMPLY").label("comply"),
            func.count(Directive.id).filter(Directive.action_type == "APPEAL").label("appeal"),
            func.count(Directive.id).filter(Directive.action_type == "INFORM").label("inform"),
            func.count(Directive.id).filter(Directive.action_type == "MONITOR").label("monitor"),
            func.min(Directive.deadline).label("earliest_deadline"),
        )
        .where(Directive.status == CaseStatus.VERIFIED)
    )
    if current_user.role == UserRole.DEPT_USER:
        query = query.where(Directive.department == current_user.department)

    result = await db.execute(
        query.group_by(Directive.department).order_by(func.min(Directive.deadline).asc())
    )
    rows = result.all()

    now = datetime.utcnow()
    return [
        {
            "department": row.department,
            "total": row.total,
            "by_action": {
                "COMPLY": row.comply,
                "APPEAL": row.appeal,
                "INFORM": row.inform,
                "MONITOR": row.monitor,
            },
            "earliest_deadline": row.earliest_deadline.isoformat() if row.earliest_deadline else None,
            "days_until_deadline": (
                (row.earliest_deadline - now).days if row.earliest_deadline else None
            ),
        }
        for row in rows
    ]


@router.get("/actions")
async def department_actions(
    department: str = Query(...),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_department_or_admin),
):
    """
    All VERIFIED action plans for a specific department.
    Only verified records — trusted view for decision-makers.
    """
    effective_department = department
    if current_user.role == UserRole.DEPT_USER:
        if current_user.department != department:
            raise HTTPException(status_code=403, detail="Unauthorized department access")
        effective_department = current_user.department

    result = await db.execute(
        select(Directive, Case.case_number, Case.court, Case.judgment_date)
        .join(Case, Directive.case_id == Case.id)
        .where(Directive.department == effective_department)
        .where(Directive.status == CaseStatus.VERIFIED)
        .order_by(Directive.deadline.asc())
        .limit(limit)
    )

    rows = result.all()
    return [
        {
            "directive_id": row.Directive.id,
            "case_id": row.Directive.case_id,
            "case_number": row.case_number,
            "court": row.court,
            "judgment_date": row.judgment_date.isoformat() if row.judgment_date else None,
            "directive_text": row.Directive.text,
            "action_type": row.Directive.action_type,
            "department": row.Directive.department,
            "deadline": row.Directive.deadline.isoformat() if row.Directive.deadline else None,
            "confidence_score": row.Directive.confidence_score,
        }
        for row in rows
    ]
