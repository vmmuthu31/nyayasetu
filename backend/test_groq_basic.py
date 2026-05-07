#!/usr/bin/env python3
"""Test basic Groq API connectivity"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.config import settings
from groq import Groq

def test_basic():
    client = Groq(api_key=settings.groq_api_key)
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Return valid JSON: {\"test\": true}"}],
            temperature=0.1,
            max_tokens=100,
        )
        
        print(f"✓ Response received")
        print(f"  Type: {type(response)}")
        print(f"  Choices: {type(response.choices)}, len={len(response.choices)}")
        
        choice = response.choices[0]
        print(f"  Choice type: {type(choice)}")
        print(f"  Message type: {type(choice.message)}")
        print(f"  Content type: {type(choice.message.content)}")
        print(f"\n  Content:\n{choice.message.content}")
        
        return True
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if not settings.groq_api_key:
        print("✗ GROQ_API_KEY not set")
        sys.exit(1)
    
    success = test_basic()
    sys.exit(0 if success else 1)
