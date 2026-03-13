# Deployment en VPS con Docker

Guía completa para desplegar el sistema de reservas en una VPS con Docker, Traefik, CI/CD y monitoreo.

## Índice

1. [Requisitos Previos](#1-requisitos-previos)
2. [Arquitectura](#2-arquitectura)
3. [Fase 1: Preparación del VPS](#3-fase-1-preparación-del-vps)
4. [Fase 2: Docker & Traefik](#4-fase-2-docker--traefik)
5. [Fase 3: CI/CD](#5-fase-3-cicd)
6. [Fase 4: Operación](#6-fase-4-operación)
7. [Fase 5: Monitoreo](#7-fase-5-monitoreo)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Requisitos Previos

### 1.1 VPS

- **Proveedor**: Cualquier VPS (DigitalOcean, Linode, Vultr, Hetzner, OVH, etc.)
- **Sistema Operativo**: Ubuntu 22.04 LTS o superior
- **RAM**: Mínimo 2GB (4GB recomendado)
- **CPU**: 2 cores o más
- **Disco**: 25GB SSD mínimo
- **Root access**: SSH con clave o password

### 1.2 Dominio

- Dominio registrado (ej: `tudominio.com`)
- Acceso a DNS para configurar registros A
- Subdominios configurados:
  - `reservas.tudominio.com` → Frontend
  - `api.reservas.tudominio.com` → Backend API
  - `traefik.reservas.tudominio.com` → Dashboard (opcional)

### 1.3 GitHub Account

- Cuenta de GitHub para CI/CD
- Repository con acceso de escritura
- GitHub Actions habilitado

### 1.4 Email

- Email válido para Let's Encrypt (ACME)
- Se usará para notificaciones de renovación de SSL

### 1.5 Variables de Entorno Requeridas

```bash
# Database
DB_USER=postgres
DB_PASSWORD=<password_seguro>
DB_NAME=sistema_reservas

# JWT
JWT_SECRET=<secreto_aleatorio_64_chars>
JWT_REFRESH_SECRET=<otro_secreto_aleatorio_64_chars>

# URLs
FRONTEND_URL=https://reservas.tudominio.com
NEXT_PUBLIC_API_URL=https://api.reservas.tudominio.com/api
API_DOMAIN=api.reservas.tudominio.com
FRONTEND_DOMAIN=reservas.tudominio.com
TRAEFIK_DOMAIN=traefik.reservas.tudominio.com

# SSL
ACME_EMAIL=tu@email.com

# Servicios externos
RESEND_API_KEY=<tu_api_key>
STRIPE_SECRET_KEY=<tu_stripe_key>

# Basic Auth para Traefik
TRAEFIK_BASIC_AUTH_USER=admin
TRAEFIK_BASIC_AUTH_PASS=<password_hash>
```

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                          INTERNET                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Puerto 80/443│
                    └───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         VPS                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Traefik v2.10                        │  │
│  │  (Reverse Proxy + SSL + Load Balancer + Auth)         │  │
│  │                                                        │  │
│  │  Entry Points:                                         │  │
│  │  - web (:80) → Redirección HTTPS                       │  │
│  │  - websecure (:443) → TLS con Let's Encrypt           │  │
│  └───────────────────────────────────────────────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │  Frontend   │     │   Backend   │     │  Dashboard  │   │
│  │  Next.js    │     │  Express    │     │  Traefik    │   │
│  │  :3000      │     │  :3001      │     │  :8080      │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│         │                    │                              │
│         └────────────────────┘                              │
│                    │                                        │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│  ┌─────────────┐       ┌─────────────┐                     │
│  │  PostgreSQL │       │    Redis    │                     │
│  │  :5432      │       │    :6379    │                     │
│  │  (Datos)    │       │   (Cache)   │                     │
│  └─────────────┘       └─────────────┘                     │
│                                                             │
│  Red Interna: postgres, redis (no expuestos)               │
│  Red Web: traefik, backend, frontend (expuestos)           │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Redes Docker

- **web**: Red bridge pública para Traefik y servicios expuestos
- **internal**: Red interna aislada para DB y Redis

### 2.2 Volúmenes

- `postgres_data`: Datos persistentes de PostgreSQL
- `redis_data`: Datos persistentes de Redis
- `traefik_certs`: Certificados SSL de Let's Encrypt
- `backups`: Directorio de backups locales

---

## 3. Fase 1: Preparación del VPS

### 3.1 Conexión Inicial

```bash
# Conectarse a la VPS
ssh root@<tu-vps-ip>

# O con clave SSH
ssh -i ~/.ssh/id_rsa root@<tu-vps-ip>
```

### 3.2 Actualización del Sistema

```bash
# Actualizar paquetes
apt update && apt upgrade -y

# Instalar utilidades básicas
apt install -y curl wget git vim htop ufw fail2ban unattended-upgrades

# Configurar actualizaciones automáticas de seguridad
dpkg-reconfigure -plow unattended-upgrades
```

### 3.3 Crear Usuario Deploy

```bash
# Crear usuario deploy
adduser deploy
# Seguir prompts para password

# Agregar a sudoers
usermod -aG sudo deploy

# Configurar SSH key para deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# Copiar clave pública del desarrollador
# (pegar contenido de ~/.ssh/id_rsa.pub local)
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 3.4 Configurar Firewall (UFW)

```bash
# Permitir SSH
ufw allow 22/tcp

# Permitir HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Habilitar firewall
ufw enable

# Verificar estado
ufw status verbose
```

### 3.5 Configurar Fail2Ban

```bash
# Crear configuración personalizada
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

# Reiniciar Fail2Ban
systemctl restart fail2ban
systemctl enable fail2ban

# Verificar estado
systemctl status fail2ban
```

### 3.6 Hardening de SSH

```bash
# Backup de configuración
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Editar configuración
cat > /etc/ssh/sshd_config << 'EOF'
Port 22
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
X11Forwarding no
AllowTcpForwarding no
AllowAgentForwarding no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 60
MaxAuthTries 3
MaxSessions 10
EOF

# Reiniciar SSH
systemctl restart sshd

# ⚠️ NO CERRAR LA SESIÓN ACTUAL HASTA PROBAR NUEVA CONEXIÓN
# En otra terminal:
ssh -i ~/.ssh/id_rsa deploy@<tu-vps-ip>
```

### 3.7 Configurar DNS

En el panel de DNS de tu dominio, agregar:

```
# Registro A para frontend
A  reservas.tudominio.com       → <tu-vps-ip>

# Registro A para API
A  api.reservas.tudominio.com   → <tu-vps-ip>

# Registro A para Traefik dashboard
A  traefik.reservas.tudominio.com → <tu-vps-ip>

# Opcional: Wildcard
A  *.reservas.tudominio.com     → <tu-vps-ip>
```

Verificar propagación:

```bash
ping reservas.tudominio.com
ping api.reservas.tudominio.com
```

---

## 4. Fase 2: Docker & Traefik

### 4.1 Instalar Docker

```bash
# Script oficial de instalación
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Agregar usuario deploy al grupo docker
usermod -aG docker deploy

# Verificar instalación
docker --version
docker compose version
```

### 4.2 Configurar Docker Daemon

```bash
# Crear directorio de configuración
mkdir -p /etc/docker

# Configurar daemon
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF

# Reiniciar Docker
systemctl restart docker
systemctl enable docker

# Verificar
docker info
```

### 4.3 Crear Estructura de Directorios

```bash
# Como usuario deploy
sudo -iu deploy

# Crear directorio del proyecto
mkdir -p ~/sistema-reservas
cd ~/sistema-reservas

# Crear subdirectorios
mkdir -p traefik/dynamic
mkdir -p traefik/logs
mkdir -p backups
mkdir -p scripts
```

### 4.4 Configurar Traefik

```bash
# Configurar traefik.yml
cat > ~/sistema-reservas/traefik/traefik.yml << 'EOF'
# Traefik Static Configuration
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: myresolver
        domains:
          - main: "reservas.tudominio.com"
            sans:
              - "*.reservas.tudominio.com"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: web
    watch: true

  file:
    directory: "/etc/traefik/dynamic"
    watch: true

certificatesResolvers:
  myresolver:
    acme:
      email: "tu@email.com"  # ← CAMBIAR
      storage: "/letsencrypt/acme.json"
      httpChallenge:
        entryPoint: web
      caserver: "https://acme-v02.api.letsencrypt.org/directory"

log:
  level: "INFO"
  filePath: "/var/log/traefik/traefik.log"
  format: "json"

accessLog:
  filePath: "/var/log/traefik/access.log"
  format: "json"
  bufferingSize: 100
EOF
```

### 4.5 Configurar Middlewares de Seguridad

```bash
# Middlewares dinámicos
cat > ~/sistema-reservas/traefik/dynamic/middlewares.yml << 'EOF'
http:
  middlewares:
    # Security Headers
    security-headers:
      headers:
        frameDeny: true
        browserXssFilter: true
        contentTypeNosniff: true
        sslRedirect: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        customRequestHeaders:
          X-Forwarded-Proto: "https"

    # Rate Limiting
    ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m

    # Compression
    compress:
      compress: {}

    # Basic Auth para Dashboard
    dashboard-auth:
      basicAuth:
        users:
          # admin:admin (GENERAR HASH NUEVO)
          # htpasswd -nb admin <password> | openssl base64
          - "admin:$apr1$xyz$hashed_password_here"
EOF
```

### 4.6 Generar Basic Auth para Traefik

```bash
# Generar hash de password
# En tu máquina local:
docker run --rm httpd htpasswd -nb admin <tu_password>

# Copiar el output al archivo middlewares.yml
# Reemplazar la línea de users en dashboard-auth
```

### 4.7 Crear Archivo .env

```bash
# En ~/sistema-reservas/.env
cat > ~/sistema-reservas/.env << 'EOF'
# ===========================================
# VARIABLES DE ENTORNO - PRODUCCIÓN
# ===========================================

# Database
DB_USER=postgres
DB_PASSWORD=<generar_password_seguro>
DB_NAME=sistema_reservas

# JWT Secrets (generar con: openssl rand -hex 32)
JWT_SECRET=<generar_con_openssl>
JWT_REFRESH_SECRET=<generar_con_openssl>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# URLs
FRONTEND_URL=https://reservas.tudominio.com
NEXT_PUBLIC_API_URL=https://api.reservas.tudominio.com/api
API_DOMAIN=api.reservas.tudominio.com
FRONTEND_DOMAIN=reservas.tudominio.com
TRAEFIK_DOMAIN=traefik.reservas.tudominio.com

# SSL/TLS
ACME_EMAIL=tu@email.com

# Servicios Externos
RESEND_API_KEY=<tu_api_key_resend>
STRIPE_SECRET_KEY=<tu_stripe_secret_key>

# Traefik Basic Auth (hash generado)
TRAEFIK_BASIC_AUTH_USER=admin
TRAEFIK_BASIC_AUTH_PASS=<hash_htpasswd>

# Backup
BACKUP_DIR=/home/deploy/sistema-reservas/backups
BACKUP_RETENTION_DAYS=7
BACKUP_EMAIL=tu@email.com

# S3/R2 (opcional para backups remotos)
S3_BUCKET=
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
EOF

# Generar secrets
openssl rand -hex 32  # Para JWT_SECRET
openssl rand -hex 32  # Para JWT_REFRESH_SECRET
```

### 4.8 Crear docker-compose.prod.yml

```bash
# Copiar desde el repositorio
# O crear manualmente:
cat > ~/sistema-reservas/docker-compose.prod.yml << 'EOF'
version: "3.8"

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: sistema-reservas-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-sistema_reservas}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-sistema_reservas}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: sistema-reservas-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Backend (Express + Prisma)
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    container_name: sistema-reservas-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      PORT: 3001
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      FRONTEND_URL: ${FRONTEND_URL}
      RESEND_API_KEY: ${RESEND_API_KEY}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${API_DOMAIN}`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls=true"
      - "traefik.http.routers.backend.tls.certresolver=myresolver"
      - "traefik.http.routers.backend.middlewares=security-headers,ratelimit,compress"
      - "traefik.http.services.backend.loadbalancer.server.port=3001"
      - "traefik.http.services.backend.loadbalancer.healthcheck.path=/health"
      - "traefik.http.services.backend.loadbalancer.healthcheck.interval=30s"
      - "traefik.http.services.backend.loadbalancer.healthcheck.timeout=10s"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Frontend (Next.js)
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    container_name: sistema-reservas-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    depends_on:
      backend:
        condition: service_started
    networks:
      - internal
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${FRONTEND_DOMAIN}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
      - "traefik.http.routers.frontend.middlewares=security-headers,ratelimit,compress"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
      - "traefik.http.services.frontend.loadbalancer.healthcheck.path=/"
      - "traefik.http.services.frontend.loadbalancer.healthcheck.interval=30s"
      - "traefik.http.services.frontend.loadbalancer.healthcheck.timeout=10s"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Traefik Reverse Proxy
  traefik:
    image: traefik:v2.10
    container_name: sistema-reservas-proxy
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=web"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--providers.file.watch=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.httpchallenge=true"
      - "--certificatesresolvers.myresolver.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.myresolver.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
      - "--log.level=INFO"
      - "--accesslog=true"
      - "--accesslog.filepath=/var/log/traefik/access.log"
      - "--accesslog.bufferingsize=100"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/dynamic:/etc/traefik/dynamic:ro
      - ./traefik/logs:/var/log/traefik
    networks:
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`${TRAEFIK_DOMAIN}`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.routers.dashboard.tls.certresolver=myresolver"
      - "traefik.http.routers.dashboard.middlewares=dashboard-auth"
      - "traefik.http.services.dashboard.loadbalancer.server.port=8080"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  traefik_certs:
    driver: local
  backups:
    driver: local

networks:
  web:
    driver: bridge
    name: web
  internal:
    driver: bridge
    name: internal
    internal: true
EOF
```

### 4.9 Copiar Scripts de Utilidad

```bash
# Copiar desde el repositorio local
scp -i ~/.ssh/id_rsa scripts/*.sh deploy@<tu-vps-ip>:~/sistema-reservas/scripts/

# O crear manualmente en la VPS
# (ver scripts/backup-db.sh, restore-db.sh, health-check.sh, deploy-manual.sh)
```

### 4.10 Primer Deploy

```bash
# En la VPS, como usuario deploy
cd ~/sistema-reservas

# Crear redes Docker
docker network create web 2>/dev/null || true
docker network create internal 2>/dev/null || true

# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Verificar contenedores
docker ps

# Verificar health checks
docker inspect --format='{{.State.Health.Status}}' sistema-reservas-db
docker inspect --format='{{.State.Health.Status}}' sistema-reservas-redis
docker inspect --format='{{.State.Health.Status}}' sistema-reservas-backend
```

### 4.11 Verificar SSL

```bash
# Esperar 2-5 minutos para que Traefik obtenga certificados

# Verificar certificados
docker exec sistema-reservas-proxy ls -la /letsencrypt/

# Ver logs de Traefik
docker logs sistema-reservas-proxy | grep -i "acme\|certificate\|tls"

# Probar HTTPS
curl -I https://reservas.tudominio.com
curl -I https://api.reservas.tudominio.com/health

# Verificar SSL con openssl
echo | openssl s_client -connect reservas.tudominio.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 4.12 Migrar Base de Datos

```bash
# Ejecutar migraciones de Prisma
docker exec sistema-reservas-backend npx prisma migrate deploy

# Seed inicial (opcional)
docker exec sistema-reservas-backend npm run db:seed

# Verificar tablas
docker exec sistema-reservas-db psql -U postgres -d sistema_reservas -c "\dt"
```

---

## 5. Fase 3: CI/CD

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/deploy-vps.yml
name: Deploy to VPS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VPS_HOST: ${{ secrets.VPS_HOST }}
  VPS_USER: ${{ secrets.VPS_USER }}
  VPS_PORT: ${{ secrets.VPS_PORT }}
  PROJECT_NAME: sistema-reservas

jobs:
  test:
    name: Test & Lint
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test backend
        run: npm run test:backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Test frontend
        run: npm run test:frontend

  build:
    name: Build & Push
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build backend
        uses: docker/build-push-action@v5
        with:
          context: ./apps/backend
          push: false
          tags: sistema-reservas-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build frontend
        uses: docker/build-push-action@v5
        with:
          context: ./apps/frontend
          push: false
          tags: sistema-reservas-frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}

  deploy:
    name: Deploy to VPS
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}

      - name: Add VPS to known_hosts
        run: |
          ssh-keyscan -p ${{ secrets.VPS_PORT }} ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy to VPS
        run: |
          ssh -p ${{ secrets.VPS_PORT }} ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'ENDSSH'
            cd ~/sistema-reservas
            
            # Pull latest code
            git pull origin main
            
            # Build new images
            docker compose -f docker-compose.prod.yml build --parallel
            
            # Deploy with zero downtime
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            
            # Run migrations
            docker exec sistema-reservas-backend npx prisma migrate deploy
            
            # Cleanup old images
            docker image prune -f
            
            # Health check
            sleep 10
            ./scripts/health-check.sh || exit 1
          ENDSSH

      - name: Notify success
        if: success()
        run: echo "Deploy completed successfully!"

      - name: Notify failure
        if: failure()
        run: echo "Deploy failed! Check logs."
```

### 5.2 Configurar Secrets en GitHub

```bash
# En GitHub → Settings → Secrets and variables → Actions

# Agregar los siguientes secrets:
VPS_HOST=<tu-vps-ip>
VPS_USER=deploy
VPS_PORT=22
VPS_SSH_KEY=<contenido_de_~/.ssh/id_rsa>
NEXT_PUBLIC_API_URL=https://api.reservas.tudominio.com/api

# Opcional para notificaciones:
RESEND_API_KEY=<tu_api_key>
SLACK_WEBHOOK_URL=<tu_webhook>
```

### 5.3 Deploy Manual (Sin CI/CD)

```bash
# Script local: scripts/deploy-manual.sh
# Ver documentación en el script

# Ejecutar deploy
cd /path/to/sistema-reservas

# Opción 1: Docker save/load (recomendado)
./scripts/deploy-manual.sh \
  --vps-host <tu-vps-ip> \
  --vps-user deploy \
  --method save

# Opción 2: Push a registry temporal
./scripts/deploy-manual.sh \
  --vps-host <tu-vps-ip> \
  --vps-user deploy \
  --method push \
  --registry registry.hub.docker.com/tu-usuario

# Dry-run (simular sin ejecutar)
./scripts/deploy-manual.sh --dry-run
```

### 5.4 Rollback Automático

El workflow de CI/CD incluye rollback automático si el health check falla:

```yaml
- name: Rollback on failure
  if: failure()
  run: |
    ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'ENDSSH'
      cd ~/sistema-reservas
      
      # Revertir al commit anterior
      git reset --hard HEAD~1
      
      # Re-deployar versión anterior
      docker compose -f docker-compose.prod.yml up -d
      
      # Notificar
      echo "Rollback completado"
    ENDSSH
```

---

## 6. Fase 4: Operación

### 6.1 Comandos Útiles

```bash
# Ver estado de servicios
docker ps
docker compose -f docker-compose.prod.yml ps

# Ver logs
docker compose -f docker-compose.prod.yml logs -f
docker logs -f sistema-reservas-backend
docker logs -f sistema-reservas-frontend
docker logs -f sistema-reservas-proxy

# Restart servicios
docker compose -f docker-compose.prod.yml restart
docker restart sistema-reservas-backend

# Stop servicios
docker compose -f docker-compose.prod.yml down

# Stop y eliminar volúmenes (⚠️ DESTRUCTIVE)
docker compose -f docker-compose.prod.yml down -v

# Ver uso de recursos
docker stats

# Limpiar Docker
docker system prune -a
docker volume prune
```

### 6.2 Backup de Base de Datos

```bash
# Backup manual
cd ~/sistema-reservas
./scripts/backup-db.sh

# Backup con upload a S3
./scripts/backup-db.sh --s3-upload --s3-bucket mi-bucket --s3-endpoint https://s3.endpoint.com

# Ver backups disponibles
ls -lh ~/sistema-reservas/backups/

# Agendar backup automático (cron)
crontab -e

# Agregar línea para backup diario a las 3 AM
0 3 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-db.sh --s3-upload >> /var/log/backup.log 2>&1
```

### 6.3 Restore de Base de Datos

```bash
# Listar backups disponibles
./scripts/restore-db.sh --help

# Restore automático (último backup)
./scripts/restore-db.sh

# Restore específico
./scripts/restore-db.sh \
  --pg-backup ./backups/pg_sistema_reservas_20240101_120000.dump.gz \
  --redis-backup ./backups/redis_20240101_120000.rdb.gz

# Dry-run (simular)
./scripts/restore-db.sh --dry-run

# Forzar restore sin confirmación
./scripts/restore-db.sh --force
```

### 6.4 Health Check

```bash
# Health check completo
./scripts/health-check.sh

# Health check remoto (desde tu máquina local)
./scripts/health-check.sh \
  --vps-host <tu-vps-ip> \
  --vps-user deploy \
  --frontend-url https://reservas.tudominio.com \
  --api-url https://api.reservas.tudominio.com

# Output JSON (para monitoreo)
./scripts/health-check.sh --json

# Quiet mode (solo errores)
./scripts/health-check.sh --quiet

# Agendar health check cada 5 minutos
*/5 * * * * cd /home/deploy/sistema-reservas && ./scripts/health-check.sh --quiet >> /var/log/health.log 2>&1
```

### 6.5 Monitoreo de Logs

```bash
# Logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Logs de un servicio específico
docker logs -f sistema-reservas-backend

# Logs con timestamps
docker logs -f --timestamps sistema-reservas-backend

# Últimas 100 líneas
docker logs --tail 100 sistema-reservas-backend

# Buscar errores
docker logs sistema-reservas-backend 2>&1 | grep -i error

# Exportar logs a archivo
docker logs sistema-reservas-backend > backend-$(date +%Y%m%d).log 2>&1
```

### 6.6 Actualización de la Aplicación

```bash
# Método 1: Git pull + rebuild
cd ~/sistema-reservas
git pull origin main
docker compose -f docker-compose.prod.yml build --parallel
docker compose -f docker-compose.prod.yml up -d
docker exec sistema-reservas-backend npx prisma migrate deploy

# Método 2: Deploy script
./scripts/deploy-manual.sh --skip-transfer --no-restart

# Método 3: CI/CD (push a main)
git push origin main
```

### 6.7 Gestión de Certificados SSL

```bash
# Ver certificados
docker exec sistema-reservas-proxy ls -la /letsencrypt/

# Ver detalles del certificado
echo | openssl s_client -connect reservas.tudominio.com:443 2>/dev/null | openssl x509 -noout -dates

# Forzar renovación
docker exec sistema-reservas-proxy traefik traefik-job certificates renew

# Ver logs de renovación
docker logs sistema-reservas-proxy | grep -i "acme\|renew"
```

### 6.8 Escalado Horizontal

```bash
# Escalar backend (múltiples instancias)
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Ver instancias
docker ps | grep backend

# Logs de todas las instancias
docker logs -f sistema-reservas-backend-1
docker logs -f sistema-reservas-backend-2
docker logs -f sistema-reservas-backend-3

# ⚠️ Nota: Traefik automáticamente distribuye el tráfico
```

---

## 7. Fase 5: Monitoreo

### 7.1 Health Check Continuo

```bash
# Agregar a crontab
crontab -e

# Health check cada 5 minutos
*/5 * * * * cd /home/deploy/sistema-reservas && ./scripts/health-check.sh --json >> /var/log/health.json.log 2>&1

# Alerta por email si falla
*/5 * * * * cd /home/deploy/sistema-reservas && ./scripts/health-check.sh --quiet || echo "Health check failed at $(date)" | mail -s "ALERTA: Sistema no saludable" tu@email.com
```

### 7.2 Monitoreo de Recursos

```bash
# Instalar herramientas
apt install -y htop iotop nethogs

# Ver uso de CPU/Memory
htop

# Ver uso de disco por proceso
iotop

# Ver uso de red por proceso
nethogs

# Ver uso de Docker
docker stats --no-stream

# Ver tamaño de contenedores
docker system df
```

### 7.3 Logs Centralizados

```bash
# Instalar Loki (opcional, para logging avanzado)
# Ver https://grafana.com/docs/loki/latest/

# O usar docker-logs-to-file
docker compose -f docker-compose.prod.yml logs -f > /var/log/sistema-reservas/completed.log 2>&1 &

# Rotar logs con logrotate
cat > /etc/logrotate.d/sistema-reservas << 'EOF'
/var/log/sistema-reservas/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        systemctl reload rsyslog
    endscript
}
EOF
```

### 7.4 Métricas con Prometheus + Grafana (Opcional)

```bash
# Agregar al docker-compose.prod.yml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: sistema-reservas-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - web
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    container_name: sistema-reservas-grafana
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<password>
    networks:
      - web
    ports:
      - "3000:3000"
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### 7.5 Alertas

```bash
# Script de alertas por email
cat > ~/sistema-reservas/scripts/send-alert.sh << 'EOF'
#!/bin/bash
# send-alert.sh - Enviar alerta por email

MESSAGE="$1"
SUBJECT="${2:-Alerta del Sistema}"

# Usar mail (si está instalado)
if command -v mail &>/dev/null; then
  echo "$MESSAGE" | mail -s "$SUBJECT" tu@email.com
  exit 0
fi

# Usar curl con API de email (Resend, SendGrid, etc)
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"from\": \"alerts@tudominio.com\",
    \"to\": [\"tu@email.com\"],
    \"subject\": \"$SUBJECT\",
    \"html\": \"<p>$MESSAGE</p>\"
  }"
EOF

chmod +x ~/sistema-reservas/scripts/send-alert.sh
```

### 7.6 Dashboard de Monitoreo

```bash
# Crear dashboard simple con scripts
cat > ~/sistema-reservas/scripts/dashboard.sh << 'EOF'
#!/bin/bash
# dashboard.sh - Dashboard de estado del sistema

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        SISTEMA DE RESERVAS - DASHBOARD                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Fecha: $(date)"
echo "Host: $(hostname)"
echo ""

echo "┌──────────────────────────────────────────────────────────┐"
echo "│ ESTADO DE CONTENEDORES                                   │"
echo "└──────────────────────────────────────────────────────────┘"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep sistema-reservas

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│ USO DE RECURSOS                                          │"
echo "└──────────────────────────────────────────────────────────┘"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│ ESPACIO EN DISCO                                         │"
echo "└──────────────────────────────────────────────────────────┘"
df -h / | tail -1

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│ ÚLTIMOS BACKUPS                                          │"
echo "└──────────────────────────────────────────────────────────┘"
ls -lht ~/sistema-reservas/backups/*.gz 2>/dev/null | head -5 || echo "No hay backups"

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│ CERTIFICADO SSL                                          │"
echo "└──────────────────────────────────────────────────────────┘"
echo | openssl s_client -connect reservas.tudominio.com:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "No se pudo verificar"

echo ""
EOF

chmod +x ~/sistema-reservas/scripts/dashboard.sh

# Ejecutar dashboard
./scripts/dashboard.sh
```

### 7.7 Backup Remoto (S3/R2)

```bash
# Configurar AWS CLI para S3/R2
apt install -y awscli

# Configurar credenciales
aws configure set aws_access_key_id $S3_ACCESS_KEY
aws configure set aws_secret_access_key $S3_SECRET_KEY
aws configure set default.region us-east-1

# Para R2, configurar endpoint
aws configure set default.s3.endpoint_url $S3_ENDPOINT

# Backup automático a S3
cat > ~/sistema-reservas/scripts/backup-s3.sh << 'EOF'
#!/bin/bash
# backup-s3.sh - Backup a S3/R2

BACKUP_DIR=~/sistema-reservas/backups
S3_BUCKET=$S3_BUCKET
S3_PATH="s3://$S3_BUCKET/backups/$(date +%Y/%m/)"

# Sync backups locales a S3
aws s3 sync $BACKUP_DIR $S3_PATH --acl private

# Eliminar backups locales antiguos (mantener solo últimos 7 días)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup a S3 completado: $S3_PATH"
EOF

chmod +x ~/sistema-reservas/scripts/backup-s3.sh

# Agendar en cron
crontab -e
# Backup a S3 diario a las 4 AM
0 4 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-s3.sh >> /var/log/backup-s3.log 2>&1
```

### 7.8 Disaster Recovery Plan

```bash
# Documentación de DR
cat > ~/sistema-reservas/docs/DISASTER_RECOVERY.md << 'EOF'
# Disaster Recovery Plan

## Escenarios

### 1. Caída de la VPS
- Provvedere nuevo VPS
- Restaurar desde backup S3
- Actualizar DNS con nueva IP
- Tiempo estimado: 30-60 minutos

### 2. Corrupción de Base de Datos
- Detener aplicación
- Restaurar desde último backup válido
- Verificar integridad
- Reiniciar servicios
- Tiempo estimado: 10-20 minutos

### 3. Ataque de Seguridad
- Aislar VPS (cortar red)
- Analizar logs
- Reconstruir desde imagen limpia
- Rotar todas las credenciales
- Notificar a usuarios afectados
- Tiempo estimado: 2-4 horas

## Contactos de Emergencia
- DevOps: tu@email.com
- CTO: cto@email.com
- Hosting: support@vps-provider.com

## Checklist Post-Incidente
- [ ] Identificar causa raíz
- [ ] Documentar timeline
- [ ] Implementar fix permanente
- [ ] Actualizar runbooks
- [ ] Notificar a stakeholders
EOF
```

---

## 8. Troubleshooting

### 8.1 Problemas Comunes

#### SSL no funciona

```bash
# Verificar logs de Traefik
docker logs sistema-reservas-proxy | grep -i "acme\|certificate"

# Verificar DNS
dig reservas.tudominio.com
dig api.reservas.tudominio.com

# Verificar puertos
netstat -tlnp | grep :80
netstat -tlnp | grep :443

# Forzar renovación
docker exec sistema-reservas-proxy traefik traefik-job certificates renew

# Verificar firewall
ufw status
```

#### Contenedores no inician

```bash
# Ver logs del contenedor
docker logs sistema-reservas-backend

# Verificar dependencias
docker inspect --format='{{.State.Health.Status}}' sistema-reservas-db

# Verificar variables de entorno
docker inspect sistema-reservas-backend | grep -A 20 "Env"

# Verificar redes
docker network ls
docker network inspect web
docker network inspect internal
```

#### Base de datos no conecta

```bash
# Verificar que DB esté healthy
docker inspect --format='{{.State.Health.Status}}' sistema-reservas-db

# Probar conexión desde backend
docker exec sistema-reservas-backend nc -zv sistema-reservas-db 5432

# Verificar DATABASE_URL
docker exec sistema-reservas-backend printenv DATABASE_URL

# Ver logs de PostgreSQL
docker logs sistema-reservas-db
```

#### API no responde

```bash
# Verificar health endpoint
curl -v https://api.reservas.tudominio.com/health

# Ver logs del backend
docker logs --tail 100 sistema-reservas-backend

# Verificar que el contenedor esté running
docker ps | grep backend

# Probar desde dentro del contenedor
docker exec sistema-reservas-backend curl http://localhost:3001/health
```

#### Frontend no carga

```bash
# Verificar logs
docker logs --tail 100 sistema-reservas-frontend

# Verificar NEXT_PUBLIC_API_URL
docker exec sistema-reservas-frontend printenv NEXT_PUBLIC_API_URL

# Probar endpoint API
curl https://api.reservas.tudominio.com/health

# Verificar Traefik routing
docker exec sistema-reservas-proxy traefik health
```

#### Alto uso de CPU/Memory

```bash
# Identificar proceso
docker stats

# Ver logs de errores
docker logs sistema-reservas-backend 2>&1 | grep -i error

# Restart servicio
docker restart sistema-reservas-backend

# Escalar si es necesario
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

#### Disco lleno

```bash
# Ver uso de disco
df -h

# Limpiar Docker
docker system prune -a
docker volume prune

# Eliminar logs antiguos
find /var/log -name "*.log" -mtime +30 -delete

# Verificar backups
du -sh ~/sistema-reservas/backups/

# Rotar backups
./scripts/backup-db.sh --retention 3
```

### 8.2 Comandos de Debug

```bash
# Ver todo el sistema
docker compose -f docker-compose.prod.yml ps -a

# Inspeccionar contenedor
docker inspect sistema-reservas-backend

# Ver logs de Traefik en detalle
docker logs --tail 200 sistema-reservas-proxy | jq

# Probar conexión entre servicios
docker exec sistema-reservas-backend ping -c 3 sistema-reservas-db
docker exec sistema-reservas-backend ping -c 3 sistema-reservas-redis

# Ver configuración de Traefik
docker exec sistema-reservas-proxy cat /etc/traefik/traefik.yml
docker exec sistema-reservas-proxy cat /etc/traefik/dynamic/middlewares.yml

# Ver certificados SSL
docker exec sistema-reservas-proxy ls -la /letsencrypt/
docker exec sistema-reservas-proxy cat /letsencrypt/acme.json | jq
```

### 8.3 Recovery de Emergencia

```bash
# Stop completo
docker compose -f docker-compose.prod.yml down

# Eliminar volúmenes (⚠️ DESTRUCTIVE - solo si es necesario)
docker compose -f docker-compose.prod.yml down -v

# Re-iniciar desde cero
docker compose -f docker-compose.prod.yml up -d

# Forzar rebuild
docker compose -f docker-compose.prod.yml build --no-cache

# Restore desde backup
./scripts/restore-db.sh --force

# Verificar health
./scripts/health-check.sh
```

### 8.4 Contactos y Recursos

- **Documentación oficial Docker**: https://docs.docker.com
- **Documentación Traefik**: https://doc.traefik.io/traefik/
- **Documentación Prisma**: https://www.prisma.io/docs
- **Documentación Next.js**: https://nextjs.org/docs
- **Soporte VPS**: support@vps-provider.com
- **Let's Encrypt**: https://letsencrypt.org/docs/

---

## Apéndice A: Checklist de Deploy

```markdown
## Pre-Deploy

- [ ] VPS creada con Ubuntu 22.04+
- [ ] DNS configurado (A records)
- [ ] SSH keys generadas y configuradas
- [ ] Variables de entorno preparadas
- [ ] Backups configurados

## Deploy

- [ ] Docker instalado
- [ ] Traefik configurado
- [ ] Certificados SSL obtenidos
- [ ] Servicios iniciados
- [ ] Health checks passing

## Post-Deploy

- [ ] CI/CD configurado
- [ ] Backups automáticos funcionando
- [ ] Monitoreo configurado
- [ ] Alertas configuradas
- [ ] Documentación actualizada
```

## Apéndice B: Variables de Entorno

| Variable              | Descripción                | Ejemplo                        |
| --------------------- | -------------------------- | ------------------------------ |
| `DB_USER`             | Usuario de PostgreSQL      | `postgres`                     |
| `DB_PASSWORD`         | Password de PostgreSQL     | `<secure>`                     |
| `DB_NAME`             | Nombre de la BD            | `sistema_reservas`             |
| `JWT_SECRET`          | Secret para JWT tokens     | `<64 chars>`                   |
| `JWT_REFRESH_SECRET`  | Secret para refresh tokens | `<64 chars>`                   |
| `FRONTEND_URL`        | URL del frontend           | `https://reservas.dominio.com` |
| `NEXT_PUBLIC_API_URL` | URL de la API (frontend)   | `https://api.dominio.com/api`  |
| `API_DOMAIN`          | Dominio de la API          | `api.reservas.dominio.com`     |
| `FRONTEND_DOMAIN`     | Dominio del frontend       | `reservas.dominio.com`         |
| `TRAEFIK_DOMAIN`      | Dominio del dashboard      | `traefik.reservas.dominio.com` |
| `ACME_EMAIL`          | Email para Let's Encrypt   | `tu@email.com`                 |
| `RESEND_API_KEY`      | API key de Resend          | `re_xxx`                       |
| `STRIPE_SECRET_KEY`   | API key de Stripe          | `sk_xxx`                       |
| `S3_BUCKET`           | Bucket para backups        | `mi-bucket`                    |
| `S3_ENDPOINT`         | Endpoint S3/R2             | `https://s3.endpoint.com`      |
| `S3_ACCESS_KEY`       | Access key S3              | `<key>`                        |
| `S3_SECRET_KEY`       | Secret key S3              | `<secret>`                     |

---

**Última actualización**: Marzo 2026
**Versión**: 1.0.0
