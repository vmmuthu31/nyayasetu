"""
Ingestion Layer:
- PyMuPDF for digital PDF text + bbox coordinates
- Tesseract OCR fallback for scanned pages
- Returns per-page text AND highlight coordinates for every text span
"""
import hashlib
from dataclasses import dataclass, field

import fitz  # PyMuPDF
import pytesseract
from pdf2image import convert_from_bytes

from app.core.config import settings


@dataclass
class TextSpan:
    """A located piece of text on a page with its bounding box."""
    text: str
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    page_width: float
    page_height: float


@dataclass
class PageResult:
    page_number: int
    text: str
    quality_score: float
    is_scanned: bool
    spans: list[TextSpan] = field(default_factory=list)


@dataclass
class ExtractionResult:
    pages: list[PageResult] = field(default_factory=list)
    full_text: str = ""
    fingerprint: str = ""
    overall_quality: float = 0.0
    all_spans: list[TextSpan] = field(default_factory=list)


SCANNED_QUALITY_THRESHOLD = 0.05


def _quality_score(text: str, area: float) -> float:
    if area == 0:
        return 0.0
    return min(len(text.strip()) / max(area, 1) * 1000, 1.0)


def extract_pdf(pdf_bytes: bytes) -> ExtractionResult:
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[PageResult] = []
    all_spans: list[TextSpan] = []

    for page_index in range(len(doc)):
        page = doc[page_index]
        pw, ph = page.rect.width, page.rect.height
        area = pw * ph

        # Extract text with bounding boxes (dict mode gives span-level coords)
        raw_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
        spans: list[TextSpan] = []
        full_page_text_parts: list[str] = []

        for block in raw_dict.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if not t:
                        continue
                    bbox = span.get("bbox", [0, 0, 0, 0])
                    s = TextSpan(
                        text=t,
                        page=page_index + 1,
                        x0=round(bbox[0], 2),
                        y0=round(bbox[1], 2),
                        x1=round(bbox[2], 2),
                        y1=round(bbox[3], 2),
                        page_width=round(pw, 2),
                        page_height=round(ph, 2),
                    )
                    spans.append(s)
                    full_page_text_parts.append(t)

        text = " ".join(full_page_text_parts)
        score = _quality_score(text, area)
        is_scanned = score < SCANNED_QUALITY_THRESHOLD

        if is_scanned:
            # Fall back to OCR — no span coords available for scanned pages
            text = _ocr_page(pdf_bytes, page_index)
            score = _quality_score(text, area)
            spans = []  # No coords from OCR

        pages.append(PageResult(
            page_number=page_index + 1,
            text=text,
            quality_score=round(score, 3),
            is_scanned=is_scanned,
            spans=spans,
        ))
        all_spans.extend(spans)

    doc.close()

    full_text = "\n\n".join(p.text for p in pages if p.text)
    fingerprint = hashlib.sha256(full_text.encode()).hexdigest()
    overall_quality = sum(p.quality_score for p in pages) / max(len(pages), 1)

    return ExtractionResult(
        pages=pages,
        full_text=full_text,
        fingerprint=fingerprint,
        overall_quality=round(overall_quality, 3),
        all_spans=all_spans,
    )


def find_highlight_coords(directive_text: str, spans: list[TextSpan]) -> list[dict]:
    """
    Find bounding boxes in the PDF that match a directive's text.
    Returns a list of {page, x0, y0, x1, y1, page_width, page_height}
    suitable for rendering as highlight overlays on the frontend.
    """
    if not spans or not directive_text:
        return []

    # Normalize for matching
    needle = directive_text.lower().split()
    if not needle:
        return []

    results: list[dict] = []
    span_texts = [s.text.lower() for s in spans]

    # Sliding window — look for runs of spans whose joined text contains the needle words
    window = 15  # spans to look at per window
    for i in range(len(spans)):
        window_spans = spans[i: i + window]
        window_text = " ".join(s.text.lower() for s in window_spans)
        # Check if at least 60% of needle words appear in this window
        matched = sum(1 for w in needle if w in window_text)
        if matched / max(len(needle), 1) >= 0.6:
            # Return bounding box covering all spans in window
            x0 = min(s.x0 for s in window_spans)
            y0 = min(s.y0 for s in window_spans)
            x1 = max(s.x1 for s in window_spans)
            y1 = max(s.y1 for s in window_spans)
            results.append({
                "page": window_spans[0].page,
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "page_width": window_spans[0].page_width,
                "page_height": window_spans[0].page_height,
            })
            if len(results) >= 3:  # Max 3 highlight regions per directive
                break

    return results


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
