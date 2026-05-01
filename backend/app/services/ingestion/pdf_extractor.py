"""
Ingestion Layer: PDF text extraction using PyMuPDF + Tesseract OCR for scanned pages.
"""
import hashlib
import io
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from pdf2image import convert_from_bytes

from app.core.config import settings


@dataclass
class PageResult:
    page_number: int
    text: str
    quality_score: float  # 0-1, based on char density
    is_scanned: bool


@dataclass
class ExtractionResult:
    pages: list[PageResult] = field(default_factory=list)
    full_text: str = ""
    fingerprint: str = ""
    overall_quality: float = 0.0


SCANNED_QUALITY_THRESHOLD = 0.05  # chars/pixel ratio below this → OCR needed


def _quality_score(text: str, page_area: float) -> float:
    """Estimate text quality as character density on the page."""
    if page_area == 0:
        return 0.0
    density = len(text.strip()) / max(page_area, 1)
    return min(density * 1000, 1.0)


def extract_pdf(pdf_bytes: bytes) -> ExtractionResult:
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PageResult] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        rect = page.rect
        area = rect.width * rect.height

        text = page.get_text("text").strip()
        score = _quality_score(text, area)
        is_scanned = score < SCANNED_QUALITY_THRESHOLD

        if is_scanned:
            text = _ocr_page(pdf_bytes, page_index)
            score = _quality_score(text, area)

        pages.append(PageResult(
            page_number=page_index + 1,
            text=text,
            quality_score=round(score, 3),
            is_scanned=is_scanned,
        ))

    doc.close()

    full_text = "\n\n".join(p.text for p in pages if p.text)
    fingerprint = hashlib.sha256(full_text.encode()).hexdigest()
    overall_quality = sum(p.quality_score for p in pages) / max(len(pages), 1)

    return ExtractionResult(
        pages=pages,
        full_text=full_text,
        fingerprint=fingerprint,
        overall_quality=round(overall_quality, 3),
    )


def _ocr_page(pdf_bytes: bytes, page_index: int) -> str:
    poppler_path = settings.poppler_path or None
    images = convert_from_bytes(
        pdf_bytes,
        first_page=page_index + 1,
        last_page=page_index + 1,
        poppler_path=poppler_path,
    )
    if not images:
        return ""
    return pytesseract.image_to_string(images[0], lang="eng")
