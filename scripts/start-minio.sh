#!/bin/bash
# Starts MinIO (local S3) and creates the nyayasetu bucket automatically.
# Run once before starting the backend.

set -e

CONTAINER_NAME="nyayasetu-minio"
BUCKET="nyayasetu"
ACCESS_KEY="minioadmin"
SECRET_KEY="minioadmin"

echo "🪣  Starting MinIO..."

# Stop + remove old container if exists
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# Start MinIO
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER="$ACCESS_KEY" \
  -e MINIO_ROOT_PASSWORD="$SECRET_KEY" \
  -v nyayasetu-minio-data:/data \
  minio/minio server /data --console-address ":9001"

echo "⏳  Waiting for MinIO to be ready..."
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  sleep 1
done

echo "🗂️  Creating bucket: $BUCKET"

# Use mc (MinIO Client) inside the container to create the bucket
docker exec "$CONTAINER_NAME" sh -c "
  mc alias set local http://localhost:9000 $ACCESS_KEY $SECRET_KEY --quiet &&
  mc mb local/$BUCKET --ignore-existing
"

echo ""
echo "✅  MinIO is running!"
echo "   API:     http://localhost:9000"
echo "   Console: http://localhost:9001  (login: $ACCESS_KEY / $SECRET_KEY)"
echo "   Bucket:  $BUCKET"
