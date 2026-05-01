"""
Legal Chunking Engine:
- Structural parsing of judgment text
- Directive block detection via keyword heuristics
- Directive fingerprinting (SHA-256)
"""
import hashlib
import re
from dataclasses import dataclass, field


DIRECTIVE_KEYWORDS = [
    r"\bshall\b",
    r"\bdirected\b",
    r"\border(?:ed|s)?\b",
    r"\bhereby\s+direct",
    r"\bcommand(?:ed|s)?\b",
    r"\binstruct(?:ed|s|ion)?\b",
    r"\bmandator(?:y|ily)\b",
    r"\bcomply\b",
    r"\bwrit of\b",
    r"\bwrit\s+petition",
    r"\bquashed\b",
    r"\bstayed\b",
    r"\bregulariz(?:e|ation)\b",
    r"\breinstat(?:e|ement)\b",
    r"\bcompensation\b.*\bpaid\b",
    r"\bwithin\s+\d+\s+(?:days?|weeks?|months?)\b",
]

DEPARTMENT_PATTERNS = {
    "Labour Department": [r"labour\s+department", r"employment", r"worker", r"labour\s+commissioner"],
    "Education Department": [r"education\s+department", r"school", r"university", r"teacher", r"student"],
    "Revenue Department": [r"revenue\s+department", r"land\s+records", r"tahsildar", r"collector"],
    "Health Department": [r"health\s+department", r"hospital", r"medical", r"doctor", r"patient"],
    "Rural Development": [r"rural\s+development", r"panchayat", r"village", r"gram"],
    "Urban Development": [r"urban\s+development", r"municipality", r"corporation", r"civic"],
    "Public Works": [r"public\s+works", r"pwd", r"road", r"construction", r"infrastructure"],
    "Finance Department": [r"finance\s+department", r"treasury", r"budget", r"funds?"],
    "Home Department": [r"home\s+department", r"police", r"law\s+and\s+order", r"security"],
    "Agriculture Department": [r"agriculture\s+department", r"farmer", r"crop", r"irrigation"],
}

ACTION_PATTERNS = {
    "COMPLY": [r"shall\s+comply", r"directed\s+to", r"ordered\s+to", r"must", r"shall\s+implement"],
    "APPEAL": [r"appeal", r"challenge", r"impugned\s+order", r"set\s+aside"],
    "INFORM": [r"inform", r"notify", r"communicate", r"report\s+to"],
    "MONITOR": [r"monitor", r"supervise", r"oversight", r"review\s+periodically"],
}


@dataclass
class DirectiveChunk:
    text: str
    start_char: int
    end_char: int
    page_number: int | None
    action_type: str
    department: str
    confidence: float
    fingerprint: str
    is_ambiguous: bool = False
    ambiguity_reason: str = ""


def _detect_action_type(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    scores: dict[str, int] = {}
    for action, patterns in ACTION_PATTERNS.items():
        scores[action] = sum(1 for p in patterns if re.search(p, text_lower))
    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values()) or 1
    confidence = scores[best] / total
    return best, round(confidence, 2)


def _detect_department(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    scores: dict[str, int] = {}
    for dept, patterns in DEPARTMENT_PATTERNS.items():
        scores[dept] = sum(1 for p in patterns if re.search(p, text_lower))
    if max(scores.values()) == 0:
        return "General Administration", 0.3
    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values()) or 1
    confidence = scores[best] / total
    return best, round(confidence, 2)


def _is_directive_sentence(sentence: str) -> bool:
    s = sentence.lower()
    return any(re.search(p, s) for p in DIRECTIVE_KEYWORDS)


def _split_into_sentences(text: str) -> list[str]:
    return re.split(r"(?<=[.!?])\s+", text)


def extract_directives(full_text: str, pages: list[dict] | None = None) -> list[DirectiveChunk]:
    """
    Split text into paragraphs, detect directive blocks,
    classify action type and responsible department.
    """
    paragraphs = re.split(r"\n{2,}", full_text)
    directives: list[DirectiveChunk] = []
    char_offset = 0

    for para in paragraphs:
        para = para.strip()
        if not para or len(para) < 30:
            char_offset += len(para) + 2
            continue

        sentences = _split_into_sentences(para)
        directive_sentences = [s for s in sentences if _is_directive_sentence(s)]

        if directive_sentences:
            directive_text = " ".join(directive_sentences)
            action_type, action_conf = _detect_action_type(directive_text)
            department, dept_conf = _detect_department(full_text)

            confidence = round((action_conf + dept_conf) / 2, 2)
            fingerprint = hashlib.sha256(directive_text.encode()).hexdigest()

            is_ambiguous = confidence < 0.5
            ambiguity_reason = ""
            if confidence < 0.3:
                ambiguity_reason = "Very low confidence in department and action detection"
            elif confidence < 0.5:
                ambiguity_reason = "Ambiguous department or action type — human review needed"

            directives.append(DirectiveChunk(
                text=directive_text,
                start_char=char_offset,
                end_char=char_offset + len(para),
                page_number=None,
                action_type=action_type,
                department=department,
                confidence=confidence,
                fingerprint=fingerprint,
                is_ambiguous=is_ambiguous,
                ambiguity_reason=ambiguity_reason,
            ))

        char_offset += len(para) + 2

    return directives
