# Backend Dockerfile - FastAPI + Playwright for ClassUp
# Simplified: copies everything and extracts backend
# Cache buster: v3
FROM python:3.11-slim AS builder

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

# Copy everything first
COPY . /build-context/

# Debug: List what was copied
RUN ls -la /build-context/ && \
    echo "---" && \
    ls -la /build-context/backend/ 2>/dev/null || echo "No backend folder found"

# Copy requirements from wherever they are
RUN if [ -f /build-context/backend/requirements.txt ]; then \
        cp /build-context/backend/requirements.txt /app/requirements.txt; \
    elif [ -f /build-context/requirements.txt ]; then \
        cp /build-context/requirements.txt /app/requirements.txt; \
    fi

RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and browser
RUN pip install playwright && \
    playwright install chromium && \
    playwright install-deps chromium

# Copy backend code from wherever it is
RUN if [ -d /build-context/backend ]; then \
        cp -r /build-context/backend/* /app/; \
    else \
        cp -r /build-context/* /app/; \
    fi

# Clean up build context
RUN rm -rf /build-context

# Create data directory
RUN mkdir -p /app/data

# Default port (Railway overrides via $PORT)
ENV PORT=8000

# Health check (skip for worker services that don't have /docs endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Create startup script that detects service type at RUNTIME
RUN printf '#!/bin/sh\n\
if [ -f /app/main.py ] && grep -q "run_worker" /app/main.py 2>/dev/null; then\n\
    echo "Starting ClassUp Worker..."\n\
    exec python main.py\n\
else\n\
    echo "Starting FastAPI Server..."\n\
    exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}\n\
fi\n' > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]
