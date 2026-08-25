#!/bin/bash
# =============================================================================
# restore.sh — Restore PostgreSQL database from a backup file
#
# Usage:
#   ./ops/restore.sh --file backups/backup_2025-08-20_02-00-00.sql.gz
#
# WARNING: This DROPS and recreates the database. All current data will be lost.
#          Run backup.sh first if you want to save the current state.
# =============================================================================
set -e

# --- Config ------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.production"
BACKUP_FILE=""

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[RESTORE]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --file) BACKUP_FILE="$2"; shift ;;
        *) error "Unknown arg: $1" ;;
    esac
    shift
done

[ -z "$BACKUP_FILE" ] && error "Usage: ./ops/restore.sh --file <backup_file.sql.gz>"
[ ! -f "$BACKUP_FILE" ] && error "Backup file not found: $BACKUP_FILE"

# --- Load env vars -----------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    error ".env.production not found at $ENV_FILE"
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

[ -z "$DB_NAME" ]     && error "DB_NAME not set in .env.production"
[ -z "$DB_USER" ]     && error "DB_USER not set"
[ -z "$DB_PASSWORD" ] && error "DB_PASSWORD not set"

# --- Confirm -----------------------------------------------------------------
echo ""
echo "========================================"
warn "  DATABASE RESTORE — DATA WILL BE LOST"
echo "========================================"
echo ""
echo "  Backup file : $BACKUP_FILE"
echo "  Database    : $DB_NAME"
echo ""
read -p "  Are you sure? Type YES to continue: " CONFIRM
[ "$CONFIRM" != "YES" ] && { echo "Aborted."; exit 0; }
echo ""

# --- Take a safety backup first ----------------------------------------------
log "Taking safety backup of current database before restore..."
SAFETY_FILE="$APP_DIR/backups/pre_restore_$(date +"%Y-%m-%d_%H-%M-%S").sql.gz"
mkdir -p "$APP_DIR/backups"
docker exec whatsapp_crm_db \
    pg_dump -U "$DB_USER" "$DB_NAME" \
    | gzip > "$SAFETY_FILE"
success "Safety backup saved: $SAFETY_FILE"

# --- Stop web services (keep DB running) -------------------------------------
log "Stopping web, celery_worker, celery_beat..."
docker compose -f "$APP_DIR/docker/docker-compose.prod.yml" --env-file "$APP_DIR/.env.production" stop web celery_worker celery_beat

# --- Drop and recreate database ----------------------------------------------
log "Dropping database $DB_NAME..."
docker exec whatsapp_crm_db \
    psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"

log "Creating fresh database $DB_NAME..."
docker exec whatsapp_crm_db \
    psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# --- Restore -----------------------------------------------------------------
log "Restoring from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker exec -i whatsapp_crm_db \
    psql -U "$DB_USER" "$DB_NAME"

success "Database restored!"

# --- Restart services --------------------------------------------------------
log "Restarting services..."
docker compose -f "$APP_DIR/docker/docker-compose.prod.yml" --env-file "$APP_DIR/.env.production" start web celery_worker celery_beat

echo ""
success "Restore complete!"
warn "Safety backup of previous state is at: $SAFETY_FILE"
echo ""
