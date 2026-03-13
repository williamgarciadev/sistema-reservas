#!/bin/bash
set -euo pipefail

# =============================================================================
# Script 01: Setup Inicial de VPS
# =============================================================================
# Actualiza sistema, instala paquetes básicos, crea usuario no-root y configura SSH
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
NEW_USER="${SUDO_USER:-deploy}"
SSH_KEY_URL="${SSH_KEY_URL:-}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --user) NEW_USER="$2"; shift 2 ;;
    --ssh-key) SSH_KEY_URL="$2"; shift 2 ;;
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

update_system() {
  log_step "Actualizando lista de paquetes..."
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] apt update"
    log_info "[DRY-RUN] apt upgrade -y"
  else
    apt update -qq
    DEBIAN_FRONTEND=noninteractive apt upgrade -y -qq
    log_success "Sistema actualizado"
  fi
}

install_packages() {
  local packages=("curl" "wget" "git" "htop" "ufw" "fail2ban" "software-properties-common" "apt-transport-https" "ca-certificates" "gnupg")
  log_step "Instalando paquetes básicos: ${packages[*]}"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] apt install -y ${packages[*]}"
  else
    DEBIAN_FRONTEND=noninteractive apt install -y -qq "${packages[@]}"
    log_success "Paquetes instalados"
  fi
}

create_user() {
  log_step "Creando usuario: $NEW_USER"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] useradd -m -s /bin/bash $NEW_USER"
    log_info "[DRY-RUN] usermod -aG sudo $NEW_USER"
    return
  fi
  
  if id "$NEW_USER" &>/dev/null; then
    log_warning "El usuario $NEW_USER ya existe"
  else
    useradd -m -s /bin/bash "$NEW_USER"
    usermod -aG sudo "$NEW_USER"
    log_success "Usuario $NEW_USER creado con permisos sudo"
  fi
}

setup_ssh_keys() {
  local user_home="/home/$NEW_USER"
  local ssh_dir="$user_home/.ssh"
  local authorized_keys="$ssh_dir/authorized_keys"
  
  log_step "Configurando SSH keys para $NEW_USER"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] mkdir -p $ssh_dir"
    if [ -n "$SSH_KEY_URL" ]; then
      log_info "[DRY-RUN] curl $SSH_KEY_URL >> $authorized_keys"
    else
      log_warning "[DRY-RUN] SSH_KEY_URL no proporcionada - keys no instaladas"
    fi
    log_info "[DRY-RUN] chown -R $NEW_USER:$NEW_USER $ssh_dir"
    log_info "[DRY-RUN] chmod 700 $ssh_dir && chmod 600 $authorized_keys"
    return
  fi
  
  mkdir -p "$ssh_dir"
  
  if [ -n "$SSH_KEY_URL" ]; then
    curl -fsSL "$SSH_KEY_URL" >> "$authorized_keys"
    log_success "SSH key descargada desde $SSH_KEY_URL"
  else
    log_warning "SSH_KEY_URL no proporcionada. Agregue keys manualmente o use --ssh-key <url>"
    touch "$authorized_keys"
  fi
  
  chown -R "$NEW_USER:$NEW_USER" "$ssh_dir"
  chmod 700 "$ssh_dir"
  chmod 600 "$authorized_keys"
  log_success "SSH keys configuradas para $NEW_USER"
}

verify_setup() {
  log_step "Verificando configuración..."
  
  local errors=0
  
  # Check packages
  for pkg in curl wget git htop; do
    if ! command -v "$pkg" &>/dev/null; then
      log_error "Paquete $pkg no instalado"
      ((errors++))
    fi
  done
  
  # Check user
  if ! id "$NEW_USER" &>/dev/null; then
    log_error "Usuario $NEW_USER no existe"
    ((errors++))
  fi
  
  # Check sudo group
  if ! groups "$NEW_USER" | grep -q sudo; then
    log_error "Usuario $NEW_USER no está en grupo sudo"
    ((errors++))
  fi
  
  if [ $errors -eq 0 ]; then
    log_success "Verificación completada sin errores"
  else
    log_error "Verificación falló con $errors errores"
    return 1
  fi
}

show_next_steps() {
  echo ""
  log_info "=== Próximos pasos ==="
  echo "1. Agregar su SSH key manualmente si no usó --ssh-key:"
  echo "   echo 'ssh-rsa AAAA...' >> /home/$NEW_USER/.ssh/authorized_keys"
  echo ""
  echo "2. Probar login con el nuevo usuario:"
  echo "   ssh $NEW_USER@<tu-vps-ip>"
  echo ""
  echo "3. Ejecutar siguiente script:"
  echo "   sudo ./02-install-docker.sh"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

log_info "=== Setup Inicial de VPS ==="
log_info "Usuario: $NEW_USER"
log_info "Dry-run: $DRY_RUN"
echo ""

update_system
install_packages
create_user
setup_ssh_keys
verify_setup

log_success "Setup inicial completado exitosamente"
show_next_steps
