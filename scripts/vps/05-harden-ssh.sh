#!/bin/bash
set -euo pipefail

# =============================================================================
# Script 05: Hardening SSH
# =============================================================================
# Aplica configuración de seguridad avanzada para SSH
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
SSH_CONFIG="/etc/ssh/sshd_config"
BACKUP_CONFIG="/etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    --skip-restart) SKIP_RESTART=true; shift ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
done

SKIP_RESTART="${SKIP_RESTART:-false}"

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

check_ssh_installed() {
  log_step "Verificando instalación de SSH..."
  
  if ! command -v sshd &>/dev/null; then
    log_error "SSH server no está instalado"
    exit 1
  fi
  
  log_success "SSH server instalado"
}

backup_ssh_config() {
  log_step "Respalando configuración SSH..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] cp $SSH_CONFIG $BACKUP_CONFIG"
    return
  fi
  
  cp "$SSH_CONFIG" "$BACKUP_CONFIG"
  log_success "Configuración respaldada en $BACKUP_CONFIG"
}

harden_ssh_config() {
  log_step "Aplicando hardening a configuración SSH..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Modificando $SSH_CONFIG"
    return
  fi
  
  # Crear configuración segura
  cat > /tmp/sshd_hardening.conf << 'EOF'
# =============================================================================
# Hardening SSH - Configuración de Seguridad
# =============================================================================

# --- Autenticación ---
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
ChallengeResponseAuthentication no
UsePAM no

# --- Ciphers y algoritmos fuertes ---
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group14-sha256
HostKeyAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com,rsa-sha2-512,rsa-sha2-256

# --- Configuración de sesión ---
PermitEmptyPasswords no
MaxAuthTries 3
MaxSessions 10
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 2

# --- Restricciones de usuario ---
AllowAgentForwarding no
AllowTcpForwarding no
X11Forwarding no
PrintMotd no
PrintLastLog yes
TCPKeepAlive yes
Compression no
UseDNS no

# --- Banner ---
Banner /etc/ssh/banner

# --- Logging ---
LogLevel VERBOSE
SyslogFacility AUTH
EOF

  # Aplicar configuración
  cat /tmp/sshd_hardening.conf >> "$SSH_CONFIG"
  rm /tmp/sshd_hardening.conf
  
  log_success "Configuración de hardening aplicada"
}

create_ssh_banner() {
  log_step "Creando banner de advertencia..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Creando /etc/ssh/banner"
    return
  fi
  
  cat > /etc/ssh/banner << 'EOF'
***************************************************************************
                            ADVERTENCIA
***************************************************************************

Este sistema está reservado únicamente para usuarios autorizados.
Todo el acceso y actividad está monitoreado y registrado.

El acceso no autorizado está prohibido y será perseguido legalmente.

Al continuar, usted acepta que su actividad será monitoreada.

***************************************************************************
EOF
  
  log_success "Banner de advertencia creado"
}

validate_ssh_config() {
  log_step "Validando configuración SSH..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] sshd -t"
    return
  fi
  
  if sshd -t 2>&1; then
    log_success "Configuración SSH válida"
  else
    log_error "Configuración SSH inválida"
    log_warning "Restaurando backup..."
    cp "$BACKUP_CONFIG" "$SSH_CONFIG"
    log_success "Configuración restaurada"
    exit 1
  fi
}

restart_ssh() {
  if [ "$SKIP_RESTART" = true ]; then
    log_warning "Skip-restart activado - SSH no será reiniciado"
    return
  fi
  
  log_step "Reiniciando servicio SSH..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] systemctl restart sshd"
    return
  fi
  
  # WARNING CRÍTICO
  echo ""
  log_warning "============================================================"
  log_warning "¡ATENCIÓN! Se reiniciará SSH con las siguientes restricciones:"
  log_warning "  - Root login DESHABILITADO"
  log_warning "  - Password authentication DESHABILITADO"
  log_warning "  - Solo SSH keys permitidas"
  log_warning "============================================================"
  echo ""
  log_info "ASEGÚRESE DE:"
  echo "  1. Tener su SSH key configurada en el usuario"
  echo "  2. NO cerrar la sesión actual hasta verificar nueva conexión"
  echo "  3. Probar en una NUEVA terminal: ssh -p $SSH_PORT <usuario>@<vps-ip>"
  echo ""
  
  read -p "¿Está seguro de continuar? (escriba 'YES' para confirmar): " confirm
  if [ "$confirm" != "YES" ]; then
    log_error "Operación cancelada por el usuario"
    exit 1
  fi
  
  systemctl restart sshd
  log_success "Servicio SSH reiniciado"
}

verify_ssh_status() {
  log_step "Verificando estado de SSH..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] systemctl status sshd"
    return
  fi
  
  systemctl status sshd --no-pager -n 10
  
  log_success "Servicio SSH activo"
}

test_ssh_security() {
  log_step "Verificando configuración de seguridad..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Verificando configuración aplicada"
    return
  fi
  
  local errors=0
  
  # Check PermitRootLogin
  if grep -q "^PermitRootLogin no" "$SSH_CONFIG"; then
    log_success "PermitRootLogin: no"
  else
    log_error "PermitRootLogin no está configurado correctamente"
    ((errors++))
  fi
  
  # Check PasswordAuthentication
  if grep -q "^PasswordAuthentication no" "$SSH_CONFIG"; then
    log_success "PasswordAuthentication: no"
  else
    log_error "PasswordAuthentication no está configurado correctamente"
    ((errors++))
  fi
  
  # Check PubkeyAuthentication
  if grep -q "^PubkeyAuthentication yes" "$SSH_CONFIG"; then
    log_success "PubkeyAuthentication: yes"
  else
    log_error "PubkeyAuthentication no está configurado correctamente"
    ((errors++))
  fi
  
  if [ $errors -eq 0 ]; then
    log_success "Todas las verificaciones de seguridad pasaron"
  else
    log_error "$errors verificaciones fallaron"
    return 1
  fi
}

show_next_steps() {
  echo ""
  log_info "=== Próximos pasos ==="
  echo "1. NO CIERRE esta sesión SSH hasta verificar nueva conexión"
  echo ""
  echo "2. Abra una NUEVA terminal y pruebe:"
  echo "   ssh -p $SSH_PORT <usuario>@<tu-vps-ip>"
  echo ""
  echo "3. Si funciona, puede cerrar sesiones anteriores"
  echo ""
  echo "4. Verificar logs de SSH:"
  echo "   sudo tail -f /var/log/auth.log"
  echo ""
  echo "5. Para restaurar configuración en caso de emergencia:"
  echo "   sudo cp $BACKUP_CONFIG $SSH_CONFIG"
  echo "   sudo systemctl restart sshd"
  echo ""
  log_success "=== Fase 1: Preparación VPS COMPLETADA ==="
  echo ""
  echo "Todos los scripts de la Fase 1 han sido ejecutados:"
  echo "  ✅ 01-setup-vps.sh - Setup inicial"
  echo "  ✅ 02-install-docker.sh - Docker instalado"
  echo "  ✅ 03-config-ufw.sh - Firewall configurado"
  echo "  ✅ 04-config-fail2ban.sh - Fail2ban configurado"
  echo "  ✅ 05-harden-ssh.sh - SSH hardened"
  echo ""
  echo "Próximo: Fase 2 - Configuración de Traefik y DNS"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

log_info "=== Hardening SSH ==="
log_info "Puerto SSH: $SSH_PORT"
log_info "Config: $SSH_CONFIG"
log_info "Backup: $BACKUP_CONFIG"
log_info "Dry-run: $DRY_RUN"
echo ""

check_ssh_installed
backup_ssh_config
harden_ssh_config
create_ssh_banner
validate_ssh_config

if [ "$DRY_RUN" = false ]; then
  restart_ssh
  verify_ssh_status
  test_ssh_security
fi

log_success "Hardening SSH completado exitosamente"
show_next_steps
