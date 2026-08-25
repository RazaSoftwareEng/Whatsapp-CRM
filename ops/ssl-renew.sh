#!/bin/bash
# =============================================================================
# ssl-renew.sh — Renew Let's Encrypt certificates and reload the shared Nginx
#
# Usage:
#   ./ops/ssl-renew.sh                          # renew anything expiring < 30 days
#   ./ops/ssl-renew.sh --check                  # only report expiry, change nothing
#   ./ops/ssl-renew.sh --dry-run                # full certbot dry run (safe rehearsal)
#   ./ops/ssl-renew.sh --force                  # renew even if not close to expiry
#   ./ops/ssl-renew.sh --domain crm.example.com # check/renew one specific domain
#   ./ops/ssl-renew.sh --nginx my-nginx-1       # override the Nginx container name
#
# Context: this stack has NO Nginx of its own — it shares Inventory_Portal's
# Nginx over proxy_network. So certbot runs on the HOST and we reload that
# container afterwards so it picks the new certificate up.
#
# Cron (twice daily is the Let's Encrypt recommendation):
#   0 0,12 * * * /root/whatsapp-crm/ops/ssl-renew.sh >> /var/log/crm_ssl.log 2>&1
#
# Exit codes: 0 = ok / nothing to do, 1 = renewal or reload failed.
# =============================================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONTAINER="inventory_portal-nginx-1"
DOMAINS="api.qomunix.com qomunix.com"
RENEW_WINDOW=30          # days before expiry that we start renewing
MODE="renew"
FORCE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[SSL]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --check|-c)   MODE="check" ;;
        --dry-run)    MODE="dry-run" ;;
        --force)      FORCE=true ;;
        --domain|-d)  DOMAINS="$2"; shift ;;
        --nginx)      NGINX_CONTAINER="$2"; shift ;;
        --window|-w)  RENEW_WINDOW="$2"; shift ;;
        -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) error "Unknown argument: $1  (try --help)" ;;
    esac
    shift
done

echo ""
echo "========================================"
echo "  WhatsApp CRM — SSL Certificates"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Mode   : $MODE"
echo "  Domains: $DOMAINS"
echo "========================================"
echo ""

# --- Preflight ---------------------------------------------------------------
command -v certbot >/dev/null 2>&1 || error "certbot not installed on the host. Install: apt-get install -y certbot"

# --- 1. Report current expiry ------------------------------------------------
log "Checking current certificate expiry..."
echo ""

NEEDS_RENEWAL=false

for DOMAIN in $DOMAINS; do
    CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

    if [ ! -f "$CERT" ]; then
        warn "$DOMAIN — no certificate found at $CERT"
        continue
    fi

    END=$(openssl x509 -enddate -noout -in "$CERT" 2>/dev/null | cut -d= -f2)
    END_EPOCH=$(date -d "$END" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)

    if [ -z "$END_EPOCH" ]; then
        warn "$DOMAIN — could not parse expiry date"
        continue
    fi

    DAYS_LEFT=$(( (END_EPOCH - NOW_EPOCH) / 86400 ))

    if [ "$DAYS_LEFT" -lt 0 ]; then
        echo -e "  ${RED}[✗]${NC} $DOMAIN — EXPIRED $(( -DAYS_LEFT )) days ago"
        NEEDS_RENEWAL=true
    elif [ "$DAYS_LEFT" -le "$RENEW_WINDOW" ]; then
        echo -e "  ${YELLOW}[!]${NC} $DOMAIN — expires in $DAYS_LEFT days ($END) — due for renewal"
        NEEDS_RENEWAL=true
    else
        echo -e "  ${GREEN}[✓]${NC} $DOMAIN — valid for $DAYS_LEFT more days ($END)"
    fi
done

echo ""

if [ "$MODE" = "check" ]; then
    echo "========================================"
    if [ "$NEEDS_RENEWAL" = true ]; then
        warn "At least one certificate needs renewing — run without --check"
    else
        success "All certificates are healthy"
    fi
    echo "========================================"
    echo ""
    exit 0
fi

# --- 2. Dry run --------------------------------------------------------------
if [ "$MODE" = "dry-run" ]; then
    log "Running certbot dry run (no certificates will change)..."
    echo ""
    if certbot renew --dry-run; then
        echo ""
        success "Dry run succeeded — a real renewal should work"
        exit 0
    else
        echo ""
        error "Dry run FAILED — fix this before the certificate actually expires"
    fi
fi

# --- 3. Skip if nothing is due -----------------------------------------------
if [ "$NEEDS_RENEWAL" = false ] && [ "$FORCE" = false ]; then
    success "Nothing expires within $RENEW_WINDOW days — no renewal needed."
    echo "  (use --force to renew anyway)"
    echo ""
    exit 0
fi

# --- 4. Renew ----------------------------------------------------------------
RENEW_ARGS="renew --non-interactive --quiet"
[ "$FORCE" = true ] && RENEW_ARGS="renew --non-interactive --force-renewal"

log "Running: certbot $RENEW_ARGS"
echo ""

if certbot $RENEW_ARGS; then
    success "Certbot finished"
else
    error "Certbot renewal FAILED — certificates unchanged. Check /var/log/letsencrypt/letsencrypt.log"
fi

# --- 5. Reload Nginx so it serves the new cert -------------------------------
echo ""
NGINX_STATE=$(docker inspect --format='{{.State.Status}}' "$NGINX_CONTAINER" 2>/dev/null || echo "missing")

if [ "$NGINX_STATE" != "running" ]; then
    warn "Nginx container '$NGINX_CONTAINER' is not running (state: $NGINX_STATE)."
    warn "New certificates are on disk but nothing reloaded them."
    warn "Override the name with: ./ops/ssl-renew.sh --nginx <container>"
    exit 1
fi

log "Testing Nginx configuration..."
if docker exec "$NGINX_CONTAINER" nginx -t >/dev/null 2>&1; then
    success "Nginx config is valid"
else
    echo ""
    docker exec "$NGINX_CONTAINER" nginx -t
    error "Nginx config test FAILED — NOT reloading (site stays up on the old cert)"
fi

log "Reloading Nginx..."
if docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null 2>&1; then
    success "Nginx reloaded — new certificate is live"
else
    error "Nginx reload failed. Try: docker restart $NGINX_CONTAINER"
fi

# --- 6. Verify over the wire -------------------------------------------------
echo ""
log "Verifying served certificates..."
echo ""

for DOMAIN in $DOMAINS; do
    SERVED=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null |
        openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$SERVED" ]; then
        echo -e "  ${GREEN}[✓]${NC} $DOMAIN now serving cert valid until $SERVED"
    else
        echo -e "  ${YELLOW}[!]${NC} $DOMAIN — could not verify from this host (DNS/firewall?)"
    fi
done

echo ""
echo "========================================"
success "SSL renewal complete!"
echo "========================================"
echo ""
