from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.base import (
    ActionPlan,
    ActionPlanEvent,
    ActionPlanStatus,
    ActionType,
    Case,
    Directive,
    User,
    UserRole,
)
from app.routers.deps import get_current_user, require_reviewer_or_admin
from app.services.action_plans import (
    create_action_plan_event,
    ensure_action_plan_for_directive,
    ensure_action_plans_for_case,
    sync_case_action_status,
)
from app.services.audit import append_audit_log
from app.services.ingestion import storage

router = APIRouter(prefix="/action-plans", tags=["action-plans"])


class TimelineEntryOut(BaseModel):
    id: str
    event_type: str
    message: str
    actor_label: str
    created_at: str
    details: dict | None = None


class ActionPlanOut(BaseModel):
    id: str
    case_id: str
    case_number: str
    court: str
    directive_id: str
    directive_text: str
    action_type: str
    assigned_department: str
    assigned_officer_id: str | None = None
    status: str
    due_date: str | None = None
    remarks: str | None = None
    affidavit_url: str | None = None
    completion_notes: str | None = None
    reviewer_feedback: str | None = None
    submitted_at: str | None = None
    reviewed_at: str | None = None
    created_at: str
    updated_at: str
    timeline: list[TimelineEntryOut]


class ActionPlanStatusUpdate(BaseModel):
    status: str
    notes: str | None = None


class ActionPlanRemarkIn(BaseModel):
    remarks: str


class ActionPlanSubmitIn(BaseModel):
    completion_notes: str | None = None


class ActionPlanReviewIn(BaseModel):
    decision: str
    feedback: str | None = None


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_department_execution_access(user: User) -> None:
    if _role(user) not in {UserRole.ADMIN.value, UserRole.DEPT_USER.value}:
        raise HTTPException(status_code=403, detail="Unauthorized for department execution")


async def _load_plan_or_404(db: AsyncSession, action_plan_id: str) -> ActionPlan:
    result = await db.execute(select(ActionPlan).where(ActionPlan.id == action_plan_id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Action plan not found")
    return plan


def _assert_plan_scope(plan: ActionPlan, user: User) -> None:
    if _role(user) == UserRole.DEPT_USER.value and plan.assigned_department != user.department:
        raise HTTPException(status_code=403, detail="Unauthorized action plan access")


async def _backfill_action_plans(
    db: AsyncSession,
    department: str | None = None,
    case_id: str | None = None,
) -> None:
    query = select(Directive)
    if department:
      query = query.where(Directive.department == department)
    if case_id:
      query = query.where(Directive.case_id == case_id)
    result = await db.execute(query)
    for directive in result.scalars().all():
        await ensure_action_plan_for_directive(db, directive)
    await db.flush()


async def _timeline_map(db: AsyncSession, plan_ids: list[str]) -> dict[str, list[TimelineEntryOut]]:
    if not plan_ids:
        return {}

    event_result = await db.execute(
        select(ActionPlanEvent)
        .where(ActionPlanEvent.action_plan_id.in_(plan_ids))
        .order_by(ActionPlanEvent.created_at.asc())
    )
    events = event_result.scalars().all()

    user_ids = list({event.user_id for event in events if event.user_id})
    user_names: dict[str, str] = {}
    if user_ids:
        user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        user_names = {user.id: user.name for user in user_result.scalars().all()}

    grouped: dict[str, list[TimelineEntryOut]] = {plan_id: [] for plan_id in plan_ids}
    for event in events:
        grouped.setdefault(event.action_plan_id, []).append(
            TimelineEntryOut(
                id=event.id,
                event_type=event.event_type,
                message=event.message,
                actor_label=user_names.get(event.user_id, "System" if not event.user_id else "User"),
                created_at=event.created_at.isoformat(),
                details=event.details,
            )
        )
    return grouped


async def _serialize_plans(
    db: AsyncSession,
    plans: list[ActionPlan],
) -> list[ActionPlanOut]:
    if not plans:
        return []

    directive_ids = [plan.directive_id for plan in plans]
    case_ids = [plan.case_id for plan in plans]

    directive_result = await db.execute(select(Directive).where(Directive.id.in_(directive_ids)))
    directives = {directive.id: directive for directive in directive_result.scalars().all()}

    case_result = await db.execute(select(Case).where(Case.id.in_(case_ids)))
    cases = {case.id: case for case in case_result.scalars().all()}

    timelines = await _timeline_map(db, [plan.id for plan in plans])

    serialized: list[ActionPlanOut] = []
    for plan in plans:
        directive = directives.get(plan.directive_id)
        case = cases.get(plan.case_id)
        if not directive or not case:
            continue

        affidavit_url = (
            storage.get_presigned_url(plan.affidavit_storage_key)
            if plan.affidavit_storage_key
            else None
        )
        serialized.append(
            ActionPlanOut(
                id=plan.id,
                case_id=plan.case_id,
                case_number=case.case_number,
                court=case.court,
                directive_id=directive.id,
                directive_text=directive.text,
                action_type=directive.action_type.value if isinstance(directive.action_type, ActionType) else str(directive.action_type),
                assigned_department=plan.assigned_department,
                assigned_officer_id=plan.assigned_officer_id,
                status=plan.status.value if hasattr(plan.status, "value") else str(plan.status),
                due_date=plan.due_date.isoformat() if plan.due_date else None,
                remarks=plan.remarks,
                affidavit_url=affidavit_url,
                completion_notes=plan.completion_notes,
                reviewer_feedback=plan.reviewer_feedback,
                submitted_at=plan.submitted_at.isoformat() if plan.submitted_at else None,
                reviewed_at=plan.reviewed_at.isoformat() if plan.reviewed_at else None,
                created_at=plan.created_at.isoformat(),
                updated_at=plan.updated_at.isoformat(),
                timeline=timelines.get(plan.id, []),
            )
        )
    return serialized


@router.get("/my-department", response_model=list[ActionPlanOut])
async def my_department_action_plans(
    department: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_role = _role(current_user)
    effective_department = department
    if user_role == UserRole.DEPT_USER.value:
        effective_department = current_user.department
        if not effective_department:
            raise HTTPException(status_code=403, detail="Department not assigned to user")

    await _backfill_action_plans(db, department=effective_department)

    query = select(ActionPlan).order_by(ActionPlan.due_date.asc(), ActionPlan.created_at.desc())
    if effective_department:
        query = query.where(ActionPlan.assigned_department == effective_department)
    if status:
        query = query.where(ActionPlan.status == status)

    result = await db.execute(query.limit(limit))
    plans = result.scalars().all()

    if user_role == UserRole.DEPT_USER.value:
        plans = [plan for plan in plans if plan.assigned_department == current_user.department]

    return await _serialize_plans(db, plans)


@router.get("/case/{case_id}", response_model=list[ActionPlanOut])
async def case_action_plans(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plans = await ensure_action_plans_for_case(db, case_id)
    scoped = []
    for plan in plans:
        _assert_plan_scope(plan, current_user)
        scoped.append(plan)
    return await _serialize_plans(db, scoped)


@router.get("/review-queue", response_model=list[ActionPlanOut])
async def review_queue(
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_reviewer_or_admin),
):
    result = await db.execute(
        select(ActionPlan)
        .where(ActionPlan.status == ActionPlanStatus.AWAITING_REVIEW)
        .order_by(ActionPlan.submitted_at.desc(), ActionPlan.updated_at.desc())
        .limit(limit)
    )
    return await _serialize_plans(db, result.scalars().all())


@router.patch("/{action_plan_id}/status", response_model=ActionPlanOut)
async def update_action_plan_status(
    action_plan_id: str,
    body: ActionPlanStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_department_execution_access(current_user)
    plan = await _load_plan_or_404(db, action_plan_id)
    _assert_plan_scope(plan, current_user)

    allowed = {
        ActionPlanStatus.PENDING.value,
        ActionPlanStatus.IN_PROGRESS.value,
        ActionPlanStatus.ESCALATED.value,
    }
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported execution status")

    plan.status = ActionPlanStatus(body.status)
    if body.notes:
        plan.completion_notes = body.notes
    plan.updated_at = datetime.utcnow()

    await create_action_plan_event(
        db,
        action_plan_id=plan.id,
        user_id=current_user.id,
        event_type="STATUS_UPDATED",
        message=f"Status changed to {body.status.replace('_', ' ').title()}",
        details={"status": body.status, "notes": body.notes},
    )
    await append_audit_log(
        db,
        event="ACTION_PLAN_STATUS_UPDATED",
        case_id=plan.case_id,
        user_id=current_user.id,
        details={"action_plan_id": plan.id, "status": body.status},
    )
    await sync_case_action_status(db, plan.case_id)
    await db.commit()
    return (await _serialize_plans(db, [plan]))[0]


@router.post("/{action_plan_id}/remarks", response_model=ActionPlanOut)
async def add_action_plan_remarks(
    action_plan_id: str,
    body: ActionPlanRemarkIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_department_execution_access(current_user)
    plan = await _load_plan_or_404(db, action_plan_id)
    _assert_plan_scope(plan, current_user)

    plan.remarks = body.remarks
    plan.updated_at = datetime.utcnow()
    await create_action_plan_event(
        db,
        action_plan_id=plan.id,
        user_id=current_user.id,
        event_type="REMARK_ADDED",
        message="Department remarks updated",
        details={"remarks": body.remarks},
    )
    await append_audit_log(
        db,
        event="ACTION_PLAN_REMARK_ADDED",
        case_id=plan.case_id,
        user_id=current_user.id,
        details={"action_plan_id": plan.id},
    )
    await db.commit()
    return (await _serialize_plans(db, [plan]))[0]


@router.post("/{action_plan_id}/upload", response_model=ActionPlanOut)
async def upload_action_plan_affidavit(
    action_plan_id: str,
    file: UploadFile = File(...),
    notes: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_department_execution_access(current_user)
    plan = await _load_plan_or_404(db, action_plan_id)
    _assert_plan_scope(plan, current_user)

    filename = file.filename or "compliance-document"
    ext = Path(filename).suffix or ".pdf"
    key = f"action-plans/{plan.id}/{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    content = await file.read()
    storage.upload_file(key, content, file.content_type or "application/octet-stream")

    plan.affidavit_storage_key = key
    plan.updated_at = datetime.utcnow()
    if notes:
        plan.remarks = notes

    await create_action_plan_event(
        db,
        action_plan_id=plan.id,
        user_id=current_user.id,
        event_type="AFFIDAVIT_UPLOADED",
        message="Compliance evidence uploaded",
        details={"filename": filename},
    )
    await append_audit_log(
        db,
        event="ACTION_PLAN_AFFIDAVIT_UPLOADED",
        case_id=plan.case_id,
        user_id=current_user.id,
        details={"action_plan_id": plan.id, "filename": filename},
    )
    await db.commit()
    return (await _serialize_plans(db, [plan]))[0]


@router.post("/{action_plan_id}/submit", response_model=ActionPlanOut)
async def submit_action_plan(
    action_plan_id: str,
    body: ActionPlanSubmitIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_department_execution_access(current_user)
    plan = await _load_plan_or_404(db, action_plan_id)
    _assert_plan_scope(plan, current_user)

    plan.status = ActionPlanStatus.AWAITING_REVIEW
    plan.submitted_at = datetime.utcnow()
    plan.completion_notes = body.completion_notes
    plan.updated_at = datetime.utcnow()

    await create_action_plan_event(
        db,
        action_plan_id=plan.id,
        user_id=current_user.id,
        event_type="SUBMITTED",
        message="Compliance submitted for reviewer verification",
        details={"completion_notes": body.completion_notes},
    )
    await append_audit_log(
        db,
        event="ACTION_PLAN_SUBMITTED",
        case_id=plan.case_id,
        user_id=current_user.id,
        details={"action_plan_id": plan.id},
    )
    await sync_case_action_status(db, plan.case_id)
    await db.commit()
    return (await _serialize_plans(db, [plan]))[0]


@router.post("/{action_plan_id}/review", response_model=ActionPlanOut)
async def review_action_plan(
    action_plan_id: str,
    body: ActionPlanReviewIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    plan = await _load_plan_or_404(db, action_plan_id)

    if body.decision == "approve":
        plan.status = ActionPlanStatus.COMPLETED
        event_type = "APPROVED"
        message = "Reviewer approved compliance submission"
    elif body.decision == "request_changes":
        plan.status = ActionPlanStatus.REOPENED
        event_type = "REQUESTED_CHANGES"
        message = "Reviewer requested changes"
    elif body.decision == "reopen":
        plan.status = ActionPlanStatus.REOPENED
        event_type = "REOPENED"
        message = "Reviewer reopened action plan"
    else:
        raise HTTPException(status_code=400, detail="Invalid review decision")

    plan.reviewer_feedback = body.feedback
    plan.reviewed_at = datetime.utcnow()
    plan.updated_at = datetime.utcnow()

    await create_action_plan_event(
        db,
        action_plan_id=plan.id,
        user_id=current_user.id,
        event_type=event_type,
        message=message,
        details={"feedback": body.feedback},
    )
    await append_audit_log(
        db,
        event=f"ACTION_PLAN_{event_type}",
        case_id=plan.case_id,
        user_id=current_user.id,
        details={"action_plan_id": plan.id, "feedback": body.feedback},
    )
    await sync_case_action_status(db, plan.case_id)
    await db.commit()
    return (await _serialize_plans(db, [plan]))[0]
