"""
CCMS Integration Endpoint.

The Karnataka High Court CCMS system calls this webhook when a case is disposed
and a judgment PDF is ready. This mirrors the architecture described in the
problem statement: judgments are "automatically fetched into CCMS via API in PDF format."

CCMS sends:
  - case_number
  - disposed_at
  - pdf_url  (signed URL from the High Court CIS)

We fetch the PDF, run the full ingestion pipeline, and queue for human review.
"""
import httpx
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.base import Case, Directive, CaseStatus, ActionType
from app.routers.ingest import _run_ingestion_pipeline   # shared logic
from app.services.audit import append_audit_log

router = APIRouter(prefix="/ccms", tags=["ccms"])

CCMS_WEBHOOK_SECRET = settings.ccms_webhook_secret  # verified in header


class CcmsWebhookPayload(BaseModel):
    case_number: str
    court: str = "Karnataka High Court"
    disposed_at: str                 # ISO date string
    pdf_url: HttpUrl                 # Signed URL from High Court CIS
    petitioners: str = ""
    respondents: str = ""


async def _fetch_and_ingest(payload: CcmsWebhookPayload):
    """Background task: download PDF from CIS and run full pipeline."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(str(payload.pdf_url))
        resp.raise_for_status()
        pdf_bytes = resp.content

    async with AsyncSessionLocal() as db:
        try:
            await _run_ingestion_pipeline(
                pdf_bytes=pdf_bytes,
                filename=f"{payload.case_number}.pdf",
                db=db,
                user_id="ccms-system",  # System-initiated ingestion
                source="CCMS_AUTO_FETCH",
            )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            # Log failure but don't crash — CCMS will retry
            await append_audit_log(
                db,
                event="CCMS_INGEST_FAILED",
                details={"case_number": payload.case_number, "error": str(exc)},
            )
            await db.commit()
            raise


@router.post("/webhook")
async def ccms_webhook(
    payload: CcmsWebhookPayload,
    background_tasks: BackgroundTasks,
    x_ccms_secret: str = Header(..., alias="X-CCMS-Secret"),
):
    """
    Called by CCMS when a judgment is disposed and the PDF is ready.
    Validates the shared secret, then kicks off ingestion in the background
    so CCMS gets an immediate 202 response.
    """
    if x_ccms_secret != CCMS_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid CCMS webhook secret")

    background_tasks.add_task(_fetch_and_ingest, payload)
    return {
        "accepted": True,
        "case_number": payload.case_number,
        "message": "Judgment queued for AI processing and human review",
    }


@router.get("/status/{case_number}")
async def ccms_case_status(
    case_number: str,
    db: AsyncSession = Depends(lambda: AsyncSessionLocal().__aenter__()),
    x_ccms_secret: str = Header(..., alias="X-CCMS-Secret"),
):
    """
    CCMS can poll this endpoint to check if a judgment has been processed
    and what the current review status is.
    """
    if x_ccms_secret != CCMS_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid CCMS webhook secret")

    from sqlalchemy import select
    result = await db.execute(select(Case).where(Case.case_number == case_number))
    case = result.scalar_one_or_none()

    if not case:
        return {"case_number": case_number, "status": "NOT_FOUND"}

    return {
        "case_number": case_number,
        "status": case.status,
        "filed_at": case.filed_at.isoformat(),
        "confidence_score": case.confidence_score,
    }
