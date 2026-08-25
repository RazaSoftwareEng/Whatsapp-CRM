#!/bin/bash
# =============================================================================
# setup_vps.sh — One-time VPS setup for WhatsApp CRM
#
# Run this ONCE on a fresh Ubuntu VPS after cloning the repo.
# It installs Docker, creates the shared network, and sets script permissions.
#
# Usage:
#   chmod +x ops/setup_vps.sh
#   sudo ./ops/setup_vps.sh
# =============================================================================
set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[SETUP]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Must be root ------------------------------------------------------------
[ "$EUID" -ne 0 ] && error "Please run as root: sudo ./ops/setup_vps.sh"

echo ""
echo "========================================"
echo "  WhatsApp CRM — VPS First-Time Setup"
echo "========================================"
echo ""

# --- 1. Update system --------------------------------------------------------
log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
success "System updated"

# --- 2. Install Docker -------------------------------------------------------
if command -v docker &>/dev/null; then
    success "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."
    apt-get install -y -qq \
        ca-certificates curl gnupg lsb-release

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    success "Docker installed: $(docker --version)"
fi

# --- 3. Install useful tools -------------------------------------------------
log "Installing utilities..."
apt-get install -y -qq git curl openssl certbot
success "Utilities installed"

# --- 4. Create shared Docker network -----------------------------------------
log "Creating shared proxy_network..."
if docker network inspect proxy_network &>/dev/null; then
    warn "proxy_network already exists — skipping"
else
    docker network create proxy_network
    success "proxy_network created"
fi

# --- 5. Create backups directory ---------------------------------------------
log "Creating backups directory..."
mkdir -p "$APP_DIR/backups"
chmod 700 "$APP_DIR/backups"
success "Backups dir: $APP_DIR/backups"

# --- 6. Make all scripts executable ------------------------------------------
log "Setting script permissions..."
chmod +x "$APP_DIR/ops/"*.sh
chmod +x "$APP_DIR/backend/entrypoint.sh"
success "All scripts are executable"

# --- 7. Check .env.production ------------------------------------------------
if [ ! -f "$APP_DIR/.env.production" ]; then
    warn ".env.production not found!"
    if [ -f "$APP_DIR/.env.production.template" ]; then
        log "Creating from template..."
        cp "$APP_DIR/.env.production.template" "$APP_DIR/.env.production"
        chmod 600 "$APP_DIR/.env.production"
        warn "Edit .env.production now: nano $APP_DIR/.env.production"
    else
        warn "No .env.production.template in the repo either — create the file by hand."
        warn "Required keys: SECRET_KEY DEBUG ALLOWED_HOSTS DB_ENGINE DB_NAME DB_USER"
        warn "               DB_PASSWORD DB_HOST DB_PORT CORS_ALLOWED_ORIGINS"
        warn "               CSRF_TRUSTED_ORIGINS FRONTEND_URL REDIS_URL"
        warn "               WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN"
        warn "               EMAIL_BACKEND EMAIL_HOST EMAIL_HOST_USER EMAIL_HOST_PASSWORD"
        warn "Then verify it with: $APP_DIR/ops/secrets-check.sh"
    fi
else
    success ".env.production found"
    chmod 600 "$APP_DIR/.env.production"
fi

# --- 8. Setup daily backup cron ----------------------------------------------
log "Setting up daily database backup cron..."
CRON_BACKUP="0 2 * * * $APP_DIR/ops/backup.sh >> /var/log/crm_backup.log 2>&1"
CRON_SSL="0 0,12 * * * $APP_DIR/ops/ssl-renew.sh >> /var/log/crm_ssl.log 2>&1"
CRON_CLEAN="0 3 * * 0 $APP_DIR/ops/cleanup.sh --yes >> /var/log/crm_cleanup.log 2>&1"

( crontab -l 2>/dev/null \
    | grep -v "ops/backup.sh" \
    | grep -v "ops/ssl-renew.sh" \
    | grep -v "ops/cleanup.sh" \
    | grep -v "scripts/backup.sh" ; \
  echo "$CRON_BACKUP" ; echo "$CRON_SSL" ; echo "$CRON_CLEAN" ) | crontab -

success "Daily backup scheduled at 2:00 AM"
success "SSL renewal checked at 00:00 and 12:00"
success "Weekly disk cleanup scheduled Sunday 3:00 AM"

# --- Done --------------------------------------------------------------------
echo ""
echo "========================================"
success "VPS setup complete!"
echo "========================================"
echo ""
echo "  Next steps:"
echo "  1. Edit your env file    : nano $APP_DIR/.env.production"
echo "  2. Start CRM services    : docker compose -f $APP_DIR/docker/docker-compose.prod.yml up -d --build"
echo "  3. Connect to nginx      : docker network connect proxy_network inventory_portal-nginx-1"
echo "  4. Check health          : $APP_DIR/ops/health.sh"
echo ""
