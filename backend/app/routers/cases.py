import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models.base import Case, Directive, CaseAction, CaseStatus, ActionType, User
from app.routers.deps import get_current_user
from app.services.audit import append_audit_log
from app.services.ingestion import storage

router = APIRouter(prefix="/cases", tags=["cases"])


class DirectiveOut(BaseModel):
    id: str
    text: str
    action_type: str
    department: str
    deadline: datetime | None
    confidence_score: float
    is_ambiguous: bool
    ambiguity_reason: str | None
    status: str
    page_number: int | None

    class Config:
        from_attributes = True


class CaseOut(BaseModel):
    id: str
    case_number: str
    court: str
    petitioners: str
    respondents: str
    judgment_date: datetime | None
    filed_at: datetime
    status: str
    confidence_score: float
    directives: list[DirectiveOut] = []

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
    q = select(Case).order_by(desc(Case.filed_at))
    if status:
        q = q.where(Case.status == status)
    if search:
        q = q.where(Case.case_number.ilike(f"%{search}%") | Case.petitioners.ilike(f"%{search}%"))
    q = q.offset(offset).limit(limit)

    result = await db.execute(q)
    cases = result.scalars().all()

    out = []
    for case in cases:
        dir_count_result = await db.execute(
            select(func.count()).where(Directive.case_id == case.id)
        )
        out.append(CaseListItem(
            id=case.id,
            case_number=case.case_number,
            court=case.court,
            petitioners=case.petitioners,
            status=case.status,
            confidence_score=case.confidence_score,
            filed_at=case.filed_at,
            judgment_date=case.judgment_date,
            directive_count=dir_count_result.scalar() or 0,
        ))
    return out


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    counts = {}
    for status in CaseStatus:
        result = await db.execute(
            select(func.count()).where(Case.status == status)
        )
        counts[status.value] = result.scalar() or 0

    # Upcoming deadlines (next 60 days)
    now = datetime.utcnow()
    deadline_result = await db.execute(
        select(Directive, Case)
        .join(Case, Directive.case_id == Case.id)
        .where(Directive.deadline >= now)
        .where(Directive.status == CaseStatus.PENDING_REVIEW)
        .order_by(Directive.deadline.asc())
        .limit(5)
    )
    upcoming = []
    for directive, case in deadline_result:
        upcoming.append({
            "case_number": case.case_number,
            "department": directive.department,
            "deadline": directive.deadline.isoformat() if directive.deadline else None,
            "case_id": case.id,
        })

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

    dir_result = await db.execute(select(Directive).where(Directive.case_id == case_id))
    directives = dir_result.scalars().all()

    return CaseOut(
        id=case.id,
        case_number=case.case_number,
        court=case.court,
        petitioners=case.petitioners,
        respondents=case.respondents,
        judgment_date=case.judgment_date,
        filed_at=case.filed_at,
        status=case.status,
        confidence_score=case.confidence_score,
        directives=[DirectiveOut.model_validate(d) for d in directives],
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
