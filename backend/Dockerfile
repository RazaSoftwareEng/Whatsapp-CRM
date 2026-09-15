# =============================================================================
# STAGE 1 — builder
# Install all dependencies and compile wheels.
# This stage has build tools (gcc, libpq-dev) that we don't want in production.
# =============================================================================
FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build dependencies (needed to compile psycopg, cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --upgrade pip

# Copy only requirements — Docker layer cache: re-builds only when deps change
COPY requirements/ requirements/

# Build wheel files for all production packages (no internet needed in final stage)
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements/production.txt


# =============================================================================
# STAGE 2 — final production image
# Clean Python slim image — no build tools, only runtime libraries.
# =============================================================================
FROM python:3.12-slim AS final

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Gunicorn will write to stdout/stderr (captured by Docker)
    PYTHONFAULTHANDLER=1

# Runtime-only OS libraries (libpq for psycopg at runtime; ffmpeg to remux
# browser-recorded voice notes from webm into the Opus/Ogg WhatsApp requires)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built wheels from builder — no compiler needed here
COPY --from=builder /app/wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* \
    && rm -rf /wheels

# Copy application source code
COPY . .

# Create non-root user for security — never run as root in production
RUN addgroup --system django && adduser --system --ingroup django django

# Static and media directories — must be writable by the django user
RUN mkdir -p /app/staticfiles /app/mediafiles \
    && chown -R django:django /app

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

USER django

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
