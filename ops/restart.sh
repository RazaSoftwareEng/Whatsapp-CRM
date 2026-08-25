#!/bin/bash
# =============================================================================
# restart.sh — Restart the WhatsApp CRM server stack
#
# Usage:
#   ./ops/restart.sh                  # graceful restart of ALL services
#   ./ops/restart.sh web              # restart a single service
#   ./ops/restart.sh --app            # app only (web, celery x2, nextjs) — DB/Redis untouched
#   ./ops/restart.sh --hard           # recreate containers (down + up -d), keeps volumes
#   ./ops/restart.sh --hard --app     # recreate app containers only
#
# Services: db  redis  web  celery_worker  celery_beat  nextjs
#
# NOTE: --hard never removes volumes, so PostgreSQL data and media files survive.
#       Use ops/deploy.sh instead when you also need to pull new code.
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"

ALL_SERVICES="db redis web celery_worker celery_beat nextjs"
APP_SERVICES="web celery_worker celery_beat nextjs"

TARGETS=""
HARD=false
APP_ONLY=false

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[RESTART]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --hard)  HARD=true ;;
        --app)   APP_ONLY=true ;;
        -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
        db|redis|web|celery_worker|celery_beat|nextjs) TARGETS="$TARGETS $1" ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

# --- Resolve which services to act on ----------------------------------------
if [ -n "$TARGETS" ]; then
    SERVICES="$(echo "$TARGETS" | xargs)"
elif [ "$APP_ONLY" = true ]; then
    SERVICES="$APP_SERVICES"
else
    SERVICES="$ALL_SERVICES"
fi

# --- Preflight ---------------------------------------------------------------
[ -f "$COMPOSE_FILE" ] || error "Compose file not found: $COMPOSE_FILE"
[ -f "$ENV_FILE" ]     || error ".env.production not found at $ENV_FILE"

DC="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

echo ""
echo "========================================"
echo "  WhatsApp CRM — Restart"
echo "  Time     : $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Mode     : $([ "$HARD" = true ] && echo 'HARD (recreate containers)' || echo 'graceful (restart)')"
echo "  Services : $SERVICES"
echo "========================================"
echo ""

# --- Restart -----------------------------------------------------------------
if [ "$HARD" = true ]; then
    log "Stopping and removing containers..."
    $DC stop $SERVICES
    $DC rm -f $SERVICES
    success "Containers removed (volumes untouched)"

    log "Recreating containers from existing images..."
    $DC up -d --no-build $SERVICES
    success "Containers recreated"
else
    log "Restarting services..."
    $DC restart $SERVICES
    success "Services restarted"
fi

# --- Wait for things to come back --------------------------------------------
log "Waiting 8s for services to settle..."
sleep 8

# --- Report ------------------------------------------------------------------
echo ""
log "Current state:"
echo ""

FAILED=false
for SVC in $SERVICES; do
    case $SVC in
        web)           CONTAINER="whatsapp_crm_web" ;;
        db)            CONTAINER="whatsapp_crm_db" ;;
        redis)         CONTAINER="whatsapp_crm_redis" ;;
        celery_worker) CONTAINER="whatsapp_crm_celery_worker" ;;
        celery_beat)   CONTAINER="whatsapp_crm_celery_beat" ;;
        nextjs)        CONTAINER="whatsapp_crm_nextjs" ;;
    esac

    STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$CONTAINER" 2>/dev/null || echo "-")

    if [ "$STATUS" = "running" ]; then
        if [ "$HEALTH" = "unhealthy" ]; then
            warn "$CONTAINER — running but UNHEALTHY"
        else
            success "$CONTAINER — running ($HEALTH)"
        fi
    else
        echo -e "  ${RED}[✗]${NC} $CONTAINER — $STATUS"
        FAILED=true
    fi
done

echo ""
echo "========================================"
if [ "$FAILED" = true ]; then
    echo -e "  ${RED}Some services did NOT come back ✗${NC}"
    echo "  Inspect with: ./ops/logs.sh <service> --lines 100"
    echo "========================================"
    echo ""
    exit 1
fi
success "Restart complete!"
echo "========================================"
echo ""
