#!/bin/bash
# Starts PostgreSQL locally via Docker.

set -e

CONTAINER_NAME="nyayasetu-postgres"

echo "🐘  Starting PostgreSQL..."

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER_NAME" \
  -p 5432:5432 \
  -e POSTGRES_DB=nyayasetu \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -v nyayasetu-pg-data:/var/lib/postgresql/data \
  postgres:16-alpine

echo "⏳  Waiting for PostgreSQL to be ready..."
until docker exec "$CONTAINER_NAME" pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo ""
echo "✅  PostgreSQL is running!"
echo "   Host:     localhost:5432"
echo "   DB:       nyayasetu"
echo "   User:     postgres / password"
echo "   URL:      postgresql+asyncpg://postgres:password@localhost:5432/nyayasetu"
