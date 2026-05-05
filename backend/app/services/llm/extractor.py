"""
LLM Layer — Groq API (free tier) for entity extraction and directive analysis.
Uses llama-3.3-70b-versatile by default (128k context, very fast).
Raw PDF bytes are never sent — only extracted text chunks.
"""
import json
import logging
from dataclasses import dataclass

from groq import Groq

from app.core.config import settings

log = logging.getLogger(__name__)

# Lazy client — instantiated on first use so app boots even without a key.
_client: Groq | None = None


def _get_client() -> Groq | None:
    global _client
    if not settings.groq_api_key:
        return None
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client

SYSTEM_PROMPT = """You are a strict legal information extraction engine for NyayaSetu — an AI-powered court judgment intelligence system used across all Indian High Courts and judicial bodies.

Your role is NOT to interpret, summarize, or infer.
Your ONLY task is to extract explicitly stated information from the provided judgment text and return structured JSON.

CRITICAL RULES:

1. ZERO HALLUCINATION
- Do NOT generate, assume, or infer any information.
- If a field is not explicitly present in the text, return null or empty.
- Never fabricate case numbers, party names, dates, or departments.

2. STRICT TEXT GROUNDING
- Every extracted value MUST be directly traceable to the input text.
- Directive "text" fields MUST be exact verbatim spans (no paraphrasing, no rewriting).

3. CONSERVATIVE EXTRACTION
- If there is ambiguity, mark:
  - "is_ambiguous": true
  - Provide a clear "ambiguity_reason"
- Prefer missing data over incorrect data.

4. DIRECTIVE CLASSIFICATION RULES
- COMPLY → आदेश पालन / تنفيذ instruction
- APPEAL → right to challenge or appeal
- INFORM → notify/report/communicate
- MONITOR → ongoing supervision/compliance tracking
- If classification is unclear → mark ambiguous

5. DEADLINE HANDLING
- Extract deadline_text exactly as written
- Convert to deadline_days ONLY if clearly computable:
  - 1 week = 7 days
  - 1 month = 30 days (ONLY if explicitly stated as month-based duration)
- If unclear → deadline_days = null

6. DEPARTMENT MAPPING
- Extract ONLY if explicitly mentioned
- Do NOT guess based on context
- If unclear → mark ambiguous

7. OUTPUT FORMAT ENFORCEMENT
- Output MUST be valid JSON
- No explanations, no markdown, no comments
- Follow schema exactly

8. ERROR HANDLING
- If input is insufficient or corrupted → return empty structured fields
- Never break JSON format

Remember:
This system is used in a judicial workflow. Incorrect extraction is worse than missing data.
Be precise. Be conservative. Be literal."""

EXTRACTION_PROMPT = """Analyze the following Indian court judgment text and extract structured data.

Follow ALL instructions strictly.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- No markdown, no explanations, no extra text
- Use null for missing fields (do NOT guess)
- Use empty string "" or [] where appropriate
- Follow the schema EXACTLY

SCHEMA:

{
  "case_number": string | null,
  "court": string | null,
  "petitioners": string,
  "respondents": string,
  "judgment_date": string | null,
  "directives": [
    {
      "text": string,
      "action_type": "COMPLY" | "APPEAL" | "INFORM" | "MONITOR",
      "department": string | null,
      "deadline_text": string | null,
      "deadline_days": integer | null,
      "confidence": number,
      "is_ambiguous": boolean,
      "ambiguity_reason": string | null
    }
  ]
}

EXTRACTION RULES:

1. CASE NUMBER
- Extract the full case number exactly as written
- If multiple exist, choose the primary case heading
- If not found → null

2. COURT
- Extract only if explicitly mentioned
- Example: "Karnataka High Court"
- If not found → null

3. PETITIONERS / RESPONDENTS
- Extract names exactly as written
- Return as comma-separated string
- Do NOT normalize or infer roles

4. JUDGMENT DATE
- Convert to YYYY-MM-DD ONLY if clearly present
- If unclear or missing → null

5. DIRECTIVES (CRITICAL)
- Extract ONLY explicit directions/orders from the judgment
- Each directive MUST:
  - Be copied VERBATIM (no paraphrasing)
  - Be a complete sentence or logical directive block

6. ACTION TYPE CLASSIFICATION
- COMPLY → instruction to perform an action
- APPEAL → right or permission to challenge
- INFORM → notify/report/submit information
- MONITOR → ongoing compliance or supervision
- If unclear → set is_ambiguous = true

7. DEPARTMENT
- Extract ONLY if explicitly mentioned
- Do NOT infer from context
- If unclear → null + mark ambiguous

8. DEADLINES
- deadline_text → copy exact phrase (e.g. "within 8 weeks")
- deadline_days → compute ONLY if unambiguous:
  - weeks × 7
  - months × 30 (ONLY if clearly duration-based)
- If unclear → null

9. CONFIDENCE SCORE
- 0.9–1.0 → explicit and clear
- 0.6–0.8 → minor ambiguity
- 0.0–0.5 → weak or partial extraction

10. AMBIGUITY HANDLING
- If ANY field in directive is unclear:
  - set is_ambiguous = true
  - provide short ambiguity_reason
- Otherwise:
  - is_ambiguous = false
  - ambiguity_reason = null

IMPORTANT:
- Do NOT hallucinate missing information
- Do NOT paraphrase directive text
- Prefer null over incorrect data
- Ensure JSON is valid and complete

JUDGMENT TEXT:
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


def _empty_result(text: str, reason: str) -> ExtractedCase:
    """Return an empty extraction so the rest of the pipeline (legal_chunker) can take over."""
    log.warning("LLM extraction unavailable: %s — falling back to legal_chunker", reason)
    return ExtractedCase(
        case_number="",
        court="",
        petitioners="",
        respondents="",
        judgment_date=None,
        directives=[],
        raw_response=f'{{"_fallback_reason": "{reason}"}}',
    )


def extract_case_entities(text: str, max_chars: int = 12000) -> ExtractedCase:
    """
    Send extracted (text-only) judgment content to Groq LLM.
    max_chars=12000 uses ~3k tokens — well within free tier limits.
    llama-3.3-70b-versatile supports 128k context and 6000 req/day free.

    On any failure (no API key, network error, quota exceeded, malformed JSON)
    returns an empty ExtractedCase so the regex-based legal_chunker can take over.
    """
    client = _get_client()
    if client is None:
        return _empty_result(text, "groq_api_key not configured")

    truncated = text[:max_chars]

    try:
        response = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": EXTRACTION_PROMPT.format(text=truncated)},
            ],
            temperature=0.1,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
    except Exception as e:
        return _empty_result(text, f"groq_api_error: {type(e).__name__}")

    raw = response.choices[0].message.content or "{}"

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            data = {}

    return ExtractedCase(
        # Prefer null/empty over fake placeholders — UI renders "—" when blank
        case_number=(data.get("case_number") or "").strip(),
        court=(data.get("court") or "").strip(),
        petitioners=(data.get("petitioners") or "").strip(),
        respondents=(data.get("respondents") or "").strip(),
        judgment_date=data.get("judgment_date"),
        directives=data.get("directives") or [],
        raw_response=raw,
    )
