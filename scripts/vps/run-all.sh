#!/bin/bash
set -euo pipefail

# =============================================================================
# Script Run-All: Ejecuta todos los scripts de preparación VPS
# =============================================================================
# Ejecuta en orden: setup -> docker -> ufw -> fail2ban -> hardening SSH
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔧 $1${NC}"; }
log_phase() { echo -e "${MAGENTA}📌 $1${NC}"; }

# Variables
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKIP_SCRIPTS=()
START_FROM=""

# Scripts en orden
SCRIPTS=(
  "01-setup-vps.sh"
  "02-install-docker.sh"
  "03-config-ufw.sh"
  "04-config-fail2ban.sh"
  "05-harden-ssh.sh"
)

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --skip) SKIP_SCRIPTS+=("$2"); shift 2 ;;
    --start-from) START_FROM="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [opciones]"
      echo ""
      echo "Opciones:"
      echo "  --dry-run          Ejecutar en modo simulación"
      echo "  --skip <script>    Saltar un script específico"
      echo "  --start-from <n>   Comenzar desde el script N (1-5)"
      echo "  -h, --help         Mostrar esta ayuda"
      echo ""
      echo "Ejemplos:"
      echo "  $0 --dry-run"
      echo "  $0 --skip 03-config-ufw.sh"
      echo "  $0 --start-from 3"
      exit 0
      ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# =============================================================================
# Funciones
# =============================================================================

show_banner() {
  echo ""
  echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}║     FASE 1: PREPARACIÓN VPS - DEPLOY SISTEMA RESERVAS    ║${NC}"
  echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  log_info "Directorio: $SCRIPT_DIR"
  log_info "Dry-run: $DRY_RUN"
  log_info "Scripts a ejecutar: ${#SCRIPTS[@]}"
  
  if [ ${#SKIP_SCRIPTS[@]} -gt 0 ]; then
    log_warning "Scripts a saltar: ${SKIP_SCRIPTS[*]}"
  fi
  
  if [ -n "$START_FROM" ]; then
    log_info "Comenzando desde: Script $START_FROM"
  fi
  
  echo ""
}

check_prerequisites() {
  log_step "Verificando prerequisites..."
  
  # Check root
  if [ "$EUID" -ne 0 ]; then
    log_error "Este script requiere root (ejecutar con sudo)"
    exit 1
  fi
  
  # Check scripts exist
  for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
      log_error "Script no encontrado: $script"
      exit 1
    fi
    
    if [ ! -x "$SCRIPT_DIR/$script" ]; then
      log_warning "Script no ejecutable: $script (agregando permisos)"
      chmod +x "$SCRIPT_DIR/$script"
    fi
  done
  
  log_success "Prerequisites verificados"
  echo ""
}

should_run_script() {
  local script="$1"
  local script_num="${script:0:2}"
  
  # Check if skipped
  for skip in "${SKIP_SCRIPTS[@]}"; do
    if [[ "$script" == *"$skip"* ]]; then
      return 1
    fi
  done
  
  # Check start-from
  if [ -n "$START_FROM" ]; then
    if [ "${script_num#0}" -lt "$START_FROM" ]; then
      return 1
    fi
  fi
  
  return 0
}

run_script() {
  local script="$1"
  local phase="$2"
  
  log_phase "════════════════════════════════════════"
  log_phase "FASE $phase: $script"
  log_phase "════════════════════════════════════════"
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    log_warning "[DRY-RUN] Ejecutando: ./$script --dry-run"
    "$SCRIPT_DIR/$script" --dry-run
  else
    log_info "Ejecutando: ./$script"
    "$SCRIPT_DIR/$script"
  fi
  
  echo ""
  log_success "✅ FASE $phase COMPLETADA: $script"
  echo ""
  
  # Pausa entre scripts (excepto en dry-run)
  if [ "$DRY_RUN" = false ] && [ "$phase" -lt 5 ]; then
    log_info "Pausa de 3 segundos antes del siguiente script..."
    sleep 3
  fi
}

show_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║          FASE 1: PREPARACIÓN VPS COMPLETADA              ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  log_success "Todos los scripts se ejecutaron exitosamente"
  echo ""
  log_info "=== Resumen de cambios ==="
  echo "  ✅ Sistema actualizado y paquetes básicos instalados"
  echo "  ✅ Usuario no-root creado con permisos sudo"
  echo "  ✅ SSH keys configuradas"
  echo "  ✅ Docker Engine 24+ instalado"
  echo "  ✅ Docker Compose v2.20+ instalado"
  echo "  ✅ Firewall UFW configurado (puertos 22, 80, 443)"
  echo "  ✅ Fail2ban configurado (SSH + Traefik)"
  echo "  ✅ SSH hardened (sin root, sin password, ciphers fuertes)"
  echo ""
  log_info "=== Próximos pasos ==="
  echo "  1. Verificar que puede conectar con SSH (si cerró sesión)"
  echo "  2. Preparar configuración de DNS y dominio"
  echo "  3. Ejecutar Fase 2: Configuración de Traefik"
  echo ""
  log_info "=== Scripts disponibles ==="
  echo "  scripts/vps/01-setup-vps.sh"
  echo "  scripts/vps/02-install-docker.sh"
  echo "  scripts/vps/03-config-ufw.sh"
  echo "  scripts/vps/04-config-fail2ban.sh"
  echo "  scripts/vps/05-harden-ssh.sh"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

show_banner
check_prerequisites

phase=1
for script in "${SCRIPTS[@]}"; do
  if should_run_script "$script"; then
    run_script "$script" "$phase"
  else
    log_warning "⊗ Saltando: $script"
  fi
  ((phase++))
done

show_summary
