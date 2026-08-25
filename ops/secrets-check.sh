#!/bin/bash
# =============================================================================
# secrets-check.sh — Audit .env.production before/after a deploy
#
# Usage:
#   ./ops/secrets-check.sh
#   ./ops/secrets-check.sh --file /path/to/.env.production
#   ./ops/secrets-check.sh --quiet     # only print problems (cron-friendly)
#
# Checks file permissions, git leakage, missing/empty required variables,
# insecure defaults, and production-specific misconfigurations.
#
# Secret VALUES are never printed — only masked lengths and a pass/fail verdict.
# Exit codes: 0 = all good, 1 = at least one FAIL.
# =============================================================================

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.production"
QUIET=false

FAILS=0
WARNS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ok()      { [ "$QUIET" = true ] || echo -e "  ${GREEN}[✓]${NC} $1"; }
fail()    { echo -e "  ${RED}[✗]${NC} $1"; FAILS=$((FAILS+1)); }
warn()    { echo -e "  ${YELLOW}[!]${NC} $1"; WARNS=$((WARNS+1)); }
section() { [ "$QUIET" = true ] || echo -e "\n${BLUE}▶ $1${NC}"; }

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --file|-f)  ENV_FILE="$2"; shift ;;
        --quiet|-q) QUIET=true ;;
        -h|--help)  sed -n '2,14p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
    shift
done

if [ "$QUIET" = false ]; then
    echo ""
    echo "========================================"
    echo "  WhatsApp CRM — Secrets & Env Audit"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================"
fi

# --- 0. File exists ----------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    echo -e "\n  ${RED}[x] $ENV_FILE does not exist.${NC}"
    echo "      Create it, then re-run this check."
    exit 1
fi

# get() reads a key without sourcing the file (safe: no code execution).
get() {
    grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" 2>/dev/null |
        tail -n 1 | cut -d= -f2- |
        sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" | tr -d "\r"
}
has()  { grep -qE "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" 2>/dev/null; }
mask() { local n=${#1}; if [ "$n" -eq 0 ]; then echo "(empty)"; else echo "set, ${n} chars"; fi; }

# --- 1. File hygiene ---------------------------------------------------------
section "File Hygiene"

PERMS=$(stat -c "%a" "$ENV_FILE" 2>/dev/null)
if [ "$PERMS" = "600" ] || [ "$PERMS" = "400" ]; then
    ok "Permissions are $PERMS (owner-only)"
else
    fail "Permissions are $PERMS — should be 600. Fix: chmod 600 $ENV_FILE"
fi

ok "Owned by: $(stat -c "%U" "$ENV_FILE" 2>/dev/null)"

if grep -qU $'\r' "$ENV_FILE" 2>/dev/null; then
    fail "File has CRLF line endings — every value keeps a trailing carriage return. Fix: sed -i \"s/\\r\$//\" $ENV_FILE"
else
    ok "Line endings are Unix (LF)"
fi

DUPES=$(grep -oE "^[[:space:]]*[A-Z_][A-Z0-9_]*[[:space:]]*=" "$ENV_FILE" | tr -d " =" | sort | uniq -d)
if [ -n "$DUPES" ]; then
    warn "Duplicate keys (last one wins): $(echo "$DUPES" | tr "\n" " ")"
else
    ok "No duplicate keys"
fi

# --- 2. Git leakage ----------------------------------------------------------
section "Git Leakage"

cd "$APP_DIR"
if git rev-parse --git-dir >/dev/null 2>&1; then
    if git ls-files --error-unmatch ".env.production" >/dev/null 2>&1; then
        fail "CRITICAL: .env.production is TRACKED BY GIT. Fix: git rm --cached .env.production"
    else
        ok ".env.production is not tracked by git"
    fi

    if git log --oneline --all -- ".env.production" 2>/dev/null | grep -q .; then
        fail "CRITICAL: .env.production appears in git HISTORY — rotate every secret in it"
    else
        ok "Never committed in git history"
    fi
else
    warn "Not a git repo — skipped leakage check"
fi

# --- 3. Required variables ---------------------------------------------------
section "Required Variables"

REQUIRED="SECRET_KEY DEBUG ALLOWED_HOSTS DB_ENGINE DB_NAME DB_USER DB_PASSWORD DB_PORT CORS_ALLOWED_ORIGINS CSRF_TRUSTED_ORIGINS FRONTEND_URL"

for KEY in $REQUIRED; do
    if ! has "$KEY"; then
        fail "$KEY is MISSING"
    elif [ -z "$(get "$KEY")" ]; then
        fail "$KEY is present but EMPTY"
    else
        ok "$KEY — $(mask "$(get "$KEY")")"
    fi
done

# --- 4. Production correctness -----------------------------------------------
section "Production Correctness"

DEBUG_VAL=$(get DEBUG | tr "[:upper:]" "[:lower:]")
case "$DEBUG_VAL" in
    false|0|no|off) ok "DEBUG is off" ;;
    *) fail "DEBUG=$DEBUG_VAL — MUST be False in production (leaks tracebacks and settings)" ;;
esac

DB_ENGINE_VAL=$(get DB_ENGINE)
if [ "$DB_ENGINE_VAL" = "postgres" ]; then
    ok "DB_ENGINE=postgres"
else
    fail "DB_ENGINE=$DB_ENGINE_VAL — settings.py uses SQLite unless this is exactly 'postgres'. Your Postgres container would be ignored and data written inside the web container."
fi

SK=$(get SECRET_KEY)
if [ "${#SK}" -lt 40 ]; then
    fail "SECRET_KEY is only ${#SK} chars — use 50+. Generate: python3 -c \"import secrets; print(secrets.token_urlsafe(50))\""
elif echo "$SK" | grep -q "django-insecure"; then
    fail "SECRET_KEY contains 'django-insecure' — that is the settings.py fallback, not a real key"
elif [ "$SK" = "change-me-to-a-random-string" ]; then
    fail "SECRET_KEY is still the placeholder from .env.example"
else
    ok "SECRET_KEY looks strong (${#SK} chars)"
fi

DBP=$(get DB_PASSWORD)
case "$(echo "$DBP" | tr "[:upper:]" "[:lower:]")" in
    changeme|password|postgres|admin|root|test|1234|12345678)
        fail "DB_PASSWORD is a well-known default — change it"
        ;;
    *)
        if [ "${#DBP}" -lt 16 ]; then
            warn "DB_PASSWORD is only ${#DBP} chars — 24+ recommended"
        else
            ok "DB_PASSWORD looks strong (${#DBP} chars)"
        fi
        ;;
esac

if [ -z "$(get DB_PORT)" ]; then
    fail "DB_PORT is unset — backend/entrypoint.sh reads it directly and will spin for 60s then exit"
else
    ok "DB_PORT=$(get DB_PORT)"
fi

AH=$(get ALLOWED_HOSTS)
if echo "$AH" | grep -q "[*]"; then
    fail "ALLOWED_HOSTS contains a wildcard — accepts any Host header (host-header poisoning)"
else
    ok "ALLOWED_HOSTS=$AH"
    if echo "$AH" | grep -qE "localhost|127[.]0[.]0[.]1"; then
        warn "ALLOWED_HOSTS still lists localhost/127.0.0.1 — harmless, but unused in production"
    fi
fi

for KEY in CORS_ALLOWED_ORIGINS CSRF_TRUSTED_ORIGINS FRONTEND_URL; do
    VAL=$(get "$KEY")
    if [ -z "$VAL" ]; then
        continue          # already reported as MISSING/EMPTY above
    elif echo "$VAL" | grep -q "http://"; then
        fail "$KEY has a plain http:// origin ($VAL) — Secure cookies will not be sent to it"
    else
        ok "$KEY is https-only"
    fi
done

# --- 5. Integrations ---------------------------------------------------------
section "Integrations"

for KEY in WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN; do
    if [ -z "$(get "$KEY")" ]; then
        fail "$KEY is empty — WhatsApp send/receive will not work"
    else
        ok "$KEY — $(mask "$(get "$KEY")")"
    fi
done

EB=$(get EMAIL_BACKEND)
if [ -z "$EB" ]; then
    fail "EMAIL_BACKEND unset — settings.py defaults to the console backend, so no email is ever delivered"
elif echo "$EB" | grep -q "console"; then
    fail "EMAIL_BACKEND is the console backend — invite and password-setup emails only print to logs"
else
    ok "EMAIL_BACKEND=$EB"
    for KEY in EMAIL_HOST EMAIL_HOST_USER EMAIL_HOST_PASSWORD DEFAULT_FROM_EMAIL; do
        if [ -z "$(get "$KEY")" ]; then
            fail "$KEY is empty but the SMTP backend is active"
        else
            ok "$KEY — $(mask "$(get "$KEY")")"
        fi
    done
fi

# --- Verdict -----------------------------------------------------------------
echo ""
echo "========================================"
if [ "$FAILS" -eq 0 ] && [ "$WARNS" -eq 0 ]; then
    echo -e "  ${GREEN}All secret checks passed${NC}"
elif [ "$FAILS" -eq 0 ]; then
    echo -e "  ${YELLOW}Passed with $WARNS warning(s)${NC}"
else
    echo -e "  ${RED}$FAILS failure(s), $WARNS warning(s)${NC}"
fi
echo "========================================"
echo ""

if [ "$FAILS" -eq 0 ]; then exit 0; else exit 1; fi
