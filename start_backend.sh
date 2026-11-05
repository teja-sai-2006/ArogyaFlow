#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
echo "🚀 Starting ArogyaFlow FastAPI Backend on http://localhost:8000 ..."
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
