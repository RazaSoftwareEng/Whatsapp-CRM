#!/bin/bash
# =============================================================================
# rollback.sh — Roll the running deployment back to an earlier commit
#
# Usage:
#   ./ops/rollback.sh                  # back to the previous successful deploy
#   ./ops/rollback.sh --list           # show deploy history + recent commits
#   ./ops/rollback.sh --to a1b2c3d     # back to a specific commit
#   ./ops/rollback.sh --steps 2        # back 2 deploys
#   ./ops/rollback.sh --no-backup      # skip the safety DB dump (not recommended)
#   ./ops/rollback.sh --yes            # skip the confirmation prompt
#
# ─────────────────────────────────────────────────────────────────────────────
# READ THIS FIRST — what rollback does NOT do:
#
#   Code is rolled back. THE DATABASE IS NOT.
#
#   Django migrations are not reversed, because most destructive migrations
#   (a dropped column, a changed type) cannot be reversed without data loss.
#   If the deploy you are undoing added migrations, the older code will be
#   running against a NEWER schema. That is usually fine (extra columns are
#   ignored), but a removed/renamed field WILL break it.
#
#   To check what the bad deploy migrated:  ./ops/migrate.sh --list
#   To go all the way back:                 ./ops/restore.sh --file <backup>
# ─────────────────────────────────────────────────────────────────────────────
# =============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
HISTORY_FILE="$APP_DIR/ops/.deploy_history"

TARGET=""
STEPS=1
MODE="rollback"
DO_BACKUP=true
ASSUME_YES=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[ROLLBACK]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --list|-l)   MODE="list" ;;
        --to|-t)     TARGET="$2"; shift ;;
        --steps|-s)  STEPS="$2"; shift ;;
        --no-backup) DO_BACKUP=false ;;
        --yes|-y)    ASSUME_YES=true ;;
        -h|--help)   sed -n '2,28p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

cd "$APP_DIR"
git rev-parse --git-dir >/dev/null 2>&1 || error "$APP_DIR is not a git repository"

DC="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
CURRENT=$(git rev-parse HEAD)
CURRENT_SHORT=$(git rev-parse --short HEAD)

# --- List mode ---------------------------------------------------------------
if [ "$MODE" = "list" ]; then
    echo ""
    echo "========================================"
    echo "  Deploy History"
    echo "========================================"
    echo ""
    if [ -f "$HISTORY_FILE" ]; then
        echo "  Recorded deploys (newest last):"
        echo ""
        tail -n 15 "$HISTORY_FILE" | sed 's/^/    /'
    else
        warn "No deploy history yet ($HISTORY_FILE)"
        echo "  It is written by ops/deploy.sh from the next deploy onwards."
    fi
    echo ""
    echo "  Recent commits on this branch:"
    echo ""
    git log --oneline -n 15 | sed 's/^/    /'
    echo ""
    echo "  Currently deployed: $CURRENT_SHORT — $(git log -1 --pretty=%s)"
    echo ""
    exit 0
fi

# --- Work out the target commit ----------------------------------------------
if [ -z "$TARGET" ]; then
    if [ -f "$HISTORY_FILE" ]; then
        # History lines look like: <ISO time> <sha> <branch> <subject>
        TARGET=$(awk '{print $2}' "$HISTORY_FILE" | grep -v "^$CURRENT" | tail -n "$STEPS" | head -n 1)
    fi
    if [ -z "$TARGET" ]; then
        warn "No usable deploy history — falling back to git (HEAD~$STEPS)"
        TARGET=$(git rev-parse "HEAD~$STEPS" 2>/dev/null) || error "Cannot resolve HEAD~$STEPS"
    fi
fi

git cat-file -e "${TARGET}^{commit}" 2>/dev/null || error "Not a valid commit: $TARGET"
TARGET_FULL=$(git rev-parse "$TARGET")
TARGET_SHORT=$(git rev-parse --short "$TARGET")

[ "$TARGET_FULL" = "$CURRENT" ] && { success "Already at $TARGET_SHORT — nothing to roll back."; exit 0; }

# --- Show the blast radius ---------------------------------------------------
echo ""
echo "========================================"
echo "  WhatsApp CRM — ROLLBACK"
echo "  Time : $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
echo ""
echo "  From (current) : $CURRENT_SHORT — $(git log -1 --pretty=%s "$CURRENT")"
echo "  To   (target)  : $TARGET_SHORT — $(git log -1 --pretty=%s "$TARGET_FULL")"
echo ""

echo "  Commits that will be undone:"
git log --oneline "$TARGET_FULL..$CURRENT" | sed 's/^/    /'
echo ""

# --- Warn loudly about migrations --------------------------------------------
MIGRATIONS=$(git diff --name-only "$TARGET_FULL" "$CURRENT" -- "backend/*/migrations/*.py" | grep -v "__init__" || true)
if [ -n "$MIGRATIONS" ]; then
    echo -e "  ${RED}================================================${NC}"
    warn "This range contains DATABASE MIGRATIONS:"
    echo ""
    echo "$MIGRATIONS" | sed 's/^/      /'
    echo ""
    warn "These will NOT be reversed. The old code will run against the new schema."
    warn "If any of them dropped or renamed a field, the rollback will break."
    echo -e "  ${RED}================================================${NC}"
    echo ""
fi

# --- Confirm -----------------------------------------------------------------
if [ "$ASSUME_YES" = false ]; then
    read -r -p "  Proceed with rollback? Type YES: " CONFIRM
    [ "$CONFIRM" != "YES" ] && { echo "  Aborted."; exit 0; }
    echo ""
fi

# --- Safety backup -----------------------------------------------------------
if [ "$DO_BACKUP" = true ]; then
    log "Taking a safety database backup first..."
    if [ -x "$APP_DIR/ops/backup.sh" ]; then
        "$APP_DIR/ops/backup.sh" >/dev/null 2>&1 && success "Backup taken (see $APP_DIR/backups)" \
            || warn "Backup failed — continuing (you asked for a rollback)"
    else
        warn "ops/backup.sh not executable — skipping"
    fi
else
    warn "Safety backup SKIPPED (--no-backup)"
fi

# --- Record where we came from, so we can roll FORWARD again -----------------
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "$(date '+%Y-%m-%dT%H:%M:%S') $CURRENT $BRANCH ROLLED-BACK-FROM" >> "$HISTORY_FILE"
log "Recorded pre-rollback commit $CURRENT_SHORT — return with: ./ops/rollback.sh --to $CURRENT_SHORT"

# --- Check out the target ----------------------------------------------------
log "Checking out $TARGET_SHORT..."
git checkout --detach "$TARGET_FULL" >/dev/null 2>&1 || error "git checkout failed — is the working tree dirty? Run: git status"
success "Code is now at $TARGET_SHORT (detached HEAD)"

# --- Rebuild images at the old commit ----------------------------------------
log "Rebuilding images at $TARGET_SHORT (this can take a few minutes)..."
$DC build web celery_worker celery_beat nextjs
success "Images rebuilt"

# --- Bring services back -----------------------------------------------------
log "Restarting services..."
$DC up -d --no-deps web celery_worker celery_beat nextjs
success "Services restarted"

log "Waiting 10s for containers to settle..."
sleep 10

# --- Verify ------------------------------------------------------------------
echo ""
log "Post-rollback state:"
echo ""

FAILED=false
for C in whatsapp_crm_web whatsapp_crm_celery_worker whatsapp_crm_celery_beat whatsapp_crm_nextjs; do
    STATE=$(docker inspect --format='{{.State.Status}}' "$C" 2>/dev/null || echo "missing")
    if [ "$STATE" = "running" ]; then
        success "$C — running"
    else
        echo -e "  ${RED}[✗]${NC} $C — $STATE"
        FAILED=true
    fi
done

echo ""
echo "========================================"
if [ "$FAILED" = true ]; then
    echo -e "  ${RED}Rollback finished but some services are down ✗${NC}"
    echo "  Check: ./ops/logs.sh web --lines 100"
    echo "========================================"
    echo ""
    exit 1
fi

success "Rollback complete — now running $TARGET_SHORT"
echo ""
echo "  You are on a DETACHED HEAD. To return to normal development:"
echo "    git checkout $BRANCH"
echo ""
echo "  To roll forward again:"
echo "    ./ops/rollback.sh --to $CURRENT_SHORT"
echo ""
echo "  Verify the app:  ./ops/health.sh"
echo "========================================"
echo ""
