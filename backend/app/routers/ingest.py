"""
Ingestion endpoint — upload PDF → OCR → chunk → LLM → action plan → persist.
The core pipeline is extracted into _run_ingestion_pipeline() so it can be
reused by both the manual upload endpoint and the CCMS auto-fetch webhook.
"""
from datetime import datetime
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.base import Case, Directive, CaseStatus, ActionType, User
from app.routers.deps import get_current_user
from app.services.audit import append_audit_log
from app.services.ingestion import storage
from app.services.ingestion.pdf_extractor import extract_pdf, find_highlight_coords
from app.services.chunking.legal_chunker import extract_directives
from app.services.llm.extractor import extract_case_entities
from app.services.action_plan.generator import generate_action_plans

router = APIRouter(prefix="/ingest", tags=["ingest"])


@dataclass
class IngestionResult:
    case_id: str
    case_number: str
    directive_count: int
    quality_score: float
    ambiguous_count: int


async def _run_ingestion_pipeline(
    *,
    pdf_bytes: bytes,
    filename: str,
    db: AsyncSession,
    user_id: str,
    source: str = "MANUAL_UPLOAD",
) -> IngestionResult:
    """
    Shared ingestion pipeline used by both manual upload and CCMS auto-fetch.
    Steps:
      1. PyMuPDF text extraction + Tesseract OCR fallback
      2. LLM entity extraction (text only — no raw PII to LLM)
      3. Rule-based legal chunking (fallback / supplementary)
      4. Action plan generation (COMPLY/APPEAL/INFORM/MONITOR + timelines)
      5. S3 PDF storage
      6. PostgreSQL persistence (case + directives with highlight coords)
      7. Immutable audit log entry
    """
    # Step 1: Extract text + span coordinates (PyMuPDF → Tesseract fallback)
    extraction = extract_pdf(pdf_bytes)

    # Step 2: LLM entity extraction — text only, no raw PDF bytes sent
    llm_result = extract_case_entities(extraction.full_text)

    # Step 3: Rule-based chunking (used when LLM returns no directives)
    rule_directives = extract_directives(extraction.full_text)
    directives_data = llm_result.directives or [
        {
            "text": d.text,
            "action_type": d.action_type,
            "department": d.department,
            "confidence": d.confidence,
            "is_ambiguous": d.is_ambiguous,
            "ambiguity_reason": d.ambiguity_reason,
        }
        for d in rule_directives
    ]

    # Step 4: Action plan generation
    judgment_date = None
    if llm_result.judgment_date:
        try:
            judgment_date = datetime.fromisoformat(llm_result.judgment_date)
        except ValueError:
            pass

    action_plans = generate_action_plans(directives_data, judgment_date)

    # Step 5: Store original PDF in S3-compatible storage
    storage_key = f"pdfs/{llm_result.case_number}/{filename}"
    try:
        storage.upload_file(storage_key, pdf_bytes, "application/pdf")
    except Exception:
        storage_key = None  # Degraded mode: proceed without storage

    # Step 6a: Persist case
    avg_confidence = (
        sum(p.confidence_score for p in action_plans) / len(action_plans)
        if action_plans else 0.0
    )
    case = Case(
        case_number=llm_result.case_number,
        court=llm_result.court,
        petitioners=llm_result.petitioners,
        respondents=llm_result.respondents,
        judgment_date=judgment_date,
        status=CaseStatus.PENDING_REVIEW,
        pdf_storage_key=storage_key,
        extracted_text=extraction.full_text[:50000],  # Truncate for DB column
        confidence_score=round(avg_confidence, 3),
        fingerprint=extraction.fingerprint,
    )
    db.add(case)
    await db.flush()  # Get case.id without committing

    # Step 6b: Persist directives with real PDF highlight bounding boxes
    for plan in action_plans:
        highlight_coords = find_highlight_coords(plan.directive_text, extraction.all_spans)
        page_number = highlight_coords[0]["page"] if highlight_coords else None

        d = Directive(
            case_id=case.id,
            text=plan.directive_text,
            action_type=ActionType(plan.action_type),
            department=plan.department,
            deadline=plan.deadline,
            confidence_score=plan.confidence_score,
            fingerprint=plan.fingerprint,
            is_ambiguous=plan.is_ambiguous,
            ambiguity_reason=plan.ambiguity_reason,
            highlight_coords=highlight_coords,
            page_number=page_number,
            limitation_days=plan.limitation_days,
        )
        db.add(d)

    # Step 7: Append immutable audit log entry
    await append_audit_log(
        db,
        event="CASE_INGESTED",
        case_id=case.id,
        user_id=user_id if user_id != "ccms-system" else None,
        details={
            "filename": filename,
            "source": source,
            "quality_score": extraction.overall_quality,
            "directive_count": len(action_plans),
            "ambiguous_count": sum(1 for p in action_plans if p.is_ambiguous),
        },
    )

    return IngestionResult(
        case_id=case.id,
        case_number=case.case_number,
        directive_count=len(action_plans),
        quality_score=extraction.overall_quality,
        ambiguous_count=sum(1 for p in action_plans if p.is_ambiguous),
    )


class IngestResponse(BaseModel):
    case_id: str
    case_number: str
    directive_count: int
    quality_score: float
    ambiguous_count: int
    message: str


@router.post("", response_model=IngestResponse)
async def ingest_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    result = await _run_ingestion_pipeline(
        pdf_bytes=pdf_bytes,
        filename=file.filename,
        db=db,
        user_id=current_user.id,
        source="MANUAL_UPLOAD",
    )
    await db.commit()

    return IngestResponse(
        **result.__dict__,
        message="Case ingested successfully and queued for human review",
    )
