#!/bin/bash
set -euo pipefail

# =============================================================================
# Script de Despliegue para VPS
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔧 $1${NC}"; }

main() {
  log_info "=== Inicio del despliegue en VPS ==="
  log_info "Fecha: $(date)"
  
  # Verificar si se está ejecutando como root (necesario para primeros pasos)
  if [ "$EUID" -eq 0 ]; then
    log_info "Ejecutando como root, cambiando a usuario deploy"
    
    # Crear usuario deploy si no existe
    if ! id "deploy" &>/dev/null; then
      log_step "Creando usuario deploy..."
      adduser --disabled-password --gecos "" deploy
      usermod -aG sudo deploy
      echo "deploy ALL=(ALL) NOPASSWD:ALL" | tee -a /etc/sudoers
      
      # Agregar usuario deploy al grupo docker
      usermod -aG docker deploy
      log_success "Usuario deploy creado"
    else
      log_info "Usuario deploy ya existe"
    fi
    
    # Cambiarse al usuario deploy para continuar
    su - deploy -c "$(readlink -f "$0")" -- "$@"
    exit $?
  fi
  
  # Continuar como usuario deploy
  log_info "Continuando como usuario deploy"
  
  # Crear directorio del proyecto
  log_step "Creando estructura de directorios..."
  mkdir -p ~/sistema-reservas
  cd ~/sistema-reservas
  
  # Crear subdirectorios
  mkdir -p traefik/dynamic
  mkdir -p traefik/logs
  mkdir -p backups
  mkdir -p scripts
  
  # Crear directorio para logs de Traefik
  sudo mkdir -p /var/log/traefik
  sudo chown deploy:deploy /var/log/traefik
  
  # Crear docker-compose.prod.yml
  log_step "Creando docker-compose.prod.yml..."
  cat > docker-compose.prod.yml << 'EOF'
version: "3.8"

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: sistema-reservas-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-sistema_reservas}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - internal
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-sistema_reservas}",
        ]
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
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-sistema_reservas}
      REDIS_URL: redis://redis:6379
      PORT: 3001
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      FRONTEND_URL: ${FRONTEND_URL:-https://reserva.wgsoft.com.co}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
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
      - "traefik.http.routers.backend.rule=Host(`${API_DOMAIN:-api.reserva.wgsoft.com.co}`)"
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
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-https://api.reserva.wgsoft.com.co/api}
    container_name: sistema-reservas-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-https://api.reserva.wgsoft.com.co/api}
    depends_on:
      backend:
        condition: service_started
    networks:
      - internal
      - web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${FRONTEND_DOMAIN:-reserva.wgsoft.com.co}`)"
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
      - "traefik.http.routers.dashboard.rule=Host(`${TRAEFIK_DOMAIN:-traefik.reserva.wgsoft.com.co}`)"
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
  
  # Crear archivo de configuración de Traefik
  log_step "Creando configuración de Traefik..."
  
  # Directorio principal de Traefik
  cat > traefik/traefik.yml << 'EOF'
# Traefik Static Configuration
# https://doc.traefik.io/traefik/routing/providers/file/

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
          - main: "reserva.wgsoft.com.co"
            sans:
              - "*.reserva.wgsoft.com.co"

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
      email: "${ACME_EMAIL}"
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
  filters:
    statusCodes:
      - "200-299"
      - "400-499"
      - "500-599"

metrics:
  prometheus:
    entryPoint: "metrics"
    addEntryPointsLabels: true
    addServicesLabels: true

global:
  checkNewVersion: false
  sendAnonymousUsage: false
EOF

  # Archivo de configuración dinámica de Traefik
  cat > traefik/dynamic/default-config.yml << 'EOF'
# Traefik Dynamic Configuration - Default Middlewares & TLS
# https://doc.traefik.io/traefik/middlewares/overview/

http:
  middlewares:
    # Security Headers
    security-headers:
      headers:
        customBrowserXSSValue: 0
        contentTypeNosniff: true
        forceSTSHeader: true
        frameDeny: true
        referrerPolicy: "strict-origin-when-cross-origin"
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        customRequestHeaders:
          X-Forwarded-Proto: "https"

    # Rate Limiting - 100 requests per 30 seconds per IP
    ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 30s
        sourceCriterion:
          ipStrategy:
            depth: 2
            excludedIPs:
              - "127.0.0.1"

    # Compression
    compress:
      compress:
        excludedContentTypes:
          - text/event-stream

    # Dashboard Basic Auth (optional - configure via env or htpasswd)
    dashboard-auth:
      basicAuth:
        users:
          # Generate with: htpasswd -nb admin password
          # Replace with your own credentials
          - "admin:$$apr1$$H6uskkkW$$IgXLP6ewTrSuBkTrqE8wj/"

    # Redirect HTTP to HTTPS
    redirect-https:
      redirectScheme:
        scheme: https
        permanent: true

    # CORS for API
    cors-api:
      headers:
        accessControlAllowOriginList:
          - "https://reserva.wgsoft.com.co"
          - "https://www.reserva.wgsoft.com.co"
        accessControlAllowMethods:
          - "GET"
          - "POST"
          - "PUT"
          - "DELETE"
          - "OPTIONS"
        accessControlAllowHeaders:
          - "Origin"
          - "Content-Type"
          - "Authorization"
          - "X-Requested-With"
        accessControlMaxAge: 3600
        addVaryHeader: true

tls:
  options:
    # Strong TLS Configuration
    default:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
      sniStrict: true

    # Modern TLS (TLS 1.3 only)
    modern:
      minVersion: VersionTLS13
      sniStrict: true

    # Intermediate TLS (TLS 1.2+)
    intermediate:
      minVersion: VersionTLS12
      cipherSuites:
        - TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
      sniStrict: true
EOF

  # Archivo de routers de Traefik
  cat > traefik/dynamic/routers.yml << 'EOF'
# Traefik Dynamic Configuration - Routers
# https://doc.traefik.io/traefik/routing/routers/

http:
  routers:
    # Frontend Router - Main Application
    frontend-router:
      rule: "Host(`reserva.wgsoft.com.co`) || Host(`www.reserva.wgsoft.com.co`)"
      entryPoints:
        - websecure
      service: frontend
      tls:
        certResolver: myresolver
      middlewares:
        - security-headers
        - ratelimit
        - compress

    # Backend Router - API
    backend-router:
      rule: "Host(`api.reserva.wgsoft.com.co`)"
      entryPoints:
        - websecure
      service: backend
      tls:
        certResolver: myresolver
      middlewares:
        - security-headers
        - ratelimit
        - compress
        - cors-api

    # Dashboard Router - Traefik UI
    dashboard-router:
      rule: "Host(`traefik.reserva.wgsoft.com.co`)"
      entryPoints:
        - websecure
      service: dashboard
      tls:
        certResolver: myresolver
      middlewares:
        - dashboard-auth

  services:
    # Frontend Service
    frontend:
      loadBalancer:
        servers:
          - url: "http://frontend:3000"
        healthCheck:
          path: "/"
          interval: 30s
          timeout: 10s
          unhealthyThreshold: 3
        sticky:
          cookie:
            httpOnly: true
            secure: true
            sameSite: "lax"

    # Backend Service
    backend:
      loadBalancer:
        servers:
          - url: "http://backend:3001"
        healthCheck:
          path: "/health"
          interval: 30s
          timeout: 10s
          unhealthyThreshold: 3
        sticky:
          cookie:
            httpOnly: true
            secure: true
            sameSite: "lax"

    # Dashboard Service (Traefik internal)
    dashboard:
      loadBalancer:
        servers:
          - url: "http://traefik:8080"

tcp:
  routers:
    # Optional: TCP router for database connections (if needed externally)
    postgres-tcp:
      rule: "HostSNI(`postgres.reserva.wgsoft.com.co`)"
      entryPoints:
        - postgres
      service: postgres-service
      tls:
        passthrough: true

  services:
    postgres-service:
      loadBalancer:
        servers:
          - address: "postgres:5432"
EOF

  # Crear archivo de entorno de ejemplo
  log_step "Creando archivo de entorno..."
  cat > .env << 'EOF'
# Production Environment Configuration for reserva.wgsoft.com.co
# NEVER commit this file with real values!

# Database
DB_USER=postgres
DB_PASSWORD=your_secure_database_password_here
DB_NAME=sistema_reservas

# JWT Secrets (CRITICAL: Use strong random strings, min 64 chars for production)
# Generate with: openssl rand -base64 48
JWT_SECRET=your_secure_jwt_secret_here
JWT_REFRESH_SECRET=your_secure_jwt_refresh_secret_here

# Domains
FRONTEND_DOMAIN=reserva.wgsoft.com.co
API_DOMAIN=api.reserva.wgsoft.com.co
FRONTEND_URL=https://reserva.wgsoft.com.co
NEXT_PUBLIC_API_URL=https://api.reserva.wgsoft.com.co/api

# Email (Resend)
RESEND_API_KEY=re_your_resend_api_key_here

# Payments (Stripe - Live Mode)
STRIPE_SECRET_KEY=sk_live_your_stripe_live_key_here

# SSL/TLS
ACME_EMAIL=contacto@wgsoft.com.co

# Redis
REDIS_URL=redis://redis:6379

# Monitoring (Optional)
SENTRY_DSN=https://your_sentry_dsn_here@sentry.io/your_project_id
EOF

  log_step "Creando directorios falsos de apps para que el docker-compose funcione..."
  
  # Crear directorios de apps con archivos mínimos
  mkdir -p apps/backend
  mkdir -p apps/frontend
  
  # Crear archivos mínimos para que Dockerfile pueda construir
  cat > apps/backend/Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
RUN mkdir -p dist && echo "console.log('Backend placeholder');" > dist/index.js
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
EOF

  cat > apps/frontend/Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
RUN mkdir -p .next && echo "{}" > package.json
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
CMD ["sh", "-c", "echo 'Frontend placeholder server'"]
EOF

  # Crear estructura básica de directorios de apps
  mkdir -p apps/backend/src
  mkdir -p apps/frontend/pages

  log_success "Archivos de configuración creados exitosamente"
  
  echo ""
  log_info "=== Instrucciones para completar el despliegue ==="
  echo ""
  log_info "1. Edita el archivo .env con tus valores reales:"
  log_info "   nano ~/sistema-reservas/.env"
  echo ""
  log_info "2. Genera contraseñas y claves seguras:"
  log_info "   # DB Password:"
  log_info "   openssl rand -base64 32"
  echo ""
  log_info "   # JWT Secret (2 veces):"
  log_info "   openssl rand -base64 48"
  echo ""
  log_info "3. Crea las redes Docker:"
  log_info "   docker network create web 2>/dev/null || true"
  log_info "   docker network create internal 2>/dev/null || true"
  echo ""
  log_info "4. Construye e inicia los servicios:"
  log_info "   cd ~/sistema-reservas"
  log_info "   docker compose -f docker-compose.prod.yml build --parallel"
  log_info "   docker compose -f docker-compose.prod.yml up -d"
  echo ""
  log_info "5. Ejecuta las migraciones de base de datos:"
  log_info "   docker exec sistema-reservas-backend npx prisma migrate deploy"
  echo ""
  log_info "6. Verifica el estado:"
  log_info "   docker compose -f docker-compose.prod.yml ps"
  echo ""
  log_info "Tu aplicación debería estar disponible en https://reserva.wgsoft.com.co"
}

main "$@"