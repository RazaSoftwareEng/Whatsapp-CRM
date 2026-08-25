#!/bin/bash
# =============================================================================
# backup.sh — PostgreSQL database backup
#
# Usage:
#   ./ops/backup.sh                    # backup to default location
#   ./ops/backup.sh --dir /mnt/backups # backup to custom directory
#   ./ops/backup.sh --keep 7           # keep last 7 backups (default: 7)
#
# Backup file format: backup_YYYY-MM-DD_HH-MM-SS.sql.gz
#
# Recommended: add to crontab for daily automatic backups
#   0 2 * * * /root/whatsapp-crm/ops/backup.sh >> /var/log/crm_backup.log 2>&1
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
KEEP_DAYS=7
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ENV_FILE="$APP_DIR/.env.production"

# --- Colors ------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[BACKUP]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dir)  BACKUP_DIR="$2"; shift ;;
        --keep) KEEP_DAYS="$2"; shift ;;
        *) echo "Unknown arg: $1" ;;
    esac
    shift
done

# --- Load env vars -----------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    error ".env.production not found at $ENV_FILE"
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# --- Validate DB vars --------------------------------------------------------
[ -z "$DB_NAME" ]     && error "DB_NAME not set in .env.production"
[ -z "$DB_USER" ]     && error "DB_USER not set in .env.production"
[ -z "$DB_PASSWORD" ] && error "DB_PASSWORD not set in .env.production"

# --- Create backup dir -------------------------------------------------------
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

echo ""
log "Starting PostgreSQL backup..."
log "Database : $DB_NAME"
log "Output   : $BACKUP_FILE"

# --- Run pg_dump inside the DB container -------------------------------------
docker exec whatsapp_crm_db \
    pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# --- Remove old backups (keep last N days) -----------------------------------
log "Removing backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
success "Cleanup done. Backups retained: $REMAINING"

echo ""
success "Backup complete!"
echo ""
