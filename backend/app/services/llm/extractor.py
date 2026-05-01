"""
LLM Layer (Claude API) — Entity extraction, structured directive analysis.
Raw PII is never sent; only extracted/chunked text is used.
"""
import json
from dataclasses import dataclass

import anthropic

from app.core.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """You are a legal AI assistant for the Karnataka High Court case management system.
Your task is to analyze court judgment text and extract structured information.
Be precise, conservative, and flag anything uncertain.
Never invent information not present in the text."""

EXTRACTION_PROMPT = """Analyze the following court judgment text and extract:

1. case_number: The full case number (e.g. WP 12345/2025)
2. court: Court name
3. petitioners: Names of petitioners (comma-separated)
4. respondents: Names of respondents (comma-separated)
5. judgment_date: Date in YYYY-MM-DD format (null if not found)
6. directives: Array of directive objects, each with:
   - text: The exact directive text
   - action_type: One of COMPLY, APPEAL, INFORM, MONITOR
   - department: The responsible government department
   - deadline_text: Raw deadline text from judgment (e.g. "within 8 weeks", null if none)
   - deadline_days: Number of days from judgment date (null if unclear)
   - confidence: 0.0-1.0 confidence score
   - is_ambiguous: true if human review needed

Return ONLY valid JSON. No explanation.

TEXT:
{text}"""


@dataclass
class ExtractedCase:
    case_number: str
    court: str
    petitioners: str
    respondents: str
    judgment_date: str | None
    directives: list[dict]
    raw_response: str


def extract_case_entities(text: str, max_chars: int = 8000) -> ExtractedCase:
    # Truncate to avoid excessive token use; send only the judgment body
    truncated = text[:max_chars]

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
                "content": EXTRACTION_PROMPT.format(text=truncated),
            }
        ],
        system=SYSTEM_PROMPT,
    )

    raw = message.content[0].text
    try:
        # Strip markdown code fences if present
        clean = raw.strip()
        if clean.startswith("```"):
            clean = "\n".join(clean.split("\n")[1:-1])
        data = json.loads(clean)
    except json.JSONDecodeError:
        data = {}

    return ExtractedCase(
        case_number=data.get("case_number", "UNKNOWN"),
        court=data.get("court", "Karnataka High Court"),
        petitioners=data.get("petitioners", ""),
        respondents=data.get("respondents", ""),
        judgment_date=data.get("judgment_date"),
        directives=data.get("directives", []),
        raw_response=raw,
    )
