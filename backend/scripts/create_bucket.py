#!/usr/bin/env python3
"""Create configured S3 bucket (useful when MinIO just started)."""
from app.services.ingestion import storage

if __name__ == "__main__":
    try:
        storage.ensure_bucket()
        print("✓ Bucket ensured/created")
    except Exception as e:
        print("✗ Failed to ensure bucket:", type(e).__name__, str(e))
