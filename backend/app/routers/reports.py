from __future__ import annotations

import csv
import io
from datetime import datetime
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.base import ActionPlan, AuditLog, Case, Directive, User, UserRole
from app.routers.deps import get_current_user
from app.services.audit import append_audit_log

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportExportRequest(BaseModel):
    report_type: str
    format: str = "csv"
    start_date: str | None = None
    end_date: str | None = None
    department: str | None = None


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_report_access(user: User) -> None:
    if _role(user) not in {UserRole.ADMIN.value, UserRole.REVIEWER.value}:
        raise HTTPException(status_code=403, detail="Unauthorized for report exports")


def _parse_iso_date(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if end_of_day:
        return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    return parsed.replace(hour=0, minute=0, second=0, microsecond=0)


def _csv_bytes(rows: list[list[str]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def _xml_cell(value: str) -> str:
    return f'<Cell><Data ss:Type="String">{escape(value)}</Data></Cell>'


def _excel_bytes(rows: list[list[str]]) -> bytes:
    body = "".join(
        f"<Row>{''.join(_xml_cell(value) for value in row)}</Row>"
        for row in rows
    )
    xml = (
        '<?xml version="1.0"?>'
        '<?mso-application progid="Excel.Sheet"?>'
        '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
        'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        f"<Worksheet ss:Name=\"Report\"><Table>{body}</Table></Worksheet>"
        "</Workbook>"
    )
    return xml.encode("utf-8")


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _simple_pdf_bytes(title: str, lines: list[str]) -> bytes:
    content_lines = [f"BT /F1 18 Tf 50 790 Td ({_pdf_escape(title)}) Tj ET"]
    y = 764
    for line in lines:
        safe = _pdf_escape(line[:120] if line else " ")
        content_lines.append(f"BT /F1 10 Tf 50 {y} Td ({safe}) Tj ET")
        y -= 14
        if y < 60:
            break
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets: list[int] = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode())
        output.write(obj)
        output.write(b"\nendobj\n")
    xref_pos = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode())
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(
        (
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF"
        ).encode()
    )
    return output.getvalue()


def _download_response(
    filename: str,
    media_type: str,
    payload: bytes,
) -> Response:
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/export")
async def export_report(
    body: ReportExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_report_access(current_user)

    start_date = _parse_iso_date(body.start_date)
    end_date = _parse_iso_date(body.end_date, end_of_day=True)
    department_filter = body.department or None
    report_type = body.report_type
    export_format = body.format.lower()

    rows, title = await _build_report_rows(
        db,
        report_type=report_type,
        start_date=start_date,
        end_date=end_date,
        department=department_filter,
    )

    generated_at = datetime.utcnow().isoformat()
    metadata_rows = [
        ["NyayaSetu Report", title],
        ["Generated At", generated_at],
        ["Generated By", current_user.name],
        ["Department Filter", department_filter or "All Departments"],
        ["Date Range", f"{body.start_date or 'Any'} to {body.end_date or 'Any'}"],
        [],
    ]
    full_rows = metadata_rows + rows

    await append_audit_log(
        db,
        event="REPORT_EXPORTED",
        user_id=current_user.id,
        details={
            "report_type": report_type,
            "format": export_format,
            "department": department_filter,
            "start_date": body.start_date,
            "end_date": body.end_date,
        },
    )
    await db.commit()

    safe_name = report_type.lower().replace(" ", "-")
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    if export_format == "csv":
        return _download_response(
            f"{safe_name}-{stamp}.csv",
            "text/csv; charset=utf-8",
            _csv_bytes(full_rows),
        )
    if export_format == "excel":
        return _download_response(
            f"{safe_name}-{stamp}.xls",
            "application/vnd.ms-excel",
            _excel_bytes(full_rows),
        )
    if export_format == "pdf":
        pdf_lines = [" | ".join(row) for row in full_rows]
        return _download_response(
            f"{safe_name}-{stamp}.pdf",
            "application/pdf",
            _simple_pdf_bytes(title, pdf_lines),
        )

    raise HTTPException(status_code=400, detail="Unsupported report format")


async def _build_report_rows(
    db: AsyncSession,
    *,
    report_type: str,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> tuple[list[list[str]], str]:
    if report_type == "Compliance Summary":
        return await _compliance_summary_rows(db, start_date, end_date, department), report_type
    if report_type == "Action Plan Status":
        return await _action_plan_status_rows(db, start_date, end_date, department), report_type
    if report_type == "Department Performance":
        return await _department_performance_rows(db, start_date, end_date, department), report_type
    if report_type == "Audit Summary":
        return await _audit_summary_rows(db, start_date, end_date), report_type
    if report_type == "Ingestion Summary":
        return await _ingestion_summary_rows(db, start_date, end_date, department), report_type
    if report_type == "User Activity":
        return await _user_activity_rows(db, start_date, end_date), report_type
    raise HTTPException(status_code=400, detail="Unsupported report type")


async def _fetch_action_plans(
    db: AsyncSession,
    *,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> list[ActionPlan]:
    query = select(ActionPlan).order_by(ActionPlan.due_date.asc(), ActionPlan.created_at.desc())
    if start_date:
        query = query.where(ActionPlan.created_at >= start_date)
    if end_date:
        query = query.where(ActionPlan.created_at <= end_date)
    if department:
        query = query.where(ActionPlan.assigned_department == department)
    result = await db.execute(query)
    return result.scalars().all()


async def _load_case_map(db: AsyncSession, case_ids: list[str]) -> dict[str, Case]:
    if not case_ids:
        return {}
    result = await db.execute(select(Case).where(Case.id.in_(case_ids)))
    return {case.id: case for case in result.scalars().all()}


async def _load_directive_map(db: AsyncSession, directive_ids: list[str]) -> dict[str, Directive]:
    if not directive_ids:
        return {}
    result = await db.execute(select(Directive).where(Directive.id.in_(directive_ids)))
    return {directive.id: directive for directive in result.scalars().all()}


async def _compliance_summary_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> list[list[str]]:
    plans = await _fetch_action_plans(db, start_date=start_date, end_date=end_date, department=department)
    completed = sum(1 for plan in plans if plan.status.value == "COMPLETED")
    pending = sum(1 for plan in plans if plan.status.value in {"PENDING", "REOPENED"})
    in_progress = sum(1 for plan in plans if plan.status.value in {"IN_PROGRESS", "AWAITING_REVIEW"})
    overdue = sum(1 for plan in plans if plan.status.value in {"ESCALATED", "OVERDUE"})
    compliance_rate = round((completed / len(plans)) * 100, 1) if plans else 0
    departments = sorted({plan.assigned_department for plan in plans})
    high_risk = [
        plan.case_id for plan in plans if plan.status.value in {"ESCALATED", "OVERDUE"}
    ][:10]
    case_map = await _load_case_map(db, high_risk)

    return [
        ["Metric", "Value"],
        ["Departments", ", ".join(departments) or "None"],
        ["Total Cases", str(len({plan.case_id for plan in plans}))],
        ["Completed", str(completed)],
        ["Pending", str(pending)],
        ["In Progress", str(in_progress)],
        ["Overdue", str(overdue)],
        ["Compliance Rate", f"{compliance_rate}%"],
        ["High Risk Cases", ", ".join(case_map.get(case_id).case_number for case_id in high_risk if case_map.get(case_id)) or "None"],
    ]


async def _action_plan_status_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> list[list[str]]:
    plans = await _fetch_action_plans(db, start_date=start_date, end_date=end_date, department=department)
    case_map = await _load_case_map(db, [plan.case_id for plan in plans])
    directive_map = await _load_directive_map(db, [plan.directive_id for plan in plans])

    rows = [["Case", "Department", "Directive", "Due Date", "Status", "Priority"]]
    for plan in plans:
        due = plan.due_date.date().isoformat() if plan.due_date else "-"
        rows.append([
            case_map.get(plan.case_id).case_number if case_map.get(plan.case_id) else plan.case_id,
            plan.assigned_department,
            (directive_map.get(plan.directive_id).text[:80] if directive_map.get(plan.directive_id) else "Action plan") ,
            due,
            plan.status.value.replace("_", " ").title(),
            _priority_label(plan.due_date, plan.status.value),
        ])
    return rows


async def _department_performance_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> list[list[str]]:
    plans = await _fetch_action_plans(db, start_date=start_date, end_date=end_date, department=department)
    grouped: dict[str, list[ActionPlan]] = {}
    for plan in plans:
        grouped.setdefault(plan.assigned_department, []).append(plan)

    rows = [["Department", "Compliance Rate", "Completed", "Overdue", "Avg Completion Days"]]
    for department_name in sorted(grouped):
        items = grouped[department_name]
        completed = [item for item in items if item.status.value == "COMPLETED"]
        overdue = [item for item in items if item.status.value in {"ESCALATED", "OVERDUE"}]
        avg_completion = (
            round(
                sum(
                    max(
                        0,
                        int(((item.reviewed_at or item.updated_at) - item.created_at).total_seconds() // 86400),
                    )
                    for item in completed
                ) / len(completed),
                1,
            )
            if completed
            else 0
        )
        rate = round((len(completed) / len(items)) * 100, 1) if items else 0
        rows.append([
            department_name,
            f"{rate}%",
            str(len(completed)),
            str(len(overdue)),
            str(avg_completion),
        ])
    return rows


async def _audit_summary_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
) -> list[list[str]]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    result = await db.execute(query.limit(200))
    logs = result.scalars().all()
    case_map = await _load_case_map(db, [log.case_id for log in logs if log.case_id])

    rows = [["Timestamp", "Case", "Event", "User", "Hash"]]
    for log in logs:
        case_number = case_map.get(log.case_id).case_number if log.case_id and case_map.get(log.case_id) else "System"
        rows.append([
            log.created_at.isoformat(),
            case_number,
            log.event,
            log.user_id or "System",
            log.hash,
        ])
    return rows


async def _ingestion_summary_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
    department: str | None,
) -> list[list[str]]:
    query = select(Case).order_by(Case.created_at.desc())
    if start_date:
        query = query.where(Case.created_at >= start_date)
    if end_date:
        query = query.where(Case.created_at <= end_date)
    result = await db.execute(query)
    cases = result.scalars().all()

    directive_result = await db.execute(select(Directive))
    directives = directive_result.scalars().all()
    if department:
        directives = [directive for directive in directives if directive.department == department]

    rows = [
        ["Metric", "Value"],
        ["PDFs Uploaded", str(len(cases))],
        ["Directives Extracted", str(len(directives))],
        ["Average Confidence", f"{round(sum(case.confidence_score for case in cases) / len(cases), 2) if cases else 0}"],
        ["Failed Ingestions", "0"],
    ]
    return rows


async def _user_activity_rows(
    db: AsyncSession,
    start_date: datetime | None,
    end_date: datetime | None,
) -> list[list[str]]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    result = await db.execute(query)
    logs = result.scalars().all()

    user_result = await db.execute(select(User).order_by(User.name.asc()))
    users = {user.id: user for user in user_result.scalars().all()}

    counts: dict[str, int] = {}
    for log in logs:
        if not log.user_id:
            continue
        counts[log.user_id] = counts.get(log.user_id, 0) + 1

    rows = [["Name", "Email", "Role", "Department", "Actions Logged"]]
    for user_id, count in sorted(counts.items(), key=lambda item: item[1], reverse=True):
        user = users.get(user_id)
        if not user:
            continue
        rows.append([
            user.name,
            user.email,
            user.role.value if hasattr(user.role, "value") else str(user.role),
            user.department or "-",
            str(count),
        ])
    return rows


def _priority_label(due_date: datetime | None, status: str) -> str:
    if status in {"ESCALATED", "OVERDUE"}:
        return "High"
    if not due_date:
        return "Medium"
    days_remaining = (due_date - datetime.utcnow()).days
    if days_remaining <= 3:
        return "High"
    if days_remaining <= 10:
        return "Medium"
    return "Low"
