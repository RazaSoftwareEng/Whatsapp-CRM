# WhatsApp CRM

A production-ready, multi-agent WhatsApp CRM built with Django REST Framework and Next.js. It integrates with the Meta WhatsApp Cloud API to receive and send messages, auto-create leads, and manage agent workloads from a central dashboard.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Production Deployment](#production-deployment)
- [Scripts](#scripts)
- [WhatsApp Webhook Setup](#whatsapp-webhook-setup)

---

## Features

- **Inbound WhatsApp Messages** — Auto-receive messages via Meta Cloud API webhook, auto-create leads and chats
- **Outbound Messaging** — Agents reply directly from the CRM interface
- **Lead Management** — Track leads with tags, source, and status
- **Multi-Agent Support** — Admin assigns chats to agents; each agent sees only their assigned conversations
- **Role-Based Access** — Admin and Agent roles with separate dashboards
- **Delivery Status Tracking** — pending → sent → delivered → read → failed
- **JWT Authentication** — Secure login with 8-hour access tokens and 7-day refresh tokens
- **Async Task Queue** — Celery + Redis for background processing
- **Real-time Updates** — Auto-refreshing dashboard and chat views

---

## Architecture

```
                        ┌─────────────────┐
                        │   Nginx (shared) │  ← port 80 / 443
                        │  Inventory Portal│
                        └────────┬────────┘
                                 │ proxy_network
                    ┌────────────▼────────────┐
                    │      Django (Gunicorn)   │  ← port 8000 (internal)
                    │         web service      │
                    └──────┬──────────┬────────┘
                           │          │
              crm_internal │          │ crm_internal
               ┌───────────▼──┐  ┌───▼──────────────┐
               │  PostgreSQL  │  │      Redis        │
               │     db       │  │  (broker+cache)   │
               └──────────────┘  └───────┬───────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          │              │              │
                  ┌───────▼──────┐  ┌───▼──────────┐   │
                  │ celery_worker│  │ celery_beat  │   │
                  └──────────────┘  └──────────────┘   │
```

**Network isolation:**
- `crm_internal` — private bridge network; DB and Redis are never reachable from outside
- `proxy_network` — shared with Inventory_Portal's Nginx for routing

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django 5.0 + Django REST Framework |
| Authentication | JWT via `djangorestframework-simplejwt` |
| Database | PostgreSQL 16 (SQLite for local dev) |
| Task Queue | Celery 5.6 + Redis |
| WebSocket | Django Channels + Daphne |
| WSGI Server | Gunicorn |
| WhatsApp API | Meta Cloud API v20.0 |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| HTTP Client | Axios |
| Icons | Lucide React |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt / Certbot |
| OS | Ubuntu Linux |

---

## Project Structure

```
whatsapp-crm/
├── backend/
│   ├── config/
│   │   ├── settings.py        # Django settings
│   │   ├── urls.py            # Root URL config
│   │   ├── celery.py          # Celery app config
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── accounts/              # User auth & role management
│   │   ├── models.py          # User model (ADMIN / AGENT roles)
│   │   ├── views.py
│   │   └── serializers.py
│   ├── leads/                 # Core CRM logic
│   │   ├── models.py          # Lead, Chat, Message, Tag
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── services.py        # WhatsApp message sending
│   ├── webhooks/              # Meta Cloud API webhook handler
│   │   └── views.py
│   ├── requirements/
│   │   ├── base.txt           # Shared packages
│   │   ├── development.txt    # Dev-only packages
│   │   └── production.txt     # Production packages (includes gunicorn)
│   ├── Dockerfile             # Multi-stage production image
│   ├── entrypoint.sh          # Container startup script
│   └── .env.example           # Local dev env template
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── login/
│   │   │   ├── admin/         # Admin dashboard, leads, chats, agents
│   │   │   └── agent/         # Agent chat interface
│   │   ├── components/ui/     # Reusable UI components
│   │   ├── context/           # Auth context (JWT state)
│   │   └── lib/               # API client, token storage, formatters
│   └── package.json
├── ops/
│   ├── setup_vps.sh           # One-time VPS initialisation
│   ├── deploy.sh              # Production deployment
│   ├── rollback.sh            # Roll back to an earlier commit
│   ├── restart.sh             # Restart the stack (no code change)
│   ├── migrate.sh             # Run / inspect Django migrations
│   ├── status.sh              # Instant status overview
│   ├── health.sh              # Deep health checks
│   ├── monitor.sh             # Live resource monitor
│   ├── logs.sh                # Log viewer
│   ├── backup.sh              # PostgreSQL backup
│   ├── restore.sh             # PostgreSQL restore
│   ├── ssl-renew.sh           # Let's Encrypt renewal + Nginx reload
│   ├── secrets-check.sh       # Audit .env.production
│   └── cleanup.sh             # Reclaim disk space
├── docker/
│   ├── docker-compose.prod.yml    # Production stack
│   └── docker-compose.dev.yml     # Local development stack
└── VPS_SETUP_GUIDE.md         # Step-by-step VPS deployment guide
```

---

## Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- Git

### Backend

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/whatsapp-crm.git
cd whatsapp-crm/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install development dependencies
pip install -r requirements/development.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your local values

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## Environment Variables

### Backend (`.env` for local, `.env.production` for VPS)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key | `django-insecure-...` |
| `DEBUG` | Debug mode | `True` / `False` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `crm.yourdomain.com` |
| `DB_ENGINE` | Database engine | `sqlite` / `postgres` |
| `DB_NAME` | PostgreSQL database name | `whatsapp_crm_db` |
| `DB_USER` | PostgreSQL user | `whatsapp_crm_user` |
| `DB_PASSWORD` | PostgreSQL password | `strongpassword` |
| `DB_HOST` | Database host | `db` (Docker) / `localhost` |
| `DB_PORT` | Database port | `5432` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379/0` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins | `https://crm.yourdomain.com` |
| `WHATSAPP_TOKEN` | Meta permanent access token | `EAAWJu...` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID | `1139754...` |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | `my-secret-token` |

Copy the template to get started:
```bash
cp .env.production.template .env.production
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login/` | Obtain JWT tokens |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/me/` | Current user info |

### Users & Agents
| Method | Endpoint | Description | Role |
|---|---|---|---|
| GET/POST | `/api/agents/` | List / create agents | Admin |
| GET/PUT/DELETE | `/api/agents/{id}/` | Manage agent | Admin |
| GET/POST | `/api/users/` | List / create users | Admin |

### Leads & Chats
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/leads/` | List / create leads |
| GET/PUT/DELETE | `/api/leads/{id}/` | Manage lead |
| GET/POST | `/api/tags/` | List / create tags |
| GET | `/api/chats/` | List chats |
| POST | `/api/chats/{id}/assign/` | Assign chat to agent (Admin) |
| GET/POST | `/api/messages/` | List / send messages |

### Webhook
| Method | Endpoint | Description |
|---|---|---|
| GET | `/webhooks/whatsapp/` | Meta webhook verification |
| POST | `/webhooks/whatsapp/` | Receive inbound messages |

---

## Production Deployment

See the full step-by-step guide in [VPS_SETUP_GUIDE.md](VPS_SETUP_GUIDE.md).

Quick summary:

```bash
# 1. On VPS — one-time setup
sudo ./ops/setup_vps.sh

# 2. Configure environment, then verify it
nano .env.production
./ops/secrets-check.sh

# 3. Start all services
docker compose -f docker/docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Create superuser
docker exec -it whatsapp_crm_web python manage.py createsuperuser

# 5. Connect to shared Nginx
docker network connect proxy_network inventory_portal-nginx-1
```

### Redeploying after a code change

```bash
cd ~/whatsapp-crm
./ops/deploy.sh          # pull, rebuild backend + frontend, migrate, restart, verify
./ops/health.sh          # confirm
```

If something is wrong: `./ops/rollback.sh`

---

## Scripts

All scripts live in the `ops/` directory. Make them executable first:

```bash
chmod +x ops/*.sh
```

Every script supports `--help`.

| Script | Usage | Description |
|---|---|---|
| `setup_vps.sh` | `sudo ./ops/setup_vps.sh` | One-time VPS setup (Docker, network, crons) |
| `deploy.sh` | `./ops/deploy.sh` | Pull, build, migrate, restart, verify |
| `rollback.sh` | `./ops/rollback.sh --to a1b2c3d` | Roll code back to an earlier commit |
| `restart.sh` | `./ops/restart.sh --app` | Restart services without changing code |
| `migrate.sh` | `./ops/migrate.sh --plan` | Run or inspect Django migrations |
| `status.sh` | `./ops/status.sh` | Instant status overview (no network calls) |
| `health.sh` | `./ops/health.sh --domain api.qomunix.com` | Deep checks: DB, Redis, API, SSL, disk |
| `monitor.sh` | `./ops/monitor.sh --interval 2` | Live CPU/memory/queue monitor |
| `logs.sh` | `./ops/logs.sh web --follow` | View/stream logs |
| `backup.sh` | `./ops/backup.sh` | Backup PostgreSQL |
| `restore.sh` | `./ops/restore.sh --file backups/backup_XXX.sql.gz` | Restore database |
| `ssl-renew.sh` | `./ops/ssl-renew.sh --check` | Renew certificates, reload Nginx |
| `secrets-check.sh` | `./ops/secrets-check.sh` | Audit `.env.production` for misconfigurations |
| `cleanup.sh` | `./ops/cleanup.sh --dry-run` | Reclaim disk space |

---

## WhatsApp Webhook Setup

1. Go to [Meta Developer Console](https://developers.facebook.com) → Your App → WhatsApp → Configuration
2. Set **Webhook URL** to: `https://crm.yourdomain.com/webhooks/whatsapp/`
3. Set **Verify Token** to match `WHATSAPP_VERIFY_TOKEN` in your `.env.production`
4. Subscribe to these webhook fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`

---

## User Roles

| Role | Access |
|---|---|
| **Admin** | Full dashboard, lead assignment, agent management, all chats |
| **Agent** | Only assigned chats, reply to messages |

---

## License

Private — All rights reserved.
