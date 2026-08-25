#!/bin/bash
# =============================================================================
# deploy.sh — Production deployment
#
# Usage:
#   ./ops/deploy.sh                    # deploy latest main
#   ./ops/deploy.sh --branch dev       # deploy a specific branch
#   ./ops/deploy.sh --no-cache         # force a full rebuild (ignore layer cache)
#   ./ops/deploy.sh --skip-build       # restart only, reuse existing images
#   ./ops/deploy.sh --backend-only     # skip the Next.js rebuild
#   ./ops/deploy.sh --yes              # no confirmation prompt (for CI/cron)
#
# What it does:
#   1. Preflight  — env file, compose file, clean tree, disk space
#   2. Safety     — record current commit, back up the database
#   3. Pull       — fetch + checkout + pull the target branch
#   4. Build      — web, celery_worker, celery_beat, nextjs
#   5. Release    — recreate web (entrypoint migrates + collectstatics), then
#                   celery_worker, celery_beat, nextjs
#   6. Verify     — real health checks, not just "container exists"
#   7. Record     — append to ops/.deploy_history so rollback.sh can use it
#   8. Clean      — prune dangling images
#
# Roll back with: ./ops/rollback.sh
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
HISTORY_FILE="$APP_DIR/ops/.deploy_history"
BRANCH="main"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

NO_CACHE=false
SKIP_BUILD=false
BACKEND_ONLY=false
ASSUME_YES=false

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch|-b)    BRANCH="$2"; shift ;;
        --no-cache)     NO_CACHE=true ;;
        --skip-build)   SKIP_BUILD=true ;;
        --backend-only) BACKEND_ONLY=true ;;
        --yes|-y)       ASSUME_YES=true ;;
        -h|--help)      sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

SERVICES="web celery_worker celery_beat"
[ "$BACKEND_ONLY" = false ] && SERVICES="$SERVICES nextjs"

DC="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

cd "$APP_DIR"

echo ""
echo "========================================"
echo "  WhatsApp CRM — Deploying to Production"
echo "  Time     : $TIMESTAMP"
echo "  Branch   : $BRANCH"
echo "  Dir      : $APP_DIR"
echo "  Services : $SERVICES"
echo "========================================"
echo ""

# =============================================================================
# 1. PREFLIGHT
# =============================================================================
log "Running preflight checks..."

[ -f "$COMPOSE_FILE" ] || error "Compose file not found: $COMPOSE_FILE"
[ -f "$ENV_FILE" ]     || error ".env.production not found at $ENV_FILE"
command -v docker >/dev/null 2>&1 || error "docker is not installed"
docker compose version >/dev/null 2>&1 || error "docker compose plugin is not available"
git rev-parse --git-dir >/dev/null 2>&1 || error "$APP_DIR is not a git repository"

# Uncommitted changes would make `git checkout` fail halfway through.
DIRTY=$(git status --porcelain | grep -v '^?? ' || true)
if [ -n "$DIRTY" ]; then
    warn "Working tree has uncommitted tracked changes:"
    echo "$DIRTY" | sed 's/^/      /'
    if [ "$ASSUME_YES" = false ]; then
        read -r -p "  Discard them and continue? Type YES: " CONFIRM
        [ "$CONFIRM" != "YES" ] && { echo "  Aborted."; exit 0; }
    fi
    git checkout -- . || error "Could not discard local changes"
    success "Local changes discarded"
fi

# A build that runs out of disk mid-way leaves a broken stack.
DISK_PCT=$(df "$APP_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "$DISK_PCT" -ge 90 ]; then
    error "Disk is ${DISK_PCT}% full — free space before deploying: ./ops/cleanup.sh --deep"
elif [ "$DISK_PCT" -ge 80 ]; then
    warn "Disk is ${DISK_PCT}% full — consider ./ops/cleanup.sh"
fi

success "Preflight passed (disk ${DISK_PCT}% used)"

# =============================================================================
# 2. SAFETY — remember where we are, and back the database up
# =============================================================================
PREV_COMMIT=$(git rev-parse HEAD)
PREV_SHORT=$(git rev-parse --short HEAD)
log "Current commit: $PREV_SHORT — $(git log -1 --pretty=%s)"

if [ -x "$APP_DIR/ops/backup.sh" ] && docker ps --format '{{.Names}}' | grep -q "^whatsapp_crm_db$"; then
    log "Backing up the database before deploying..."
    if "$APP_DIR/ops/backup.sh" >/dev/null 2>&1; then
        success "Pre-deploy backup taken"
    else
        warn "Pre-deploy backup failed — continuing"
    fi
else
    warn "Skipping pre-deploy backup (db container not running, or ops/backup.sh not executable)"
fi

# =============================================================================
# 3. PULL LATEST CODE
# =============================================================================
log "Fetching branch '$BRANCH'..."
git fetch origin "$BRANCH" || error "git fetch failed — check network / credentials"
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH" || error "git pull failed (not a fast-forward?) — resolve manually"

NEW_COMMIT=$(git rev-parse HEAD)
NEW_SHORT=$(git rev-parse --short HEAD)

if [ "$NEW_COMMIT" = "$PREV_COMMIT" ]; then
    warn "Already at $NEW_SHORT — no new commits. Continuing anyway (images will be rebuilt)."
else
    success "Updated $PREV_SHORT -> $NEW_SHORT"
    echo ""
    echo "  Changes being deployed:"
    git log --oneline "$PREV_COMMIT..$NEW_COMMIT" | sed 's/^/    /'
    echo ""
fi

# =============================================================================
# 4. BUILD IMAGES
# =============================================================================
if [ "$SKIP_BUILD" = true ]; then
    warn "Skipping build (--skip-build) — reusing existing images"
else
    BUILD_FLAGS=""
    if [ "$NO_CACHE" = true ]; then
        BUILD_FLAGS="--no-cache"
        warn "Building with --no-cache — this will take several minutes"
    fi

    log "Building images: $SERVICES"
    echo ""
    # Docker's layer cache is keyed on file content, so a normal cached build
    # still rebuilds every layer whose sources changed. --no-cache is only
    # needed when a base image or an unpinned apt/npm dependency must refresh.
    $DC build $BUILD_FLAGS $SERVICES || error "Image build FAILED — nothing has been restarted, the old version is still live"
    echo ""
    success "Images built"
fi

# =============================================================================
# 5. RELEASE
#
# backend/entrypoint.sh already runs `collectstatic --clear` and
# `migrate --noinput` every time the web container starts, so recreating web
# IS the migration step. We verify it afterwards rather than running migrate
# through `docker compose run`, which cannot work here — see step 6.
# =============================================================================
log "Recreating web (this runs collectstatic + migrate via entrypoint.sh)..."
$DC up -d --no-deps web || error "Failed to start web"
success "Web container started"

log "Waiting for web to finish migrating and start Gunicorn..."
BOOTED=false
for i in $(seq 1 60); do
    if docker logs whatsapp_crm_web 2>&1 | tail -n 40 | grep -q "Starting Gunicorn"; then
        BOOTED=true
        break
    fi
    STATE=$(docker inspect --format='{{.State.Status}}' whatsapp_crm_web 2>/dev/null || echo "missing")
    if [ "$STATE" = "exited" ] || [ "$STATE" = "dead" ]; then
        echo ""
        docker logs whatsapp_crm_web --tail 40
        error "Web container exited during startup (see log above). Roll back: ./ops/rollback.sh"
    fi
    sleep 2
done

if [ "$BOOTED" = true ]; then
    success "Web booted (migrations + collectstatic done)"
else
    warn "Did not see 'Starting Gunicorn' within 120s — check: ./ops/logs.sh web --lines 100"
fi

log "Restarting celery_worker..."
$DC up -d --no-deps celery_worker
success "Celery worker restarted"

log "Restarting celery_beat..."
$DC up -d --no-deps celery_beat
success "Celery beat restarted"

if [ "$BACKEND_ONLY" = false ]; then
    # NOTE: NEXT_PUBLIC_API_URL is baked in at BUILD time (it is a Dockerfile ARG),
    # so the frontend must be rebuilt — never merely restarted — to pick up changes.
    log "Restarting nextjs..."
    $DC up -d --no-deps nextjs
    success "Next.js restarted"
else
    warn "Next.js NOT redeployed (--backend-only) — the frontend is still on the old build"
fi

# =============================================================================
# 6. VERIFY
#
# The compose healthcheck for web ends in `|| exit 0`, so it reports "healthy"
# even when Django is broken. We therefore check the app directly instead of
# trusting .State.Health.Status.
# =============================================================================
echo ""
log "Verifying the release..."
sleep 5

DEPLOY_OK=true

# --- containers are up -------------------------------------------------------
CHECK="whatsapp_crm_web whatsapp_crm_celery_worker whatsapp_crm_celery_beat"
[ "$BACKEND_ONLY" = false ] && CHECK="$CHECK whatsapp_crm_nextjs"

for C in $CHECK; do
    STATE=$(docker inspect --format='{{.State.Status}}' "$C" 2>/dev/null || echo "missing")
    if [ "$STATE" = "running" ]; then
        success "$C — running"
    else
        echo -e "  ${RED}[✗]${NC} $C — $STATE"
        DEPLOY_OK=false
    fi
done

# --- Django actually answers -------------------------------------------------
API_CODE=$(docker exec whatsapp_crm_web python -c "
import urllib.request, urllib.error
try:
    print(urllib.request.urlopen('http://localhost:8000/api/auth/login/', timeout=10).getcode())
except urllib.error.HTTPError as e:
    print(e.code)
except Exception:
    print('error')
" 2>/dev/null)

case "$API_CODE" in
    200|400|405) success "Django API responding (HTTP $API_CODE)" ;;
    *) echo -e "  ${RED}[✗]${NC} Django API not responding (got: ${API_CODE:-nothing})"; DEPLOY_OK=false ;;
esac

# --- no migrations left behind -----------------------------------------------
# This is also the proof that entrypoint.sh migrated successfully.
PENDING=$(docker exec whatsapp_crm_web python manage.py migrate --plan 2>/dev/null || echo "unknown")
if echo "$PENDING" | grep -qi "No planned migration operations"; then
    success "Database schema is up to date"
elif [ "$PENDING" = "unknown" ]; then
    warn "Could not read migration plan — check manually: ./ops/migrate.sh --plan"
else
    warn "Migrations still pending — apply them with: ./ops/migrate.sh"
    echo "$PENDING" | sed 's/^/      /'
fi

# --- frontend answers --------------------------------------------------------
if [ "$BACKEND_ONLY" = false ]; then
    if docker exec whatsapp_crm_nextjs wget -q -O /dev/null http://localhost:3000 2>/dev/null; then
        success "Next.js responding on port 3000"
    else
        echo -e "  ${RED}[✗]${NC} Next.js not responding on port 3000"
        DEPLOY_OK=false
    fi
fi

# --- reachable from the shared proxy network ---------------------------------
if docker network inspect proxy_network >/dev/null 2>&1; then
    ATTACHED=$(docker network inspect proxy_network --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null)
    echo "$ATTACHED" | grep -q "whatsapp_crm_web" \
        && success "web is attached to proxy_network" \
        || { echo -e "  ${RED}[✗]${NC} web is NOT on proxy_network — Nginx cannot reach it"; DEPLOY_OK=false; }
else
    echo -e "  ${RED}[✗]${NC} proxy_network does not exist — create it: docker network create proxy_network"
    DEPLOY_OK=false
fi

# =============================================================================
# 7. RECORD + 8. CLEAN UP
# =============================================================================
echo ""

if [ "$DEPLOY_OK" = false ]; then
    echo "========================================"
    echo -e "  ${RED}DEPLOY FINISHED WITH ERRORS ✗${NC}"
    echo "========================================"
    echo ""
    echo "  Deployed commit : $NEW_SHORT"
    echo "  Previous commit : $PREV_SHORT"
    echo ""
    echo "  Inspect : ./ops/logs.sh web --lines 100"
    echo "  Health  : ./ops/health.sh"
    echo "  Undo    : ./ops/rollback.sh --to $PREV_SHORT"
    echo ""
    exit 1
fi

mkdir -p "$(dirname "$HISTORY_FILE")"
echo "$(date '+%Y-%m-%dT%H:%M:%S') $NEW_COMMIT $BRANCH $(git log -1 --pretty=%s)" >> "$HISTORY_FILE"
success "Recorded in ops/.deploy_history"

log "Pruning dangling images..."
docker image prune -f >/dev/null 2>&1
success "Cleanup done"

echo ""
echo "========================================"
success "Deployment complete!"
echo "========================================"
echo ""
echo "  Deployed : $NEW_SHORT — $(git log -1 --pretty=%s)"
echo "  Previous : $PREV_SHORT"
echo ""
echo "  Verify   : ./ops/health.sh --domain api.qomunix.com"
echo "  Undo     : ./ops/rollback.sh --to $PREV_SHORT"
echo ""
