"""
Action Plan Generation Layer:
- Action Mapper: maps directives to COMPLY/APPEAL/INFORM/MONITOR
- Timeline Engine: extracts deadlines, infers 30/90-day defaults
- Ambiguity Detector: flags low-confidence items for human review
"""
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta


DEFAULT_DEADLINES = {
    "COMPLY": 30,   # days
    "APPEAL": 90,
    "INFORM": 30,
    "MONITOR": 90,
}

DEADLINE_PATTERNS = [
    (r"within\s+(\d+)\s+days?", lambda m: int(m.group(1))),
    (r"within\s+(\d+)\s+weeks?", lambda m: int(m.group(1)) * 7),
    (r"within\s+(\d+)\s+months?", lambda m: int(m.group(1)) * 30),
    (r"(\d+)\s+days?\s+from", lambda m: int(m.group(1))),
    (r"(\d+)\s+weeks?\s+from", lambda m: int(m.group(1)) * 7),
]


@dataclass
class ActionPlan:
    directive_text: str
    action_type: str
    department: str
    deadline: datetime | None
    deadline_source: str  # "extracted" | "default" | "none"
    confidence_score: float
    fingerprint: str
    is_ambiguous: bool
    ambiguity_reason: str


def _extract_deadline_days(text: str) -> int | None:
    text_lower = text.lower()
    for pattern, extractor in DEADLINE_PATTERNS:
        m = re.search(pattern, text_lower)
        if m:
            return extractor(m)
    return None


def generate_action_plans(
    directives: list[dict],
    judgment_date: datetime | None = None,
) -> list[ActionPlan]:
    base_date = judgment_date or datetime.utcnow()
    plans: list[ActionPlan] = []

    for d in directives:
        text = d.get("text", "")
        action_type = d.get("action_type", "COMPLY")
        department = d.get("department", "General Administration")
        confidence = float(d.get("confidence", 0.5))

        # Timeline engine
        days = _extract_deadline_days(text)
        if days is not None:
            deadline = base_date + timedelta(days=days)
            deadline_source = "extracted"
        elif d.get("deadline_days"):
            deadline = base_date + timedelta(days=int(d["deadline_days"]))
            deadline_source = "extracted"
        else:
            default_days = DEFAULT_DEADLINES.get(action_type, 30)
            deadline = base_date + timedelta(days=default_days)
            deadline_source = "default"

        # Ambiguity detector
        is_ambiguous = confidence < 0.5 or d.get("is_ambiguous", False)
        ambiguity_reason = d.get("ambiguity_reason", "")
        if not ambiguity_reason and confidence < 0.5:
            ambiguity_reason = f"Low confidence score: {confidence:.2f}"

        fingerprint = hashlib.sha256(text.encode()).hexdigest()

        plans.append(ActionPlan(
            directive_text=text,
            action_type=action_type,
            department=department,
            deadline=deadline,
            deadline_source=deadline_source,
            confidence_score=confidence,
            fingerprint=fingerprint,
            is_ambiguous=is_ambiguous,
            ambiguity_reason=ambiguity_reason,
        ))

    return plans
