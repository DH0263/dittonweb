# Backend Dockerfile - FastAPI + Playwright for ClassUp
# This Dockerfile is at repo root for Railway's GitHub integration
FROM python:3.11-slim

# Install system dependencies for Playwright + PostgreSQL
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libpq-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements (from backend folder)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and browser
RUN pip install playwright && \
    playwright install chromium && \
    playwright install-deps chromium

# Copy backend application code
COPY backend/ ./

# Create data directory
RUN mkdir -p /app/data

# Default port (Railway overrides via $PORT)
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/docs || exit 1

# Run the application
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
