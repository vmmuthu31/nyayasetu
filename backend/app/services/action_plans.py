from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import (
    ActionPlan,
    ActionPlanEvent,
    ActionPlanStatus,
    Case,
    CaseStatus,
    Directive,
    User,
    UserRole,
)


async def pick_assigned_officer_id(db: AsyncSession, department: str) -> str | None:
    result = await db.execute(
        select(User)
        .where(User.role == UserRole.DEPT_USER)
        .where(User.department == department)
        .order_by(User.created_at.asc())
        .limit(1)
    )
    user = result.scalar_one_or_none()
    return user.id if user else None


async def create_action_plan_event(
    db: AsyncSession,
    *,
    action_plan_id: str,
    event_type: str,
    message: str,
    user_id: str | None = None,
    details: dict | None = None,
) -> ActionPlanEvent:
    event = ActionPlanEvent(
        action_plan_id=action_plan_id,
        event_type=event_type,
        message=message,
        user_id=user_id,
        details=details,
    )
    db.add(event)
    await db.flush()
    return event


def _is_overdue(plan: ActionPlan, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    return (
        plan.due_date is not None
        and plan.due_date < now
        and plan.status not in {
            ActionPlanStatus.COMPLETED,
            ActionPlanStatus.OVERDUE,
        }
    )


async def refresh_overdue_action_plans(
    db: AsyncSession,
    *,
    plans: list[ActionPlan] | None = None,
    case_id: str | None = None,
    department: str | None = None,
) -> bool:
    if plans is None:
        query = select(ActionPlan)
        if case_id:
            query = query.where(ActionPlan.case_id == case_id)
        if department:
            query = query.where(ActionPlan.assigned_department == department)
        result = await db.execute(query)
        plans = result.scalars().all()

    now = datetime.utcnow()
    changed = False
    for plan in plans:
        if _is_overdue(plan, now):
            plan.status = ActionPlanStatus.OVERDUE
            plan.updated_at = now
            changed = True
    if changed:
        await db.flush()
    return changed


async def ensure_action_plan_for_directive(
    db: AsyncSession,
    directive: Directive,
) -> ActionPlan | None:
    if directive.status != CaseStatus.VERIFIED:
        return None

    result = await db.execute(
        select(ActionPlan).where(ActionPlan.directive_id == directive.id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    action_plan = ActionPlan(
        case_id=directive.case_id,
        directive_id=directive.id,
        assigned_department=directive.department,
        assigned_officer_id=await pick_assigned_officer_id(db, directive.department),
        due_date=directive.deadline,
        due_date_source=getattr(directive, "deadline_source", "none"),
        status=ActionPlanStatus.PENDING,
    )
    db.add(action_plan)
    await db.flush()
    await create_action_plan_event(
        db,
        action_plan_id=action_plan.id,
        event_type="ASSIGNED",
        message="Action assigned to department",
        details={"department": directive.department},
    )
    return action_plan


async def ensure_action_plans_for_case(db: AsyncSession, case_id: str) -> list[ActionPlan]:
    directive_result = await db.execute(
        select(Directive).where(Directive.case_id == case_id)
    )
    directives = directive_result.scalars().all()

    plans: list[ActionPlan] = []
    for directive in directives:
        plan = await ensure_action_plan_for_directive(db, directive)
        if plan:
            plans.append(plan)

    await db.flush()

    result = await db.execute(
        select(ActionPlan).where(ActionPlan.case_id == case_id).order_by(ActionPlan.created_at.asc())
    )
    return result.scalars().all()


async def sync_case_action_status(db: AsyncSession, case_id: str) -> None:
    result = await db.execute(select(ActionPlan).where(ActionPlan.case_id == case_id))
    plans = result.scalars().all()
    await refresh_overdue_action_plans(db, plans=plans)
    if not plans:
        return

    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        return

    if all(plan.status == ActionPlanStatus.COMPLETED for plan in plans):
        case.status = CaseStatus.ACTIONED
    else:
        case.status = CaseStatus.VERIFIED
    case.updated_at = datetime.utcnow()
