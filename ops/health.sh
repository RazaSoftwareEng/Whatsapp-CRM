#!/bin/bash
# =============================================================================
# health.sh — Check status of all CRM services
#
# Usage:
#   ./ops/health.sh
#   ./ops/health.sh --domain api.qomunix.com
#
# Checks:
#   - Docker container status (running / stopped / unhealthy)
#   - PostgreSQL connectivity
#   - Redis connectivity
#   - Django API endpoint reachability
#   - SSL certificate expiry (if domain provided)
#   - Disk space
#   - Memory usage
# =============================================================================

DOMAIN=""
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docker/docker-compose.prod.yml"
ALL_OK=true

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[✓]${NC} $1"; }
fail() { echo -e "  ${RED}[✗]${NC} $1"; ALL_OK=false; }
warn() { echo -e "  ${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${BLUE}▶ $1${NC}"; }

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --domain) DOMAIN="$2"; shift ;;
        *) echo "Unknown arg: $1" ;;
    esac
    shift
done

echo ""
echo "========================================"
echo "  WhatsApp CRM — Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# --- 1. Container Status -----------------------------------------------------
section "Container Status"

CONTAINERS=(
    "whatsapp_crm_db"
    "whatsapp_crm_redis"
    "whatsapp_crm_web"
    "whatsapp_crm_celery_worker"
    "whatsapp_crm_celery_beat"
    "whatsapp_crm_nextjs"
)

for CONTAINER in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER" 2>/dev/null)
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$CONTAINER" 2>/dev/null)

    if [ "$STATUS" = "running" ]; then
        if [ "$HEALTH" = "unhealthy" ]; then
            fail "$CONTAINER — running but UNHEALTHY"
        else
            ok "$CONTAINER — running ($HEALTH)"
        fi
    elif [ -z "$STATUS" ]; then
        fail "$CONTAINER — NOT FOUND (not created)"
    else
        fail "$CONTAINER — $STATUS"
    fi
done

# --- 2. PostgreSQL -----------------------------------------------------------
section "PostgreSQL"

DB_CHECK=$(docker exec whatsapp_crm_db pg_isready 2>/dev/null)
if echo "$DB_CHECK" | grep -q "accepting connections"; then
    ok "PostgreSQL accepting connections"
else
    fail "PostgreSQL not ready: $DB_CHECK"
fi

# --- 3. Redis ----------------------------------------------------------------
section "Redis"

REDIS_PONG=$(docker exec whatsapp_crm_redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PONG" = "PONG" ]; then
    ok "Redis responding to PING"
else
    fail "Redis not responding"
fi

# Redis memory usage
REDIS_MEM=$(docker exec whatsapp_crm_redis redis-cli info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
warn "Redis memory used: $REDIS_MEM"

# --- 4. Django API -----------------------------------------------------------
section "Django API (internal)"

API_CODE=$(docker exec whatsapp_crm_web \
    python -c "
import urllib.request, urllib.error
try:
    r = urllib.request.urlopen('http://localhost:8000/api/auth/login/')
    print(r.getcode())
except urllib.error.HTTPError as e:
    print(e.code)
except Exception:
    print('error')
" 2>/dev/null)

if [ "$API_CODE" = "200" ] || [ "$API_CODE" = "400" ] || [ "$API_CODE" = "405" ]; then
    ok "Django API reachable (HTTP $API_CODE)"
else
    fail "Django API not reachable (got: $API_CODE)"
fi

# --- 5. Next.js Frontend (internal) ------------------------------------------
section "Next.js Frontend (internal)"

if docker exec whatsapp_crm_nextjs wget -q -O /dev/null http://127.0.0.1:3000 2>/dev/null; then
    ok "Next.js responding on port 3000"
else
    fail "Next.js NOT responding on port 3000"
fi

# --- 6. SSL Certificate ------------------------------------------------------
if [ -n "$DOMAIN" ]; then
    section "SSL Certificate ($DOMAIN)"

    EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    if [ -n "$EXPIRY" ]; then
        EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

        if [ "$DAYS_LEFT" -gt 14 ]; then
            ok "SSL valid — expires in $DAYS_LEFT days ($EXPIRY)"
        elif [ "$DAYS_LEFT" -gt 0 ]; then
            warn "SSL expires in $DAYS_LEFT days — renew soon!"
        else
            fail "SSL EXPIRED!"
        fi
    else
        warn "Could not check SSL (domain may not be reachable from this server)"
    fi
fi

# --- 7. Disk Space -----------------------------------------------------------
section "Disk Space"

DISK_USE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
DISK_INFO=$(df -h / | awk 'NR==2 {print $3 " used / " $2 " total (" $5 " used)"}')

if [ "$DISK_USE" -lt 80 ]; then
    ok "Disk: $DISK_INFO"
elif [ "$DISK_USE" -lt 90 ]; then
    warn "Disk usage high: $DISK_INFO"
else
    fail "Disk almost full: $DISK_INFO"
fi

# Docker volumes size
DOCKER_SIZE=$(docker system df --format "table {{.Type}}\t{{.Size}}" 2>/dev/null | tail -n +2)
warn "Docker usage:\n$DOCKER_SIZE"

# --- 8. Memory ---------------------------------------------------------------
section "Memory"

MEM_INFO=$(free -h | awk 'NR==2 {print $3 " used / " $2 " total"}')
MEM_PCT=$(free | awk 'NR==2 {printf "%.0f", $3/$2*100}')

if [ "$MEM_PCT" -lt 80 ]; then
    ok "Memory: $MEM_INFO ($MEM_PCT% used)"
elif [ "$MEM_PCT" -lt 90 ]; then
    warn "Memory usage high: $MEM_INFO ($MEM_PCT% used)"
else
    fail "Memory critical: $MEM_INFO ($MEM_PCT% used)"
fi

# --- Result ------------------------------------------------------------------
echo ""
echo "========================================"
if [ "$ALL_OK" = true ]; then
    echo -e "  ${GREEN}All checks passed ✓${NC}"
else
    echo -e "  ${RED}Some checks FAILED — review above ✗${NC}"
fi
echo "========================================"
echo ""

$ALL_OK && exit 0 || exit 1
