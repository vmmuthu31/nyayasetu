#!/bin/bash
# One-command local dev startup: PostgreSQL + MinIO + Backend + Frontend
# Usage: bash scripts/dev.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NyayaSetu — Local Dev Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 0. Free ports used by previous dev session (idempotent — safe if nothing is running)
echo "🔪  Clearing dev ports..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Stop any native Homebrew PostgreSQL that would conflict with Docker on :5432
for pg_ver in postgresql postgresql@14 postgresql@15 postgresql@16 postgresql@17; do
  brew services list 2>/dev/null | grep -q "^${pg_ver}.*started" && \
    brew services stop "$pg_ver" 2>/dev/null && \
    echo "   Stopped Homebrew $pg_ver (conflicts with Docker on :5432)" || true
done

# 1. Start infra
bash "$ROOT/scripts/start-postgres.sh"
bash "$ROOT/scripts/start-minio.sh"

# 2. Start backend
echo ""
echo "🐍  Starting FastAPI backend..."
cd "$ROOT/backend"

# Pick the best available Python interpreter
if command -v python3.12 &>/dev/null; then
  PYTHON_BIN=python3.12
elif command -v python3.11 &>/dev/null; then
  PYTHON_BIN=python3.11
else
  PYTHON_BIN=python3
fi

# If .venv exists but pydantic is broken (e.g. created with Python 3.14 + old pydantic-core),
# remove it so it gets recreated with the correct interpreter.
if [ -d ".venv" ]; then
  if ! .venv/bin/python -c "import pydantic" 2>/dev/null; then
    echo "    ⚠️  Stale/broken venv detected — removing and recreating..."
    rm -rf .venv
  fi
fi

if [ ! -d ".venv" ]; then
  echo "    Creating virtualenv with $PYTHON_BIN ($(${PYTHON_BIN} --version))..."
  $PYTHON_BIN -m venv .venv
fi
source .venv/bin/activate
pip install -q --upgrade pip
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
