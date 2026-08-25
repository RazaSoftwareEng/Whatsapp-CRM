#!/bin/bash
# =============================================================================
# monitor.sh — Live resource monitor for the CRM stack
#
# Usage:
#   ./ops/monitor.sh                # refresh every 5s until Ctrl+C
#   ./ops/monitor.sh --interval 2   # custom refresh interval (seconds)
#   ./ops/monitor.sh --once         # print a single snapshot and exit
#   ./ops/monitor.sh --alert        # also warn on high CPU/MEM/disk (cron-friendly)
#
# Shows per-container CPU / memory / network / disk I/O plus host disk + load.
# Exit codes: 0 = fine, 1 = at least one threshold breached (--alert only).
# =============================================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL=5
ONCE=false
ALERT=false

# Alert thresholds (percent)
CPU_LIMIT=85
MEM_LIMIT=85
DISK_LIMIT=85

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINERS="whatsapp_crm_db whatsapp_crm_redis whatsapp_crm_web whatsapp_crm_celery_worker whatsapp_crm_celery_beat whatsapp_crm_nextjs"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --interval|-i) INTERVAL="$2"; shift ;;
        --once|-1)     ONCE=true ;;
        --alert)       ALERT=true; ONCE=true ;;
        -h|--help)     sed -n '2,14p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
    shift
done

BREACHED=false

snapshot() {
    echo "========================================================================"
    echo "  WhatsApp CRM — Live Monitor    $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================================================"
    echo ""

    # --- Per-container stats -------------------------------------------------
    echo -e "${BLUE}▶ Container Resources${NC}"
    echo ""

    RUNNING=""
    for C in $CONTAINERS; do
        if [ "$(docker inspect --format='{{.State.Status}}' "$C" 2>/dev/null)" = "running" ]; then
            RUNNING="$RUNNING $C"
        else
            echo -e "  ${RED}[✗] $C is not running${NC}"
            BREACHED=true
        fi
    done

    if [ -n "$RUNNING" ]; then
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $RUNNING 2>/dev/null | sed 's/^/  /'
    fi
    echo ""

    # --- Threshold checks ----------------------------------------------------
    if [ "$ALERT" = true ] && [ -n "$RUNNING" ]; then
        echo -e "${BLUE}▶ Threshold Checks${NC}"
        echo ""
        while read -r NAME CPU MEM; do
            [ -z "$NAME" ] && continue
            CPU_INT=${CPU%%.*}
            MEM_INT=${MEM%%.*}
            [ -z "$CPU_INT" ] && CPU_INT=0
            [ -z "$MEM_INT" ] && MEM_INT=0
            if [ "$CPU_INT" -ge "$CPU_LIMIT" ]; then
                echo -e "  ${RED}[!] $NAME CPU at ${CPU}% (limit ${CPU_LIMIT}%)${NC}"
                BREACHED=true
            fi
            if [ "$MEM_INT" -ge "$MEM_LIMIT" ]; then
                echo -e "  ${RED}[!] $NAME MEM at ${MEM}% (limit ${MEM_LIMIT}%)${NC}"
                BREACHED=true
            fi
        done < <(docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemPerc}}" $RUNNING 2>/dev/null | tr -d '%')
        echo -e "  ${GREEN}[✓] CPU/MEM scan complete${NC}"
        echo ""
    fi

    # --- Host ----------------------------------------------------------------
    echo -e "${BLUE}▶ Host${NC}"
    echo ""
    DISK_PCT=$(df -h "$APP_DIR" | awk 'NR==2 {gsub("%","",$5); print $5}')
    echo "  Disk   : $(df -h "$APP_DIR" | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}')"
    echo "  Memory : $(free -h 2>/dev/null | awk 'NR==2 {print $3 " / " $2}')"
    echo "  Load   : $(uptime | sed 's/.*load average: //')"

    if [ -n "$DISK_PCT" ] && [ "$DISK_PCT" -ge "$DISK_LIMIT" ]; then
        echo -e "  ${RED}[!] Disk above ${DISK_LIMIT}% — run ./ops/cleanup.sh${NC}"
        BREACHED=true
    fi
    echo ""

    # --- Celery queue depth --------------------------------------------------
    echo -e "${BLUE}▶ Celery Queue${NC}"
    echo ""
    QUEUE=$(docker exec whatsapp_crm_redis redis-cli llen celery 2>/dev/null)
    if [ -n "$QUEUE" ]; then
        if [ "$QUEUE" -gt 100 ]; then
            echo -e "  ${YELLOW}Pending tasks: $QUEUE — worker may be falling behind${NC}"
        else
            echo "  Pending tasks: $QUEUE"
        fi
    else
        echo "  (could not read queue — is Redis up?)"
    fi
    echo ""
}

if [ "$ONCE" = true ]; then
    snapshot
    if [ "$ALERT" = true ] && [ "$BREACHED" = true ]; then
        exit 1
    fi
    exit 0
fi

trap 'echo ""; echo "Monitor stopped."; exit 0' INT TERM

while true; do
    clear
    snapshot
    echo "  Refreshing every ${INTERVAL}s — press Ctrl+C to stop"
    sleep "$INTERVAL"
done
