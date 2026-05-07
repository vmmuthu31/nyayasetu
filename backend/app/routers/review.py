"""Human Verification UI endpoints — approve, edit, reject directives."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.base import Case, Directive, CaseAction, CaseStatus, ActionType, User
from app.routers.deps import require_reviewer_or_admin
from app.services.audit import append_audit_log

router = APIRouter(prefix="/review", tags=["review"])


class DirectiveUpdate(BaseModel):
    action_type: Optional[str] = None
    department: Optional[str] = None
    deadline: Optional[datetime] = None
    notes: Optional[str] = None


class ReviewDecision(BaseModel):
    decision: str  # "approve" | "reject"
    notes: Optional[str] = None
    updates: Optional[DirectiveUpdate] = None


@router.post("/directives/{directive_id}")
async def review_directive(
    directive_id: str,
    body: ReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    result = await db.execute(select(Directive).where(Directive.id == directive_id))
    directive = result.scalar_one_or_none()
    if not directive:
        raise HTTPException(status_code=404, detail="Directive not found")

    previous = {
        "action_type": directive.action_type,
        "department": directive.department,
        "deadline": directive.deadline.isoformat() if directive.deadline else None,
        "status": directive.status,
    }

    if body.updates:
        if body.updates.action_type:
            directive.action_type = ActionType(body.updates.action_type)
        if body.updates.department:
            directive.department = body.updates.department
        if body.updates.deadline:
            directive.deadline = body.updates.deadline

    if body.decision == "approve":
        directive.status = CaseStatus.VERIFIED
    elif body.decision == "reject":
        directive.status = CaseStatus.REJECTED
    else:
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")

    directive.reviewed_by = current_user.id
    directive.reviewed_at = datetime.utcnow()

    action = CaseAction(
        case_id=directive.case_id,
        user_id=current_user.id,
        action_type=f"DIRECTIVE_{body.decision.upper()}",
        notes=body.notes,
        previous_data=previous,
        new_data={
            "action_type": directive.action_type,
            "department": directive.department,
            "deadline": directive.deadline.isoformat() if directive.deadline else None,
            "status": directive.status,
        },
    )
    db.add(action)

    # Flush so the current directive's new status is visible within this session
    await db.flush()

    # Update parent case status if all directives are now reviewed
    all_directives_result = await db.execute(
        select(Directive).where(Directive.case_id == directive.case_id)
    )
    all_dirs = all_directives_result.scalars().all()
    pending = [d for d in all_dirs if d.status == CaseStatus.PENDING_REVIEW]

    if not pending:
        case_result = await db.execute(select(Case).where(Case.id == directive.case_id))
        case = case_result.scalar_one_or_none()
        if case:
            verified_count = sum(1 for d in all_dirs if d.status == CaseStatus.VERIFIED)
            case.status = CaseStatus.VERIFIED if verified_count > 0 else CaseStatus.REJECTED

    await append_audit_log(
        db,
        event=f"DIRECTIVE_{body.decision.upper()}",
        case_id=directive.case_id,
        user_id=current_user.id,
        details={"directive_id": directive_id, "notes": body.notes, "previous": previous},
    )

    await db.commit()
    return {"success": True, "directive_id": directive_id, "status": directive.status}


@router.post("/cases/{case_id}/status")
async def update_case_status(
    case_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_reviewer_or_admin),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    new_status = body.get("status")
    if new_status not in [s.value for s in CaseStatus]:
        raise HTTPException(status_code=400, detail="Invalid status")

    old_status = case.status
    case.status = CaseStatus(new_status)

    action = CaseAction(
        case_id=case_id,
        user_id=current_user.id,
        action_type="CASE_STATUS_CHANGE",
        notes=body.get("notes"),
        previous_data={"status": old_status},
        new_data={"status": new_status},
    )
    db.add(action)

    await append_audit_log(
        db,
        event="CASE_STATUS_CHANGED",
        case_id=case_id,
        user_id=current_user.id,
        details={"from": old_status, "to": new_status},
    )

    await db.commit()
    return {"success": True, "case_id": case_id, "status": new_status}
