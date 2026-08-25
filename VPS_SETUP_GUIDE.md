# WhatsApp CRM — VPS Deployment Guide

## Prerequisites
- Ubuntu VPS with root access
- Inventory_Portal already running (DO NOT touch it)
- A domain/subdomain pointing to this VPS IP (e.g., `crm.yourdomain.com`)
- DNS A record set BEFORE running Certbot

---

## STEP 1 — Clone the Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/whatsapp-crm.git whatsapp-crm
cd whatsapp-crm
```

---

## STEP 2 — Create the Production .env File

```bash
cp .env.production.template .env.production
nano .env.production
```

Fill in every value. Key ones:

```bash
# Generate a real secret key:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# Then paste it as SECRET_KEY in .env.production
```

Set permissions so only root can read it:

```bash
chmod 600 .env.production
```

---

## STEP 3 — Create the Shared Docker Network

This network allows Inventory_Portal's Nginx to reach the CRM web container.

```bash
docker network create proxy_network
```

> If it already exists you will see an error — that is fine, ignore it.

---

## STEP 4 — Build and Start CRM Services

```bash
cd ~/whatsapp-crm
docker compose -f docker/docker-compose.prod.yml up -d --build
```

Check all containers are running:

```bash
docker compose -f docker/docker-compose.prod.yml ps
```

Expected output:
```
NAME                        STATUS
whatsapp_crm_db             Up (healthy)
whatsapp_crm_redis          Up (healthy)
whatsapp_crm_web            Up (healthy)
whatsapp_crm_celery_worker  Up
whatsapp_crm_celery_beat    Up
```

Check web logs to confirm startup:

```bash
docker logs whatsapp_crm_web --tail 50
```

---

## STEP 5 — Create Django Superuser

```bash
docker exec -it whatsapp_crm_web python manage.py createsuperuser
```

---

## STEP 6 — Connect proxy_network to Inventory_Portal's Nginx

The CRM web container needs to be reachable by Inventory_Portal's existing Nginx.

```bash
docker network connect proxy_network inventory_portal-nginx-1
```

Verify:

```bash
docker network inspect proxy_network
```

You should see both `whatsapp_crm_web` and `inventory_portal-nginx-1` in the containers list.

---

## STEP 7 — Get SSL Certificate (Certbot)

Certbot is already inside Inventory_Portal's setup. We get a new cert for the CRM domain.

```bash
# Run certbot inside the existing nginx container
docker exec -it inventory_portal-nginx-1 sh

# Inside the container:
certbot certonly --webroot \
  -w /var/www/certbot \
  -d crm.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive

exit
```

If webroot method fails (no certbot in that container), use standalone on the host:

```bash
# Stop port 80 temporarily
docker compose -f ~/Inventory_Portal/docker-compose.prod.yml stop nginx

# Get cert
apt-get install -y certbot
certbot certonly --standalone -d crm.yourdomain.com

# Restart nginx
docker compose -f ~/Inventory_Portal/docker-compose.prod.yml start nginx
```

Certificates will be at:
```
/etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem
/etc/letsencrypt/live/crm.yourdomain.com/privkey.pem
```

---

## STEP 8 — Add CRM Server Block to Inventory Portal's Nginx

```bash
nano ~/Inventory_Portal/nginx/crm.conf
```

Paste this content (replace `crm.yourdomain.com` with your actual domain):

```nginx
upstream crm_backend {
    server whatsapp_crm_web:8000;
}

server {
    listen 80;
    server_name crm.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name crm.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/crm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    # Security headers
    add_header X-Frame-Options           "SAMEORIGIN"   always;
    add_header X-Content-Type-Options    "nosniff"      always;
    add_header X-XSS-Protection          "1; mode=block" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static files — served directly by Nginx from Docker volume
    location /static/ {
        alias /vol/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /vol/media/;
        expires 7d;
    }

    # All other requests → Gunicorn
    location / {
        proxy_pass         http://crm_backend;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
```

---

## STEP 9 — Mount CRM Volumes into Inventory Portal's Nginx

Edit `~/Inventory_Portal/docker-compose.prod.yml` and add CRM volumes to the nginx service:

```yaml
  nginx:
    volumes:
      # ... existing volumes ...
      - whatsapp_crm_static_files:/vol/static:ro
      - whatsapp_crm_media_files:/vol/media:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro

# Add at the bottom under existing external volumes:
volumes:
  whatsapp_crm_static_files:
    external: true
  whatsapp_crm_media_files:
    external: true
```

---

## STEP 10 — Reload Inventory Portal's Nginx

```bash
cd ~/Inventory_Portal
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Test Nginx config first:

```bash
docker exec inventory_portal-nginx-1 nginx -t
```

---

## STEP 11 — Verify Everything Works

```bash
# Test HTTPS
curl -I https://crm.yourdomain.com/api/auth/login/

# Should return HTTP 200 or 405 (Method Not Allowed for GET) — both mean Django is running

# Check all CRM containers
docker compose -f ~/whatsapp-crm/docker/docker-compose.prod.yml ps

# Check logs
docker logs whatsapp_crm_web --tail 30
docker logs whatsapp_crm_celery_worker --tail 20
```

---

## Useful Commands

```bash
# Restart all CRM services
docker compose -f ~/whatsapp-crm/docker/docker-compose.prod.yml restart

# Stop all CRM services (does NOT delete data)
docker compose -f ~/whatsapp-crm/docker/docker-compose.prod.yml down

# View live logs
docker compose -f ~/whatsapp-crm/docker/docker-compose.prod.yml logs -f

# Run Django management command
docker exec -it whatsapp_crm_web python manage.py <command>

# Open PostgreSQL shell
docker exec -it whatsapp_crm_db psql -U $DB_USER -d $DB_NAME

# Pull latest code and redeploy (handles build, migrate, restart and verify)
cd ~/whatsapp-crm
./ops/deploy.sh

# Roll back if the deploy went wrong
./ops/rollback.sh

# Restart without changing code
./ops/restart.sh
```

---

## SSL Auto-Renewal

Add to crontab (runs twice daily — Let's Encrypt recommendation):

```bash
crontab -e
```

Add this line:

```
0 0,12 * * * certbot renew --quiet && docker exec inventory_portal-nginx-1 nginx -s reload
```
