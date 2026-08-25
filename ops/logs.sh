#!/bin/bash
# =============================================================================
# logs.sh — View logs for any CRM service
#
# Usage:
#   ./ops/logs.sh                    # all services (last 50 lines each)
#   ./ops/logs.sh web                # only web (Gunicorn)
#   ./ops/logs.sh celery_worker      # only celery worker
#   ./ops/logs.sh db                 # only postgres
#   ./ops/logs.sh web --follow       # stream live logs
#   ./ops/logs.sh web --lines 100    # last 100 lines
# =============================================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env.production"
SERVICE=""
FOLLOW=false
LINES=50

BLUE='\033[0;34m'
NC='\033[0m'

# --- Parse args --------------------------------------------------------------
while [[ "$#" -gt 0 ]]; do
    case $1 in
        web|db|redis|celery_worker|celery_beat) SERVICE="$1" ;;
        --follow|-f) FOLLOW=true ;;
        --lines|-n) LINES="$2"; shift ;;
        *) echo "Unknown arg: $1" ;;
    esac
    shift
done

# --- Build command -----------------------------------------------------------
CMD="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs --tail=$LINES"

if [ "$FOLLOW" = true ]; then
    CMD="$CMD --follow"
fi

if [ -n "$SERVICE" ]; then
    echo -e "${BLUE}[LOGS]${NC} Showing logs for: $SERVICE (last $LINES lines)"
    CMD="$CMD $SERVICE"
else
    echo -e "${BLUE}[LOGS]${NC} Showing logs for all services (last $LINES lines each)"
fi

echo ""
eval $CMD
