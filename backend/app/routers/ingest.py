"""Ingestion endpoint: upload PDF → OCR → chunk → LLM → action plan → persist."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
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

    # Step 1: Extract text (PyMuPDF + Tesseract fallback)
    extraction = extract_pdf(pdf_bytes)

    # Step 2: LLM entity extraction (on text only, no raw PDF)
    llm_result = extract_case_entities(extraction.full_text)

    # Step 3: Rule-based chunking for additional directives
    rule_directives = extract_directives(extraction.full_text)

    # Merge LLM directives with rule-based (LLM takes priority)
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

    # Step 5: Store PDF
    storage_key = f"pdfs/{llm_result.case_number}/{file.filename}"
    try:
        storage.upload_file(storage_key, pdf_bytes, "application/pdf")
    except Exception:
        storage_key = None

    # Step 6: Persist case
    case = Case(
        case_number=llm_result.case_number,
        court=llm_result.court,
        petitioners=llm_result.petitioners,
        respondents=llm_result.respondents,
        judgment_date=judgment_date,
        status=CaseStatus.PENDING_REVIEW,
        pdf_storage_key=storage_key,
        extracted_text=extraction.full_text[:50000],
        confidence_score=sum(p.confidence_score for p in action_plans) / max(len(action_plans), 1),
        fingerprint=extraction.fingerprint,
    )
    db.add(case)
    await db.flush()

    # Step 7: Persist directives — with real PDF highlight coordinates
    for plan in action_plans:
        # Find where in the PDF this directive text actually appears
        highlight_coords = find_highlight_coords(plan.directive_text, extraction.all_spans)

        # Determine which page this directive is on
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
            highlight_coords=highlight_coords,   # Real PDF bbox coordinates
            page_number=page_number,
        )
        db.add(d)

    # Step 8: Audit log
    await append_audit_log(
        db,
        event="CASE_INGESTED",
        case_id=case.id,
        user_id=current_user.id,
        details={
            "filename": file.filename,
            "quality_score": extraction.overall_quality,
            "directive_count": len(action_plans),
        },
    )

    await db.commit()

    return IngestResponse(
        case_id=case.id,
        case_number=case.case_number,
        directive_count=len(action_plans),
        quality_score=extraction.overall_quality,
        ambiguous_count=sum(1 for p in action_plans if p.is_ambiguous),
        message="Case ingested successfully and queued for human review",
    )
