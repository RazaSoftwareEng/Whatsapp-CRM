#!/bin/bash
# =============================================================================
# cleanup.sh — Reclaim disk space on the VPS
#
# Usage:
#   ./ops/cleanup.sh                # safe cleanup (dangling images, build cache)
#   ./ops/cleanup.sh --dry-run      # show what WOULD be removed, remove nothing
#   ./ops/cleanup.sh --deep         # also remove ALL unused images + truncate logs
#   ./ops/cleanup.sh --keep 14      # keep 14 days of DB backups (default: 7)
#   ./ops/cleanup.sh --yes          # skip the confirmation prompt (for cron)
#
# NEVER touches: named volumes (postgres_data, redis_data, static, media),
# running containers, or the proxy_network. Your data is safe.
#
# Cron (weekly, Sunday 3am):
#   0 3 * * 0 /root/whatsapp-crm/ops/cleanup.sh --yes >> /var/log/crm_cleanup.log 2>&1
# =============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
KEEP_DAYS=7
DRY_RUN=false
DEEP=false
ASSUME_YES=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[CLEANUP]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dry-run|-n) DRY_RUN=true ;;
        --deep)       DEEP=true ;;
        --keep|-k)    KEEP_DAYS="$2"; shift ;;
        --yes|-y)     ASSUME_YES=true ;;
        -h|--help)    sed -n '2,17p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

disk_free() { df -h "$APP_DIR" | awk 'NR==2 {print $4}'; }

BEFORE=$(disk_free)

echo ""
echo "========================================"
echo "  WhatsApp CRM — Disk Cleanup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Mode  : $([ "$DRY_RUN" = true ] && echo 'DRY RUN (nothing removed)' || { [ "$DEEP" = true ] && echo 'DEEP' || echo 'safe'; })"
echo "  Free  : $BEFORE"
echo "========================================"
echo ""

# --- Current usage -----------------------------------------------------------
log "Current Docker footprint:"
echo ""
docker system df 2>/dev/null | sed 's/^/  /'
echo ""

# --- Confirm for deep mode ---------------------------------------------------
if [ "$DEEP" = true ] && [ "$DRY_RUN" = false ] && [ "$ASSUME_YES" = false ]; then
    warn "DEEP mode removes every image not used by a RUNNING container."
    warn "The next deploy will have to rebuild from scratch (slower, but safe)."
    echo ""
    read -r -p "  Continue? Type YES: " CONFIRM
    [ "$CONFIRM" != "YES" ] && { echo "  Aborted."; exit 0; }
    echo ""
fi

run() {
    if [ "$DRY_RUN" = true ]; then
        echo "    would run: $*"
    else
        "$@" 2>/dev/null | sed 's/^/    /' || true
    fi
}

# --- 1. Stopped containers ---------------------------------------------------
log "Removing stopped containers..."
STOPPED=$(docker ps -aq --filter "status=exited" --filter "status=created" 2>/dev/null | wc -l)
if [ "$STOPPED" -gt 0 ]; then
    run docker container prune -f
    success "$STOPPED stopped container(s) handled"
else
    success "No stopped containers"
fi

# --- 2. Dangling images ------------------------------------------------------
log "Removing dangling (untagged) images..."
if [ "$DEEP" = true ]; then
    run docker image prune -af
    success "All unused images handled"
else
    run docker image prune -f
    success "Dangling images handled"
fi

# --- 3. Build cache ----------------------------------------------------------
log "Pruning Docker build cache..."
if [ "$DEEP" = true ]; then
    run docker builder prune -af
else
    run docker builder prune -f --filter "until=168h"
fi
success "Build cache handled"

# --- 4. Unused networks ------------------------------------------------------
log "Removing unused networks (proxy_network is in use, so it stays)..."
run docker network prune -f
success "Networks handled"

# --- 5. Old database backups -------------------------------------------------
log "Trimming database backups older than $KEEP_DAYS days..."
if [ -d "$BACKUP_DIR" ]; then
    OLD_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" 2>/dev/null | wc -l)
    if [ "$OLD_COUNT" -gt 0 ]; then
        if [ "$DRY_RUN" = true ]; then
            echo "    would delete $OLD_COUNT backup(s):"
            find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" 2>/dev/null | sed 's/^/      /'
        else
            find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
        fi
        success "$OLD_COUNT old backup(s) handled"
    else
        success "No backups older than $KEEP_DAYS days"
    fi

    REMAINING=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    echo "    backups retained: $REMAINING ($BACKUP_SIZE total)"

    # Safety net: never leave zero backups behind
    if [ "$REMAINING" -eq 0 ] && [ "$DRY_RUN" = false ]; then
        warn "No backups remain! Take one now: ./ops/backup.sh"
    fi
else
    warn "No backups directory at $BACKUP_DIR"
fi

# --- 6. Pre-restore safety dumps ---------------------------------------------
if [ -d "$BACKUP_DIR" ]; then
    log "Trimming pre-restore safety dumps older than $KEEP_DAYS days..."
    PRE_COUNT=$(find "$BACKUP_DIR" -name "pre_restore_*.sql.gz" -mtime +"$KEEP_DAYS" 2>/dev/null | wc -l)
    if [ "$PRE_COUNT" -gt 0 ] && [ "$DRY_RUN" = false ]; then
        find "$BACKUP_DIR" -name "pre_restore_*.sql.gz" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true
    fi
    success "$PRE_COUNT pre-restore dump(s) handled"
fi

# --- 7. Container logs (deep only) -------------------------------------------
if [ "$DEEP" = true ]; then
    log "Truncating container log files..."
    LOG_TOTAL=$(du -ch /var/lib/docker/containers/*/*-json.log 2>/dev/null | tail -n 1 | cut -f1)
    echo "    current log size: ${LOG_TOTAL:-unknown}"
    if [ "$DRY_RUN" = false ]; then
        if [ "$(id -u)" -eq 0 ]; then
            for LOGFILE in /var/lib/docker/containers/*/*-json.log; do
                [ -f "$LOGFILE" ] && truncate -s 0 "$LOGFILE" 2>/dev/null || true
            done
            success "Container logs truncated"
        else
            warn "Need root to truncate container logs — re-run with sudo"
        fi
    fi

    log "Vacuuming systemd journal to 200MB..."
    if [ "$DRY_RUN" = false ] && command -v journalctl >/dev/null 2>&1; then
        journalctl --vacuum-size=200M >/dev/null 2>&1 && success "Journal vacuumed" || warn "Could not vacuum journal (need root?)"
    fi

    log "Cleaning apt cache..."
    if [ "$DRY_RUN" = false ] && [ "$(id -u)" -eq 0 ]; then
        apt-get clean >/dev/null 2>&1 && success "apt cache cleaned" || true
    fi
fi

# --- Result ------------------------------------------------------------------
AFTER=$(disk_free)

echo ""
log "Docker footprint after cleanup:"
echo ""
docker system df 2>/dev/null | sed 's/^/  /'
echo ""

echo "========================================"
if [ "$DRY_RUN" = true ]; then
    warn "DRY RUN — nothing was actually removed"
else
    success "Cleanup complete!"
fi
echo "  Disk free before : $BEFORE"
echo "  Disk free after  : $AFTER"
echo "========================================"
echo ""
