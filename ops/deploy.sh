#!/bin/bash
# =============================================================================
# deploy.sh — Zero-downtime production deployment
#
# Usage:
#   ./scripts/deploy.sh              # deploy latest from current branch
#   ./scripts/deploy.sh --branch main  # deploy specific branch
#
# What it does:
#   1. Pull latest code from git
#   2. Rebuild Docker images
#   3. Run migrations
#   4. Restart services one by one (zero downtime)
#   5. Clean up old images
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
BRANCH="main"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()     { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch) BRANCH="$2"; shift ;;
        *) error "Unknown argument: $1" ;;
    esac
    shift
done

# --- Start -------------------------------------------------------------------
echo ""
echo "========================================"
echo "  WhatsApp CRM — Deploying to Production"
echo "  Time   : $TIMESTAMP"
echo "  Branch : $BRANCH"
echo "  Dir    : $APP_DIR"
echo "========================================"
echo ""

cd "$APP_DIR"

# 1. Pull latest code
log "Pulling latest code from branch '$BRANCH'..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
success "Code updated"

# 2. Build new images (without stopping running containers)
log "Building Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache web celery_worker celery_beat
success "Images built"

# 3. Apply database migrations (run in temp container, DB stays up)
log "Running database migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
    -e DJANGO_SETTINGS_MODULE=config.settings \
    web python manage.py migrate --noinput
success "Migrations applied"

# 4. Collect static files
log "Collecting static files..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
    web python manage.py collectstatic --noinput --clear
success "Static files collected"

# 5. Restart services (one by one to minimize downtime)
log "Restarting web service..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps web
success "Web restarted"

log "Restarting celery_worker..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps celery_worker
success "Celery worker restarted"

log "Restarting celery_beat..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps celery_beat
success "Celery beat restarted"

# 6. Wait and verify web is healthy
log "Waiting for web to be healthy..."
sleep 5
WEB_STATUS=$(docker inspect --format='{{.State.Health.Status}}' whatsapp_crm_web 2>/dev/null || echo "unknown")
if [ "$WEB_STATUS" = "healthy" ] || [ "$WEB_STATUS" = "unknown" ]; then
    success "Web container is running"
else
    error "Web container health check failed (status: $WEB_STATUS). Run: docker logs whatsapp_crm_web"
fi

# 7. Clean up dangling images to free disk space
log "Cleaning up old Docker images..."
docker image prune -f
success "Cleanup done"

echo ""
echo "========================================"
success "Deployment complete!"
echo "========================================"
echo ""
