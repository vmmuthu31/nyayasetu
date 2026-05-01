"""S3-compatible storage for PDFs, extracted text, highlights, exports."""
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
    return _client


def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    client = _get_client()
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def download_file(key: str) -> bytes:
    client = _get_client()
    response = client.get_object(Bucket=settings.s3_bucket_name, Key=key)
    return response["Body"].read()


def get_presigned_url(key: str, expires: int = 3600) -> str:
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires,
    )


def ensure_bucket():
    client = _get_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket_name)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket_name)
