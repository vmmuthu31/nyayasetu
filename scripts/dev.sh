#!/bin/bash
# One-command local dev startup: PostgreSQL + MinIO + Backend + Frontend
# Usage: bash scripts/dev.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NyayaSetu — Local Dev Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Start infra
bash "$ROOT/scripts/start-postgres.sh"
bash "$ROOT/scripts/start-minio.sh"

# 2. Start backend
echo ""
echo "🐍  Starting FastAPI backend..."
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "    Creating virtualenv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# 3. Start frontend
echo ""
echo "⚡  Starting Next.js frontend (Bun)..."
cd "$ROOT/frontend"
bun install --silent
bun dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  All services running!"
echo ""
echo "  Frontend:        http://localhost:3000"
echo "  Backend API:     http://localhost:8000"
echo "  API Docs:        http://localhost:8000/docs"
echo "  MinIO Console:   http://localhost:9001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait and clean up on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
