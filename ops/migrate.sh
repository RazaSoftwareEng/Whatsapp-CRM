#!/bin/bash
# =============================================================================
# migrate.sh — Run / inspect Django database migrations in production
#
# Usage:
#   ./ops/migrate.sh                  # apply all pending migrations
#   ./ops/migrate.sh --list           # show every migration and its applied state
#   ./ops/migrate.sh --plan           # show ONLY what would be applied (no changes)
#   ./ops/migrate.sh --app leads      # migrate a single app
#   ./ops/migrate.sh --app leads --to 0003    # migrate an app to a specific number
#   ./ops/migrate.sh --fake-initial   # mark initial migrations as applied
#   ./ops/migrate.sh --no-backup      # skip the safety DB backup (not recommended)
#
# IMPORTANT — why this uses `docker exec`, not `docker compose run`:
#   backend/Dockerfile sets ENTRYPOINT ["/app/entrypoint.sh"], and entrypoint.sh
#   ends with `exec gunicorn ...` — it NEVER runs "$@". So
#     docker compose run --rm web python manage.py migrate
#   silently ignores the command and boots Gunicorn in the foreground instead,
#   hanging forever. Running inside the live container with `docker exec`
#   bypasses ENTRYPOINT completely and actually runs manage.py.
# =============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
WEB_CONTAINER="whatsapp_crm_web"

MODE="apply"
APP_LABEL=""
TARGET=""
FAKE_INITIAL=false
DO_BACKUP=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[MIGRATE]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --list|-l)      MODE="list" ;;
        --plan|-p)      MODE="plan" ;;
        --app|-a)       APP_LABEL="$2"; shift ;;
        --to)           TARGET="$2"; shift ;;
        --fake-initial) FAKE_INITIAL=true ;;
        --no-backup)    DO_BACKUP=false ;;
        -h|--help)      sed -n '2,17p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

[ -n "$TARGET" ] && [ -z "$APP_LABEL" ] && error "--to requires --app (e.g. --app leads --to 0003)"

# --- Container must be running -----------------------------------------------
STATE=$(docker inspect --format='{{.State.Status}}' "$WEB_CONTAINER" 2>/dev/null || echo "missing")
if [ "$STATE" != "running" ]; then
    error "$WEB_CONTAINER is not running (state: $STATE). Start it first: ./ops/restart.sh web"
fi

# dj() runs a manage.py command inside the live web container.
dj() { docker exec "$WEB_CONTAINER" python manage.py "$@"; }

echo ""
echo "========================================"
echo "  WhatsApp CRM — Migrations"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""

# --- Read-only modes ---------------------------------------------------------
if [ "$MODE" = "list" ]; then
    log "Migration state (X = applied):"
    echo ""
    if [ -n "$APP_LABEL" ]; then dj showmigrations "$APP_LABEL"; else dj showmigrations; fi
    echo ""
    exit 0
fi

if [ "$MODE" = "plan" ]; then
    log "Pending migrations (nothing will be applied):"
    echo ""
    dj migrate --plan
    echo ""
    exit 0
fi

# --- Show what is about to happen --------------------------------------------
log "Checking for pending migrations..."
echo ""
PLAN=$(dj migrate --plan 2>&1 || true)
echo "$PLAN" | sed 's/^/  /'
echo ""

if echo "$PLAN" | grep -qi "No planned migration operations"; then
    success "Database is already up to date — nothing to do."
    echo ""
    exit 0
fi

# --- Safety backup -----------------------------------------------------------
if [ "$DO_BACKUP" = true ]; then
    if [ -x "$APP_DIR/ops/backup.sh" ]; then
        log "Taking a safety backup before migrating..."
        "$APP_DIR/ops/backup.sh" >/dev/null 2>&1 && success "Backup taken (ops/backup.sh)" \
            || warn "Backup failed — continuing anyway (use --no-backup to silence)"
    else
        warn "ops/backup.sh not executable — skipping safety backup"
    fi
else
    warn "Safety backup SKIPPED (--no-backup)"
fi

# --- Build the migrate command -----------------------------------------------
ARGS="migrate --noinput"
[ "$FAKE_INITIAL" = true ] && ARGS="$ARGS --fake-initial"
[ -n "$APP_LABEL" ] && ARGS="$ARGS $APP_LABEL"
[ -n "$TARGET" ] && ARGS="$ARGS $TARGET"

log "Running: python manage.py $ARGS"
echo ""
dj $ARGS
echo ""
success "Migrations applied"

# --- Celery picks up model changes lazily; bounce the workers ----------------
log "Restarting Celery so workers load the new schema..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart celery_worker celery_beat >/dev/null 2>&1 \
    && success "Celery worker + beat restarted" \
    || warn "Could not restart Celery — do it manually: ./ops/restart.sh celery_worker celery_beat"

echo ""
echo "========================================"
success "Migration complete!"
echo "========================================"
echo ""
