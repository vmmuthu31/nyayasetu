#!/usr/bin/env python3
"""
Diagnostic script to test Groq API connection and LLM extraction.
Run: python test_groq_connection.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from app.services.llm.extractor import extract_case_entities

def test_groq_config():
    """Verify Groq API key is loaded."""
    print("=" * 60)
    print("GROQ CONFIGURATION CHECK")
    print("=" * 60)
    
    print(f"\n✓ GROQ_API_KEY present: {bool(settings.groq_api_key)}")
    if settings.groq_api_key:
        masked = settings.groq_api_key[:10] + "..." + settings.groq_api_key[-5:]
        print(f"  Value: {masked}")
        print(f"  Format valid (starts with 'gsk_'): {settings.groq_api_key.startswith('gsk_')}")
    print(f"✓ GROQ_MODEL: {settings.groq_model}")
    
    return bool(settings.groq_api_key and settings.groq_api_key.startswith("gsk_"))


def test_extraction():
    """Test LLM extraction with a sample judgment."""
    print("\n" + "=" * 60)
    print("LLM EXTRACTION TEST")
    print("=" * 60)
    
    sample_text = """
    IN THE HIGH COURT OF KARNATAKA AT BENGALURU
    Writ Petition No. WP 2345/2026
    
    Petitioner: Lakshmi Devi vs. Respondents: BBMP
    
    ORDER
    
    Date: 14 May 2026
    
    This Court is of the opinion that the BBMP shall immediately remove all unauthorized 
    construction debris and commercial waste accumulated in the area identified by the petitioner 
    within 10 days from the date of receipt of this order.
    
    The Urban Development Department shall review the compliance reports and take appropriate 
    policy measures within 30 days.
    
    The respondents shall ensure that no further unauthorized dumping occurs and shall install 
    warning boards within 15 days.
    """
    
    print(f"\nSending {len(sample_text)} chars to Groq for extraction...")
    
    result = extract_case_entities(sample_text)
    
    print(f"\n✓ Extraction completed")
    print(f"  Case Number: {result.case_number or '(empty)'}")
    print(f"  Court: {result.court or '(empty)'}")
    print(f"  Petitioners: {result.petitioners or '(empty)'}")
    print(f"  Respondents: {result.respondents or '(empty)'}")
    print(f"  Directives found: {len(result.directives)}")
    
    if result.directives:
        print("\n  Extracted Directives:")
        for i, d in enumerate(result.directives, 1):
            action = d.get("action_type", "?")
            confidence = d.get("confidence", "?")
            print(f"    [{i}] {action} (confidence: {confidence})")
            if d.get("text"):
                print(f"        Text: {d['text'][:80]}..." if len(d['text']) > 80 else f"        Text: {d['text']}")
    
    if "fallback_reason" in result.raw_response:
        print(f"\n✗ FALLBACK TRIGGERED: {json.loads(result.raw_response).get('_fallback_reason')}")
        return False
    
    print("\n✓ Extraction successful (no fallback)")
    return True


if __name__ == "__main__":
    config_ok = test_groq_config()
    
    if not config_ok:
        print("\n✗ GROQ configuration is incomplete or invalid")
        print("  Please verify GROQ_API_KEY in .env file")
        sys.exit(1)
    
    print("\n✓ Configuration OK, testing extraction...")
    
    extraction_ok = test_extraction()
    
    if extraction_ok:
        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED - Groq API is working correctly")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("✗ EXTRACTION FAILED - Check logs for details")
        print("=" * 60)
        sys.exit(1)
