"""
CCMS Integration Webhook.

High Court CCMS calls this endpoint when a case is disposed and the
judgment PDF is available. We validate a shared secret, then fetch + ingest
the PDF in the background so CCMS gets an immediate 202 response.

Ref: problem statement — judgments are "automatically fetched into CCMS via API
in PDF format."
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.models.base import Case
from app.routers.ingest import _run_ingestion_pipeline
from app.services.audit import append_audit_log

router = APIRouter(prefix="/ccms", tags=["ccms"])


class CcmsWebhookPayload(BaseModel):
    case_number: str
    court: str = "High Court"
    disposed_at: str
    pdf_url: HttpUrl
    petitioners: str = ""
    respondents: str = ""


async def _fetch_and_ingest(payload: CcmsWebhookPayload) -> None:
    """Background task: download PDF from CIS signed URL and run full pipeline."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(str(payload.pdf_url))
        resp.raise_for_status()
        pdf_bytes = resp.content

    async with AsyncSessionLocal() as db:
        try:
            await _run_ingestion_pipeline(
                pdf_bytes=pdf_bytes,
                filename=f"{payload.case_number}.pdf",
                db=db,
                user_id="ccms-system",
                source="CCMS_AUTO_FETCH",
            )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            try:
                await append_audit_log(
                    db,
                    event="CCMS_INGEST_FAILED",
                    details={"case_number": payload.case_number, "error": str(exc)},
                )
                await db.commit()
            except Exception:
                pass


def _verify_secret(x_ccms_secret: str = Header(..., alias="X-CCMS-Secret")) -> None:
    if x_ccms_secret != settings.ccms_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid CCMS webhook secret")


@router.post("/webhook", status_code=202)
async def ccms_webhook(
    payload: CcmsWebhookPayload,
    background_tasks: BackgroundTasks,
    _: None = Depends(_verify_secret),
):
    """
    Called by CCMS when a case is disposed and the PDF is ready.
    Returns 202 immediately; ingestion runs in the background.
    """
    background_tasks.add_task(_fetch_and_ingest, payload)
    return {
        "accepted": True,
        "case_number": payload.case_number,
        "message": "Judgment queued for AI processing and human review",
    }


@router.get("/status/{case_number}")
async def ccms_case_status(
    case_number: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_secret),
):
    """CCMS polls this to check processing status of a specific case."""
    result = await db.execute(select(Case).where(Case.case_number == case_number))
    case = result.scalar_one_or_none()

    if not case:
        return {"case_number": case_number, "status": "NOT_FOUND", "message": "Not yet processed"}

    return {
        "case_number": case_number,
        "status": case.status,
        "filed_at": case.filed_at.isoformat(),
        "confidence_score": case.confidence_score,
        "message": "Case processed and pending human review" if case.status == "PENDING_REVIEW" else f"Case {case.status.lower()}",
    }
