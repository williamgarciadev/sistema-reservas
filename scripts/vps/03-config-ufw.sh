#!/bin/bash
set -euo pipefail

# =============================================================================
# Script 03: Configuración Firewall UFW
# =============================================================================
# Configura reglas de firewall para puertos 22, 80, 443
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
SSH_PORT="${SSH_PORT:-22}"
ALLOWED_PORTS=("22" "80" "443")

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    --add-port) ALLOWED_PORTS+=("$2"); shift 2 ;;
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

check_ufw_installed() {
  log_step "Verificando instalación de UFW..."
  
  if ! command -v ufw &>/dev/null; then
    log_error "UFW no está instalado. Ejecute primero 01-setup-vps.sh"
    exit 1
  fi
  
  log_success "UFW instalado"
}

reset_ufw() {
  log_step "Reseteando configuración UFW existente..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw --force reset"
    return
  fi
  
  ufw --force reset
  log_success "UFW reseteado"
}

set_default_policies() {
  log_step "Configurando políticas por defecto..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw default deny incoming"
    log_info "[DRY-RUN] ufw default allow outgoing"
    return
  fi
  
  ufw default deny incoming
  ufw default allow outgoing
  
  log_success "Políticas configuradas: DENY incoming, ALLOW outgoing"
}

allow_ssh() {
  log_step "Permitiendo puerto SSH ($SSH_PORT)..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw allow $SSH_PORT/tcp comment 'SSH'"
    return
  fi
  
  ufw allow "$SSH_PORT/tcp" comment 'SSH'
  log_success "Puerto $SSH_PORT permitido"
}

allow_web_ports() {
  log_step "Permitiendo puertos web (80, 443)..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw allow 80/tcp comment 'HTTP'"
    log_info "[DRY-RUN] ufw allow 443/tcp comment 'HTTPS'"
    return
  fi
  
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  
  log_success "Puertos 80 y 443 permitidos"
}

allow_additional_ports() {
  local additional=("${ALLOWED_PORTS[@]}")
  
  # Remove default ports
  additional=("${additional[@]/22/}")
  additional=("${additional[@]/80/}")
  additional=("${additional[@]/443/}")
  
  if [ ${#additional[@]} -eq 0 ]; then
    return
  fi
  
  log_step "Permitiendo puertos adicionales: ${additional[*]}"
  
  if [ "$DRY_RUN" = true ]; then
    for port in "${additional[@]}"; do
      [ -n "$port" ] && log_info "[DRY-RUN] ufw allow $port/tcp"
    done
    return
  fi
  
  for port in "${additional[@]}"; do
    if [ -n "$port" ]; then
      ufw allow "$port/tcp"
      log_success "Puerto $port permitido"
    fi
  done
}

enable_ufw() {
  log_step "Habilitando UFW..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw --force enable"
    return
  fi
  
  echo "y" | ufw enable
  log_success "UFW habilitado"
}

verify_ufw() {
  log_step "Verificando configuración de UFW..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ufw status verbose"
    return
  fi
  
  echo ""
  log_info "=== Estado del Firewall ==="
  ufw status verbose
  
  echo ""
  log_info "=== Reglas activas ==="
  ufw status numbered
  
  log_success "Verificación completada"
}

test_firewall() {
  log_warning "IMPORTANTE: No cierre su sesión SSH actual hasta verificar conectividad"
  echo ""
  log_info "Para probar la conectividad:"
  echo "1. Abra una NUEVA terminal"
  echo "2. Conéctese: ssh -p $SSH_PORT <usuario>@<tu-vps-ip>"
  echo "3. Si funciona, puede cerrar la sesión actual"
  echo ""
  
  if [ "$DRY_RUN" = false ]; then
    read -p "¿Verificó que puede conectar en una nueva sesión? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_error "Verificación fallida. NO cierre su sesión actual."
      log_warning "Para deshabilitar UFW en caso de emergencia: ufw disable"
      return 1
    fi
  fi
  
  log_success "Firewall verificado correctamente"
}

show_next_steps() {
  echo ""
  log_info "=== Próximos pasos ==="
  echo "1. Verificar reglas del firewall:"
  echo "   sudo ufw status verbose"
  echo ""
  echo "2. Agregar puertos adicionales si es necesario:"
  echo "   sudo ufw allow <puerto>/tcp"
  echo ""
  echo "3. Ejecutar siguiente script:"
  echo "   sudo ./04-config-fail2ban.sh"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

log_info "=== Configuración Firewall UFW ==="
log_info "Puerto SSH: $SSH_PORT"
log_info "Puertos permitidos: ${ALLOWED_PORTS[*]}"
log_info "Dry-run: $DRY_RUN"
echo ""

check_ufw_installed
reset_ufw
set_default_policies
allow_ssh
allow_web_ports
allow_additional_ports
enable_ufw
verify_ufw
test_firewall

log_success "Configuración de UFW completada exitosamente"
show_next_steps
