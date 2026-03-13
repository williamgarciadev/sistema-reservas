#!/bin/bash
set -euo pipefail

# =============================================================================
# Script 04: Configuración Fail2Ban
# =============================================================================
# Instala y configura fail2ban para proteger SSH y Traefik
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
BAN_TIME="${BAN_TIME:-3600}"
FIND_TIME="${FIND_TIME:-600}"
MAX_RETRY="${MAX_RETRY:-5}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    --ban-time) BAN_TIME="$2"; shift 2 ;;
    --find-time) FIND_TIME="$2"; shift 2 ;;
    --max-retry) MAX_RETRY="$2"; shift 2 ;;
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

install_fail2ban() {
  log_step "Verificando instalación de fail2ban..."
  
  if command -v fail2ban-server &>/dev/null; then
    local version=$(fail2ban-server --version 2>/dev/null || echo "desconocida")
    log_warning "fail2ban ya está instalado: $version"
  else
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] apt install -y fail2ban"
    else
      DEBIAN_FRONTEND=noninteractive apt install -y -qq fail2ban
      log_success "fail2ban instalado"
    fi
  fi
}

backup_default_config() {
  log_step "Respalando configuración por defecto..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.conf.backup"
    return
  fi
  
  if [ ! -f /etc/fail2ban/jail.conf.backup ]; then
    cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.conf.backup
    log_success "Configuración respaldada en jail.conf.backup"
  else
    log_warning "Backup ya existe"
  fi
}

create_ssh_jail() {
  log_step "Configurando jail para SSH..."
  
  local jail_file="/etc/fail2ban/jail.d/sshd.local"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Creando $jail_file"
    cat << EOF
[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = $MAX_RETRY
findtime = $FIND_TIME
bantime = $BAN_TIME
action = iptables-multiport[name=SSH, port="$SSH_PORT", protocol=tcp]
EOF
    return
  fi
  
  cat > "$jail_file" << EOF
[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = $MAX_RETRY
findtime = $FIND_TIME
bantime = $BAN_TIME
action = iptables-multiport[name=SSH, port="$SSH_PORT", protocol=tcp]
EOF
  
  log_success "Jail SSH configurado en $jail_file"
}

create_traefik_jail() {
  log_step "Configurando jail para Traefik..."
  
  local jail_file="/etc/fail2ban/jail.d/traefik.local"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Creando $jail_file"
    cat << EOF
[traefik-auth]
enabled = true
port = http,https
filter = traefik-auth
logpath = /var/log/traefik/*.log
maxretry = $MAX_RETRY
findtime = $FIND_TIME
bantime = $BAN_TIME

[traefik-botsearch]
enabled = true
port = http,https
filter = traefik-botsearch
logpath = /var/log/traefik/*.log
maxretry = 2
findtime = $FIND_TIME
bantime = $BAN_TIME
EOF
    return
  fi
  
  cat > "$jail_file" << EOF
[traefik-auth]
enabled = true
port = http,https
filter = traefik-auth
logpath = /var/log/traefik/*.log
maxretry = $MAX_RETRY
findtime = $FIND_TIME
bantime = $BAN_TIME

[traefik-botsearch]
enabled = true
port = http,https
filter = traefik-botsearch
logpath = /var/log/traefik/*.log
maxretry = 2
findtime = $FIND_TIME
bantime = $BAN_TIME
EOF
  
  log_success "Jail Traefik configurado en $jail_file"
}

create_traefik_filters() {
  log_step "Creando filtros para Traefik..."
  
  local auth_filter="/etc/fail2ban/filter.d/traefik-auth.conf"
  local bot_filter="/etc/fail2ban/filter.d/traefik-botsearch.conf"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] Creando filtro $auth_filter"
    log_info "[DRY-RUN] Creando filtro $bot_filter"
    return
  fi
  
  cat > "$auth_filter" << 'EOF'
[Definition]
failregex = ^<HOST> -.*"GET \/.*HTTP\/.*" 401 .*
ignoreregex =
EOF
  
  cat > "$bot_filter" << 'EOF'
[Definition]
failregex = ^<HOST> -.*"(GET|POST|HEAD) \/.*HTTP\/.*" (400|403|404|429) .*
ignoreregex =
EOF
  
  log_success "Filtros Traefik creados"
}

start_fail2ban() {
  log_step "Iniciando servicio fail2ban..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] systemctl enable fail2ban"
    log_info "[DRY-RUN] systemctl start fail2ban"
    return
  fi
  
  systemctl enable fail2ban
  systemctl start fail2ban
  
  log_success "Servicio fail2ban iniciado"
}

verify_fail2ban() {
  log_step "Verificando estado de fail2ban..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] fail2ban-client status"
    log_info "[DRY-RUN] fail2ban-client status sshd"
    return
  fi
  
  echo ""
  log_info "=== Estado general ==="
  fail2ban-client status
  
  echo ""
  log_info "=== Estado SSH jail ==="
  fail2ban-client status sshd 2>/dev/null || log_warning "Jail sshd no activo aún"
  
  echo ""
  log_info "=== Estado Traefik jails ==="
  fail2ban-client status traefik-auth 2>/dev/null || log_warning "Jail traefik-auth no activo (esperando logs)"
  fail2ban-client status traefik-botsearch 2>/dev/null || log_warning "Jail traefik-botsearch no activo (esperando logs)"
  
  log_success "Verificación completada"
}

show_jail_status() {
  log_step "Mostrando estado de jails..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] fail2ban-client status"
    return
  fi
  
  echo ""
  log_info "=== Jails disponibles ==="
  fail2ban-client status | grep "Jail list" || true
  
  echo ""
  log_info "=== IPs baneadas actualmente ==="
  fail2ban-client get sshd banned 2>/dev/null || echo "No hay IPs baneadas en sshd"
}

show_next_steps() {
  echo ""
  log_info "=== Próximos pasos ==="
  echo "1. Verificar estado de fail2ban:"
  echo "   sudo fail2ban-client status"
  echo ""
  echo "2. Ver jails activos:"
  echo "   sudo fail2ban-client status sshd"
  echo ""
  echo "3. Ver IPs baneadas:"
  echo "   sudo fail2ban-client get sshd banned"
  echo ""
  echo "4. Desbanear una IP:"
  echo "   sudo fail2ban-client set sshd unbanip <IP>"
  echo ""
  echo "5. Ver logs de fail2ban:"
  echo "   sudo tail -f /var/log/fail2ban.log"
  echo ""
  echo "6. Ejecutar siguiente script:"
  echo "   sudo ./05-harden-ssh.sh"
  echo ""
}

# =============================================================================
# Main
# =============================================================================

log_info "=== Configuración Fail2Ban ==="
log_info "Puerto SSH: $SSH_PORT"
log_info "Ban time: ${BAN_TIME}s"
log_info "Find time: ${FIND_TIME}s"
log_info "Max retry: $MAX_RETRY"
log_info "Dry-run: $DRY_RUN"
echo ""

install_fail2ban
backup_default_config
create_ssh_jail
create_traefik_jail
create_traefik_filters
start_fail2ban
verify_fail2ban
show_jail_status

log_success "Configuración de fail2ban completada exitosamente"
show_next_steps
