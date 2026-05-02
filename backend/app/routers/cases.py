from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case as sql_case, outerjoin

from app.core.database import get_db
from app.models.base import Case, Directive, CaseStatus, User
from app.routers.deps import get_current_user
from app.services.ingestion import storage

router = APIRouter(prefix="/cases", tags=["cases"])


class DirectiveOut(BaseModel):
    id: str
    text: str
    action_type: str
    department: str
    deadline: datetime | None
    deadline_text: str | None = None              # Exact phrase e.g. "within 8 weeks"
    confidence_score: float
    is_ambiguous: bool
    ambiguity_reason: str | None
    status: str
    page_number: int | None
    highlight_coords: list[dict] | None = None   # Real PyMuPDF bounding boxes
    limitation_days: int | None = None            # Days left in appeal window

    class Config:
        from_attributes = True


class ActionPlanSummary(BaseModel):
    total_directives: int
    verified_count: int
    pending_count: int
    rejected_count: int
    comply_count: int
    appeal_count: int
    inform_count: int
    monitor_count: int
    to_departments: int                            # Unique departments


class CaseOut(BaseModel):
    id: str
    case_number: str
    court: str
    petitioners: str
    respondents: str
    judgment_date: datetime | None
    received_at: datetime | None = None           # When judgment was received
    filed_at: datetime
    status: str
    confidence_score: float
    page_count: int = 0                           # Total PDF pages
    directives: list[DirectiveOut] = []
    summary: ActionPlanSummary | None = None      # Computed breakdown

    class Config:
        from_attributes = True


class CaseListItem(BaseModel):
    id: str
    case_number: str
    court: str
    petitioners: str
    status: str
    confidence_score: float
    filed_at: datetime
    judgment_date: datetime | None
    directive_count: int = 0

    class Config:
        from_attributes = True


@router.get("", response_model=list[CaseListItem])
async def list_cases(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Single query: cases LEFT JOIN directive count — no N+1
    directive_count_subq = (
        select(Directive.case_id, func.count(Directive.id).label("cnt"))
        .group_by(Directive.case_id)
        .subquery()
    )

    q = (
        select(Case, func.coalesce(directive_count_subq.c.cnt, 0).label("directive_count"))
        .outerjoin(directive_count_subq, Case.id == directive_count_subq.c.case_id)
        .order_by(desc(Case.filed_at))
    )

    if status:
        q = q.where(Case.status == status)
    if search:
        q = q.where(
            Case.case_number.ilike(f"%{search}%") | Case.petitioners.ilike(f"%{search}%")
        )

    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    rows = result.all()

    return [
        CaseListItem(
            id=row.Case.id,
            case_number=row.Case.case_number,
            court=row.Case.court,
            petitioners=row.Case.petitioners,
            status=row.Case.status,
            confidence_score=row.Case.confidence_score,
            filed_at=row.Case.filed_at,
            judgment_date=row.Case.judgment_date,
            directive_count=row.directive_count,
        )
        for row in rows
    ]


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Single query for all status counts using conditional aggregation
    count_q = select(
        func.count(Case.id).filter(Case.status == CaseStatus.PENDING_REVIEW).label("pending"),
        func.count(Case.id).filter(Case.status == CaseStatus.VERIFIED).label("verified"),
        func.count(Case.id).filter(Case.status == CaseStatus.ACTIONED).label("actioned"),
        func.count(Case.id).filter(Case.status == CaseStatus.APPEALED).label("appealed"),
        func.count(Case.id).filter(Case.status == CaseStatus.REJECTED).label("rejected"),
    )
    count_result = await db.execute(count_q)
    row = count_result.one()

    counts = {
        "PENDING_REVIEW": row.pending,
        "VERIFIED": row.verified,
        "ACTIONED": row.actioned,
        "APPEALED": row.appealed,
        "REJECTED": row.rejected,
    }

    # Upcoming deadlines — join in single query
    now = datetime.utcnow()
    deadline_result = await db.execute(
        select(
            Directive.department,
            Directive.deadline,
            Directive.case_id,
            Case.case_number,
        )
        .join(Case, Directive.case_id == Case.id)
        .where(Directive.deadline >= now)
        .where(Directive.status == CaseStatus.PENDING_REVIEW)
        .order_by(Directive.deadline.asc())
        .limit(5)
    )

    upcoming = [
        {
            "case_number": row.case_number,
            "department": row.department,
            "deadline": row.deadline.isoformat() if row.deadline else None,
            "case_id": row.case_id,
        }
        for row in deadline_result.all()
    ]

    return {"status_counts": counts, "upcoming_deadlines": upcoming}


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    dir_result = await db.execute(
        select(Directive).where(Directive.case_id == case_id).order_by(Directive.created_at.asc())
    )
    directives = dir_result.scalars().all()

    directive_outs = [DirectiveOut.model_validate(d) for d in directives]

    # Compute action plan summary
    summary = ActionPlanSummary(
        total_directives=len(directives),
        verified_count=sum(1 for d in directives if d.status == CaseStatus.VERIFIED),
        pending_count=sum(1 for d in directives if d.status == CaseStatus.PENDING_REVIEW),
        rejected_count=sum(1 for d in directives if d.status == CaseStatus.REJECTED),
        comply_count=sum(1 for d in directives if str(d.action_type) == "COMPLY"),
        appeal_count=sum(1 for d in directives if str(d.action_type) == "APPEAL"),
        inform_count=sum(1 for d in directives if str(d.action_type) == "INFORM"),
        monitor_count=sum(1 for d in directives if str(d.action_type) == "MONITOR"),
        to_departments=len({d.department for d in directives if d.department}),
    )

    return CaseOut(
        id=case.id,
        case_number=case.case_number,
        court=case.court,
        petitioners=case.petitioners,
        respondents=case.respondents,
        judgment_date=case.judgment_date,
        received_at=case.received_at,
        filed_at=case.filed_at,
        status=case.status,
        confidence_score=case.confidence_score,
        page_count=case.page_count or 0,
        directives=directive_outs,
        summary=summary,
    )


@router.get("/{case_id}/pdf-url")
async def get_pdf_url(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case or not case.pdf_storage_key:
        raise HTTPException(status_code=404, detail="PDF not found")
    url = storage.get_presigned_url(case.pdf_storage_key)
    return {"url": url}


@router.get("/{case_id}/export/action-plan")
async def export_action_plan(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Export verified action plan as structured JSON (ready for PDF rendering or CSV)."""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    dir_result = await db.execute(
        select(Directive)
        .where(Directive.case_id == case_id)
        .where(Directive.status == CaseStatus.VERIFIED)
        .order_by(Directive.created_at.asc())
    )
    verified_directives = dir_result.scalars().all()

    from fastapi.responses import JSONResponse
    export = {
        "exported_at": datetime.utcnow().isoformat(),
        "case": {
            "case_number": case.case_number,
            "court": case.court,
            "petitioners": case.petitioners,
            "respondents": case.respondents,
            "judgment_date": case.judgment_date.isoformat() if case.judgment_date else None,
            "received_at": case.received_at.isoformat() if case.received_at else None,
        },
        "verified_directives": [
            {
                "serial": i + 1,
                "text": d.text,
                "action_type": d.action_type,
                "department": d.department,
                "deadline": d.deadline.isoformat() if d.deadline else None,
                "deadline_text": d.deadline_text,
                "limitation_days": d.limitation_days,
                "confidence_score": d.confidence_score,
            }
            for i, d in enumerate(verified_directives)
        ],
        "total_verified": len(verified_directives),
    }
    return JSONResponse(content=export, headers={
        "Content-Disposition": f"attachment; filename=action-plan-{case.case_number}.json"
    })
