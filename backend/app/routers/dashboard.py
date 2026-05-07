from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.base import ActionPlan, ActionPlanStatus, AuditLog, Case, CaseStatus, Department, Directive, User, UserRole
from app.routers.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _is_department_user(user: User) -> bool:
    return _role(user) == UserRole.DEPT_USER.value


def _date_key(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


@router.get("/overview")
async def dashboard_overview(
    department: str | None = Query(None),
    period_days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    effective_department = current_user.department if _is_department_user(current_user) else department
    now = datetime.utcnow()
    start_date = now - timedelta(days=period_days - 1)

    case_rows = await _load_cases(db, current_user, effective_department)
    case_ids = [case.id for case in case_rows]

    action_plans = await _load_action_plans(db, case_ids, effective_department)
    directives = await _load_directives(db, case_ids, effective_department)
    audit_logs = await _load_audit_logs(db, current_user, case_ids, start_date)
    departments = await _load_departments(db, current_user, effective_department)

    metrics = {
        "total_cases": len(case_rows),
        "verified": sum(1 for case in case_rows if case.status == CaseStatus.VERIFIED),
        "pending_review": sum(1 for case in case_rows if case.status == CaseStatus.PENDING_REVIEW),
        "overdue": sum(
            1
            for plan in action_plans
            if plan.due_date and plan.due_date < now and plan.status != ActionPlanStatus.COMPLETED
        ),
        "departments": len(departments) if not effective_department else 1,
    }

    status_overview = [
        {"label": "Verified", "value": metrics["verified"], "color": "#22c55e"},
        {"label": "Pending Review", "value": metrics["pending_review"], "color": "#f59e0b"},
        {"label": "In Progress", "value": sum(1 for plan in action_plans if plan.status == ActionPlanStatus.IN_PROGRESS), "color": "#3b82f6"},
        {"label": "Overdue", "value": metrics["overdue"], "color": "#ef4444"},
        {"label": "Closed", "value": sum(1 for case in case_rows if case.status in {CaseStatus.ACTIONED, CaseStatus.APPEALED}), "color": "#cbd5e1"},
    ]

    timeline_days = [start_date + timedelta(days=index) for index in range(period_days)]
    ingested_counts: dict[str, int] = defaultdict(int)
    verified_counts: dict[str, int] = defaultdict(int)
    overdue_counts: dict[str, int] = defaultdict(int)

    for log in audit_logs:
        key = _date_key(log.created_at)
        if log.event == "CASE_INGESTED":
            ingested_counts[key] += 1
        if log.event in {"DIRECTIVE_APPROVE", "CASE_STATUS_CHANGED"}:
            verified_counts[key] += 1

    for plan in action_plans:
        if plan.due_date and plan.due_date < now and plan.status != ActionPlanStatus.COMPLETED:
            overdue_counts[_date_key(plan.due_date)] += 1

    trend = [
        {
            "label": day.strftime("%b %-d") if hasattr(day, "strftime") else "",
            "ingested": ingested_counts.get(_date_key(day), 0),
            "verified": verified_counts.get(_date_key(day), 0),
            "overdue": overdue_counts.get(_date_key(day), 0),
        }
        for day in timeline_days
    ]

    case_by_id = {case.id: case for case in case_rows}
    recent_cases = [
        {
            "id": case.id,
            "case_number": case.case_number,
            "petitioner": case.petitioners,
            "department": _case_department(case.id, directives),
            "status": case.status.value if hasattr(case.status, "value") else str(case.status),
            "updated_at": case.updated_at.isoformat(),
        }
        for case in case_rows[:4]
    ]

    department_totals: dict[str, int] = defaultdict(int)
    for directive in directives:
        department_totals[directive.department] += 1

    top_departments = [
        {"department": name, "count": count}
        for name, count in sorted(department_totals.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    upcoming_deadlines = [
        {
            "case_id": plan.case_id,
            "case_number": case_by_id.get(plan.case_id).case_number if case_by_id.get(plan.case_id) else "-",
            "title": plan.action_type,
            "department": plan.assigned_department,
            "deadline": plan.due_date.isoformat() if plan.due_date else None,
            "days_left": (plan.due_date - now).days if plan.due_date else None,
            "status": plan.status.value if hasattr(plan.status, "value") else str(plan.status),
        }
        for plan in sorted(
            [plan for plan in action_plans if plan.due_date],
            key=lambda item: item.due_date,
        )[:4]
    ]

    user_ids = {log.user_id for log in audit_logs if log.user_id}
    users = {}
    if user_ids:
        user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        users = {user.id: user for user in user_result.scalars().all()}

    recent_activity = [
        {
            "id": log.id,
            "title": _activity_title(log.event),
            "subtitle": _activity_subtitle(log, case_by_id, users),
            "created_at": log.created_at.isoformat(),
            "event": log.event,
        }
        for log in audit_logs[:4]
    ]

    department_options = [
        {"name": dept.name, "code": dept.code}
        for dept in departments
    ]

    return {
        "metrics": metrics,
        "status_overview": status_overview,
        "trend": trend,
        "recent_cases": recent_cases,
        "top_departments": top_departments,
        "upcoming_deadlines": upcoming_deadlines,
        "recent_activity": recent_activity,
        "department_options": department_options,
    }


async def _load_cases(
    db: AsyncSession,
    current_user: User,
    department: str | None,
) -> list[Case]:
    query = select(Case).order_by(desc(Case.updated_at), desc(Case.filed_at))
    if _is_department_user(current_user):
        query = (
            query.join(Directive, Directive.case_id == Case.id)
            .where(Directive.department == current_user.department)
            .distinct()
        )
    elif department:
        query = (
            query.join(Directive, Directive.case_id == Case.id)
            .where(Directive.department == department)
            .distinct()
        )
    result = await db.execute(query.limit(200))
    return result.scalars().all()


async def _load_action_plans(
    db: AsyncSession,
    case_ids: list[str],
    department: str | None,
) -> list[ActionPlan]:
    if not case_ids:
        return []
    query = select(ActionPlan).where(ActionPlan.case_id.in_(case_ids))
    if department:
        query = query.where(ActionPlan.assigned_department == department)
    result = await db.execute(query.order_by(ActionPlan.updated_at.desc()))
    return result.scalars().all()


async def _load_directives(
    db: AsyncSession,
    case_ids: list[str],
    department: str | None,
) -> list[Directive]:
    if not case_ids:
        return []
    query = select(Directive).where(Directive.case_id.in_(case_ids))
    if department:
        query = query.where(Directive.department == department)
    result = await db.execute(query.order_by(Directive.created_at.asc()))
    return result.scalars().all()


async def _load_audit_logs(
    db: AsyncSession,
    current_user: User,
    case_ids: list[str],
    start_date: datetime,
) -> list[AuditLog]:
    query = select(AuditLog).where(AuditLog.created_at >= start_date).order_by(desc(AuditLog.created_at))
    if _role(current_user) == UserRole.REVIEWER.value:
        query = query.where(AuditLog.user_id == current_user.id)
    elif case_ids:
        query = query.where((AuditLog.case_id.is_(None)) | (AuditLog.case_id.in_(case_ids)))
    result = await db.execute(query.limit(200))
    return result.scalars().all()


async def _load_departments(
    db: AsyncSession,
    current_user: User,
    department: str | None,
) -> list[Department]:
    if _is_department_user(current_user) and current_user.department:
        result = await db.execute(select(Department).where(Department.name == current_user.department))
        return result.scalars().all()
    if department:
        result = await db.execute(select(Department).where(Department.name == department))
        return result.scalars().all()
    result = await db.execute(select(Department).order_by(Department.name.asc()))
    return result.scalars().all()


def _case_department(case_id: str, directives: list[Directive]) -> str:
    directive = next((item for item in directives if item.case_id == case_id and item.department), None)
    return directive.department if directive else "-"


def _activity_title(event: str) -> str:
    mapping = {
        "CASE_INGESTED": "New judgment ingested",
        "DIRECTIVE_APPROVE": "Case verified",
        "CASE_STATUS_CHANGED": "Deadline updated",
        "ACTION_PLAN_AFFIDAVIT_UPLOADED": "Affidavit uploaded",
        "REPORT_EXPORTED": "Report exported",
    }
    return mapping.get(event, event.replace("_", " ").title())


def _activity_subtitle(log: AuditLog, case_map: dict[str, Case], users: dict[str, User]) -> str:
    case_number = case_map.get(log.case_id).case_number if log.case_id and case_map.get(log.case_id) else "System"
    actor = users.get(log.user_id).name if log.user_id and users.get(log.user_id) else "System"
    return f"{case_number} updated by {actor}"
