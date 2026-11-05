# ==========================================
# ArogyaFlow Multi-Stage Production Dockerfile
# Monolith Architecture (Frontend + Backend in 1 Container)
# ==========================================

# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Backend & Unified App ---
FROM python:3.11-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend Code
COPY backend/ ./backend/

# Copy Built Frontend Distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

# Expose port (standard 8000 or platform $PORT)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Start Uvicorn
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
