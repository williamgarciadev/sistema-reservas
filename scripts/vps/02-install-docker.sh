#!/bin/bash
set -euo pipefail

# =============================================================================
# Script 02: Instalación Docker Engine
# =============================================================================
# Instala Docker Engine 24+ y Docker Compose v2.20+
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔧 $1${NC}"; }

# Variables
DRY_RUN=false
DOCKER_USER="${SUDO_USER:-deploy}"
DOCKER_VERSION="24.0"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --user) DOCKER_USER="$2"; shift 2 ;;
    --version) DOCKER_VERSION="$2"; shift 2 ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# Check root
if [ "$EUID" -ne 0 ]; then
  log_error "Este script requiere root (ejecutar con sudo)"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  log_warning "MODO DRY-RUN: No se realizarán cambios reales"
fi

# =============================================================================
# Funciones
# =============================================================================

check_existing_docker() {
  log_step "Verificando instalación existente de Docker..."
  
  if command -v docker &>/dev/null; then
    local version=$(docker --version 2>/dev/null || echo "desconocida")
    log_warning "Docker ya está instalado: $version"
    
    if [ "$DRY_RUN" = false ]; then
      read -p "¿Continuar con la instalación? (y/N): " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Instalación cancelada"
        exit 0
      fi
    fi
  fi
}

remove_old_docker() {
  log_step "Eliminando versiones antiguas de Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] apt remove -y docker docker-engine docker.io containerd runc"
    return
  fi
  
  apt remove -y -qq docker docker-engine docker.io containerd runc 2>/dev/null || true
  log_success "Versiones antiguas eliminadas"
}

setup_docker_repo() {
  log_step "Configurando repositorio de Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] mkdir -p /etc/apt/keyrings"
    log_info "[DRY-RUN] curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
    log_info "[DRY-RUN] echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable' | tee /etc/apt/sources.list.d/docker.list"
    return
  fi
  
  mkdir -p /etc/apt/keyrings
  
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  
  apt update -qq
  log_success "Repositorio de Docker configurado"
}

install_docker_engine() {
  log_step "Instalando Docker Engine..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    return
  fi
  
  DEBIAN_FRONTEND=noninteractive apt install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
  
  log_success "Docker Engine instalado"
}

add_user_to_docker_group() {
  log_step "Agregando usuario $DOCKER_USER al grupo docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] usermod -aG docker $DOCKER_USER"
    log_info "[DRY-RUN] newgrp docker"
    return
  fi
  
  if ! id "$DOCKER_USER" &>/dev/null; then
    log_error "Usuario $DOCKER_USER no existe. Cree el usuario primero con 01-setup-vps.sh"
    exit 1
  fi
  
  usermod -aG docker "$DOCKER_USER"
  log_success "Usuario $DOCKER_USER agregado al grupo docker"
  log_warning "El usuario debe cerrar sesión y volver a entrar para aplicar cambios"
}

enable_docker_service() {
  log_step "Habilitando servicio Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] systemctl enable docker"
    log_info "[DRY-RUN] systemctl start docker"
    return
  fi
  
  systemctl enable docker
  systemctl start docker
  systemctl status docker --no-pager -n 5
  
  log_success "Servicio Docker habilitado y en ejecución"
}

verify_docker() {
  log_step "Verificando instalación de Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker --version"
    log_info "[DRY-RUN] docker compose version"
    return
  fi
  
  local docker_version=$(docker --version)
  local compose_version=$(docker compose version)
  
  echo ""
  log_success "$docker_version"
  log_success "$compose_version"
  
  # Verify minimum versions
  if ! echo "$docker_version" | grep -q "2[4-9]\."; then
    log_warning "Versión de Docker menor a 24.x recomendada"
  fi
  
  log_success "Verificación completada"
}

test_docker() {
  log_step "Ejecutando prueba de Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker run --rm hello-world"
    return
  fi
  
  if docker run --rm hello-world &>/dev/null; then
    log_success "Prueba de Docker exitosa"
  else
    log_error "Prueba de Docker fallida"
    return 1
  fi
}

show_next_steps() {
  echo ""
  log_info "=== Próximos pasos ==="
  echo "1. Cerrar sesión y volver a entrar para aplicar permisos de grupo docker:"
  echo "   exit"
  echo "   ssh $DOCKER_USER@<tu-vps-ip>"
  echo ""
  echo "2. Verificar que docker funciona sin sudo:"
  echo "   docker --version"
  echo "   docker compose version"
  echo ""
  echo "3. Ejecutar siguiente script:"
  echo "   sudo ./03-config-ufw.sh"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

log_info "=== Instalación Docker Engine ==="
log_info "Usuario: $DOCKER_USER"
log_info "Dry-run: $DRY_RUN"
echo ""

check_existing_docker
remove_old_docker
setup_docker_repo
install_docker_engine
add_user_to_docker_group
enable_docker_service
verify_docker
test_docker

log_success "Instalación de Docker completada exitosamente"
show_next_steps
