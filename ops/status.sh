#!/bin/bash
# =============================================================================
# status.sh — Quick one-screen status of the CRM stack
#
# Usage:
#   ./ops/status.sh              # container table + versions + resources
#   ./ops/status.sh --short      # just the container table
#
# Unlike health.sh this makes NO network calls — it is instant and safe to run
# any time. Use health.sh when you want deep checks (DB ping, API, SSL).
# =============================================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
SHORT=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

section() { echo -e "\n${BLUE}▶ $1${NC}"; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --short|-s) SHORT=true ;;
        -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "Unknown arg: $1" ;;
    esac
    shift
done

echo ""
echo "========================================"
echo "  WhatsApp CRM — Status"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# --- Containers --------------------------------------------------------------
section "Containers"

CONTAINERS="whatsapp_crm_db whatsapp_crm_redis whatsapp_crm_web whatsapp_crm_celery_worker whatsapp_crm_celery_beat whatsapp_crm_nextjs"

printf "  %-30s %-10s %-16s %s\n" "NAME" "STATE" "HEALTH" "UPTIME"
printf "  %-30s %-10s %-16s %s\n" "------------------------------" "----------" "----------------" "----------------"

for C in $CONTAINERS; do
    STATE=$(docker inspect --format='{{.State.Status}}' "$C" 2>/dev/null)
    if [ -z "$STATE" ]; then
        printf "  ${RED}%-30s %-10s %-16s %s${NC}\n" "$C" "MISSING" "-" "-"
        continue
    fi
    HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$C" 2>/dev/null)
    # For a RUNNING container `docker ps` gives "Up 3 hours (healthy)".
    # For a stopped one it gives nothing, so report when it STOPPED (FinishedAt)
    # and why (ExitCode) — never StartedAt, which reads like an outage start
    # when it actually means the opposite.
    UPTIME=$(docker ps --filter "name=^${C}$" --format '{{.Status}}' 2>/dev/null)
    if [ -z "$UPTIME" ]; then
        FINISHED=$(docker inspect --format='{{.State.FinishedAt}}' "$C" 2>/dev/null | cut -c1-19 | tr 'T' ' ')
        EXITCODE=$(docker inspect --format='{{.State.ExitCode}}' "$C" 2>/dev/null)
        if [ "$EXITCODE" = "0" ]; then
            UPTIME="stopped cleanly at $FINISHED (exit 0)"
        else
            UPTIME="CRASHED at $FINISHED (exit $EXITCODE)"
        fi
    fi

    if [ "$STATE" = "running" ] && [ "$HEALTH" != "unhealthy" ]; then
        printf "  ${GREEN}%-30s %-10s %-16s %s${NC}\n" "$C" "$STATE" "$HEALTH" "$UPTIME"
    elif [ "$STATE" = "running" ]; then
        printf "  ${YELLOW}%-30s %-10s %-16s %s${NC}\n" "$C" "$STATE" "$HEALTH" "$UPTIME"
    else
        printf "  ${RED}%-30s %-10s %-16s %s${NC}\n" "$C" "$STATE" "$HEALTH" "$UPTIME"
    fi
done

[ "$SHORT" = true ] && { echo ""; exit 0; }

# --- Deployed version --------------------------------------------------------
section "Deployed Code"

cd "$APP_DIR"
if git rev-parse --git-dir >/dev/null 2>&1; then
    echo "  Branch  : $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "  Commit  : $(git rev-parse --short HEAD 2>/dev/null) — $(git log -1 --pretty=%s 2>/dev/null)"
    echo "  Authored: $(git log -1 --pretty='%an, %ar' 2>/dev/null)"
    DIRTY=$(git status --porcelain 2>/dev/null | wc -l)
    if [ "$DIRTY" -gt 0 ]; then
        echo -e "  ${YELLOW}Working tree has $DIRTY uncommitted change(s)${NC}"
    else
        echo "  Working tree clean"
    fi
else
    echo "  (not a git repository)"
fi

if [ -f "$APP_DIR/ops/.deploy_history" ]; then
    echo ""
    echo "  Last 3 deploys:"
    tail -n 3 "$APP_DIR/ops/.deploy_history" | sed 's/^/    /'
fi

# --- Resources ---------------------------------------------------------------
section "Resources"

echo "  Disk   : $(df -h "$APP_DIR" | awk 'NR==2 {print $3 " used / " $2 " total (" $5 ")"}')"
echo "  Memory : $(free -h 2>/dev/null | awk 'NR==2 {print $3 " used / " $2 " total"}')"
echo "  Load   : $(uptime | sed 's/.*load average: //')"

# --- Docker footprint --------------------------------------------------------
section "Docker Disk Usage"
docker system df 2>/dev/null | sed 's/^/  /'

# --- Env file ----------------------------------------------------------------
section "Environment"
if [ -f "$ENV_FILE" ]; then
    PERMS=$(stat -c '%a' "$ENV_FILE" 2>/dev/null)
    if [ "$PERMS" = "600" ]; then
        echo -e "  ${GREEN}.env.production present (perms $PERMS)${NC}"
    else
        echo -e "  ${YELLOW}.env.production present but perms are $PERMS — should be 600${NC}"
    fi
else
    echo -e "  ${RED}.env.production MISSING at $ENV_FILE${NC}"
fi
echo "  Compose : $COMPOSE_FILE"

echo ""
echo "========================================"
echo "  Deep checks : ./ops/health.sh"
echo "  Live view   : ./ops/monitor.sh"
echo "  Logs        : ./ops/logs.sh web -f"
echo "========================================"
echo ""
