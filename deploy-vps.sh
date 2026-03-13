#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Deploy to VPS
# =============================================================================
# Script para desplegar el sistema de reservas en una VPS
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

# Variables por defecto
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-deploy}"
VPS_PORT="${VPS_PORT:-22}"
VPS_KEY="${VPS_KEY:-~/.ssh/id_rsa}"
DOMAIN="${DOMAIN:-reserva.wgsoft.com.co}"
API_DOMAIN="${API_DOMAIN:-api.reserva.wgsoft.com.co}"
TRAEFIK_DOMAIN="${TRAEFIK_DOMAIN:-traefik.reserva.wgsoft.com.co}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vps-host)
      VPS_HOST="$2"
      shift 2
      ;;
    --vps-user)
      VPS_USER="$2"
      shift 2
      ;;
    --vps-port)
      VPS_PORT="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --vps-host <host>     Host de la VPS (requerido)"
      echo "  --vps-user <user>     Usuario de la VPS (default: deploy)"
      echo "  --vps-port <port>     Puerto SSH de la VPS (default: 22)"
      echo "  --domain <domain>     Dominio principal (default: reserva.wgsoft.com.co)"
      echo "  -h, --help            Mostrar esta ayuda"
      exit 0
      ;;
    *)
      log_error "Opción desconocida: $1"
      exit 1
      ;;
  esac
done

# Validación de parámetros requeridos
if [ -z "$VPS_HOST" ]; then
  log_error "VPS_HOST es requerido. Usa --vps-host para especificarlo."
  exit 1
fi

# =============================================================================
# Funciones principales
# =============================================================================

prepare_local_files() {
  log_step "Preparando archivos locales para despliegue..."
  
  # Asegurarse de que el directorio de destino existe
  mkdir -p ./temp-deploy
  
  # Copiar archivos necesarios
  cp -r apps ./temp-deploy/
  cp -r traefik ./temp-deploy/
  cp -r scripts ./temp-deploy/
  cp docker-compose.prod.yml ./temp-deploy/
  cp .env.production ./temp-deploy/
  
  # Ajustar el archivo .env con el dominio correcto
  sed -i "s/reserva.wgsoft.com.co/$DOMAIN/g" ./temp-deploy/.env.production
  sed -i "s/api.reserva.wgsoft.com.co/$API_DOMAIN/g" ./temp-deploy/.env.production
  sed -i "s/traefik.reserva.wgsoft.com.co/traefik.$DOMAIN/g" ./temp-deploy/.env.production
  
  log_success "Archivos preparados en ./temp-deploy/"
}

transfer_to_vps() {
  log_step "Transfiriendo archivos a la VPS..."
  
  # Crear directorio en la VPS si no existe
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "mkdir -p ~/sistema-reservas"
  
  # Transferir archivos
  rsync -avz --exclude 'node_modules' --exclude '.git' ./temp-deploy/ "$VPS_USER@$VPS_HOST:~/sistema-reservas/"
  
  log_success "Archivos transferidos a la VPS"
}

setup_vps_environment() {
  log_step "Configurando entorno en la VPS..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << EOF
    set -e
    
    cd ~/sistema-reservas
    
    # Crear redes Docker si no existen
    docker network create web 2>/dev/null || true
    docker network create internal 2>/dev/null || true
    
    # Crear directorio de backups
    mkdir -p backups
    
    # Si es la primera vez, crear el archivo .env con valores reales
    if [ ! -f ".env.secure" ]; then
      echo "Por favor, configura las variables de entorno seguras:"
      echo "DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, etc."
      echo "en el archivo .env.secure en la VPS"
      exit 1
    fi
    
    # Combinar .env.production con .env.secure
    cp .env.production .env
    cat .env.secure >> .env
    
    echo "Entorno configurado en la VPS"
EOF
  
  log_success "Entorno configurado en la VPS"
}

build_and_deploy() {
  log_step "Construyendo e iniciando servicios..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << EOF
    set -e
    
    cd ~/sistema-reservas
    
    # Construir imágenes locales
    docker compose -f docker-compose.prod.yml build --parallel
    
    # Iniciar servicios
    docker compose -f docker-compose.prod.yml up -d
    
    echo "Esperando 30 segundos para que los servicios se inicien..."
    sleep 30
    
    # Verificar estado de los contenedores
    docker compose -f docker-compose.prod.yml ps
EOF
  
  log_success "Servicios iniciados en la VPS"
}

run_migrations() {
  log_step "Ejecutando migraciones de base de datos..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << EOF
    set -e
    
    cd ~/sistema-reservas
    
    # Ejecutar migraciones de Prisma
    docker exec sistema-reservas-backend npx prisma migrate deploy || echo "No se encontraron migraciones nuevas"
    
    echo "Migraciones completadas"
EOF
  
  log_success "Migraciones ejecutadas"
}

verify_deployment() {
  log_step "Verificando despliegue..."
  
  # Verificar que los contenedores están corriendo
  CONTAINER_STATUS=$(ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep sistema-reservas")
  
  echo "$CONTAINER_STATUS"
  
  # Esperar unos segundos y verificar el frontend
  sleep 10
  
  # Verificar health check del backend
  if curl -f -s --max-time 30 "https://$API_DOMAIN/health" >/dev/null 2>&1; then
    log_success "Backend accesible y saludable: https://$API_DOMAIN/health"
  else
    log_warning "Backend no responde o no está saludable"
  fi
  
  # Verificar frontend
  if curl -f -s --max-time 30 "https://$DOMAIN/" >/dev/null 2>&1; then
    log_success "Frontend accesible: https://$DOMAIN/"
  else
    log_warning "Frontend no responde"
  fi
}

cleanup() {
  log_step "Limpiando archivos temporales..."
  
  rm -rf ./temp-deploy/
  
  log_success "Despliegue completado!"
  log_info "Dominio: https://$DOMAIN"
  log_info "API: https://$API_DOMAIN"
  log_info "Dashboard Traefik: https://traefik.$DOMAIN (si está habilitado)"
}

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=== Iniciando despliegue en VPS ==="
  log_info "VPS: $VPS_USER@$VPS_HOST:$VPS_PORT"
  log_info "Dominio: $DOMAIN"
  log_info "Fecha: $(date)"
  
  prepare_local_files
  transfer_to_vps
  setup_vps_environment
  build_and_deploy
  run_migrations
  verify_deployment
  cleanup
  
  log_success "🎉 ¡Despliegue completado exitosamente!"
  log_info "Visita tu aplicación en: https://$DOMAIN"
}

main "$@"