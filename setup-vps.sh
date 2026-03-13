#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Setup VPS
# =============================================================================
# Script para configurar una VPS nueva para alojar el sistema de reservas
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
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
VPS_KEY="${VPS_KEY:-~/.ssh/id_rsa}"

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
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --vps-host <host>     Host de la VPS (requerido)"
      echo "  --vps-user <user>     Usuario de la VPS (default: root)"
      echo "  --vps-port <port>     Puerto SSH de la VPS (default: 22)"
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

validate_connection() {
  log_step "Validando conexión a la VPS..."
  
  if ssh -i "$VPS_KEY" -p "$VPS_PORT" -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "echo 'Conexión exitosa'" >/dev/null 2>&1; then
    log_success "Conexión a la VPS exitosa"
  else
    log_error "No se pudo conectar a la VPS. Verifica host, puerto, credenciales y firewall."
    exit 1
  fi
}

update_system() {
  log_step "Actualizando el sistema..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    apt update && apt upgrade -y
    apt install -y curl wget git vim htop ufw fail2ban unattended-upgrades
EOF
  
  log_success "Sistema actualizado"
}

create_deploy_user() {
  log_step "Creando usuario deploy..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Crear usuario deploy si no existe
    if ! id "deploy" &>/dev/null; then
      adduser --disabled-password --gecos "" deploy
      usermod -aG sudo deploy
      echo "deploy ALL=(ALL) NOPASSWD:ALL" | tee -a /etc/sudoers
      log_success "Usuario deploy creado"
    else
      log_info "Usuario deploy ya existe"
    fi
EOF
  
  log_success "Usuario deploy configurado"
}

setup_firewall() {
  log_step "Configurando firewall (UFW)..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Permitir SSH
    ufw allow 22/tcp
    
    # Permitir HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Habilitar firewall
    ufw --force enable
    
    # Verificar estado
    ufw status verbose
EOF
  
  log_success "Firewall configurado"
}

install_docker() {
  log_step "Instalando Docker..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Instalar Docker usando el script oficial
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    
    # Agregar usuario deploy al grupo docker
    usermod -aG docker deploy
    
    # Verificar instalación
    docker --version
    docker compose version
    
    # Configurar Docker daemon
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << 'DAEMON_JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
DAEMON_JSON
    
    # Reiniciar Docker
    systemctl restart docker
    systemctl enable docker
EOF
  
  log_success "Docker instalado y configurado"
}

setup_project_structure() {
  log_step "Configurando estructura de proyecto..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Cambiarse al usuario deploy
    sudo -iu deploy
    
    # Crear directorio del proyecto
    mkdir -p ~/sistema-reservas
    cd ~/sistema-reservas
    
    # Crear subdirectorios
    mkdir -p traefik/dynamic
    mkdir -p traefik/logs
    mkdir -p backups
    mkdir -p scripts
    
    # Crear directorio para logs de Traefik
    mkdir -p /var/log/traefik
    chown deploy:deploy /var/log/traefik
EOF
  
  log_success "Estructura de proyecto configurada"
}

configure_fail2ban() {
  log_step "Configurando Fail2Ban..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Crear configuración personalizada
    cat > /etc/fail2ban/jail.local << 'JAIL_LOCAL'
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
JAIL_LOCAL

    # Reiniciar Fail2Ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    # Verificar estado
    systemctl status fail2ban
EOF
  
  log_success "Fail2Ban configurado"
}

finalize_setup() {
  log_step "Finalizando configuración..."
  
  ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'EOF'
    # Actualizar permisos
    chown -R deploy:deploy /home/deploy/sistema-reservas
    
    # Reiniciar servicios
    systemctl restart docker
    systemctl restart fail2ban
    
    # Verificar que todo esté funcionando
    systemctl status docker --no-pager
    systemctl status fail2ban --no-pager
    
    echo "==================================="
    echo "CONFIGURACIÓN DE VPS COMPLETADA"
    echo "==================================="
    echo "Usuario deploy creado: deploy"
    echo "Docker instalado: $(docker --version)"
    echo "Firewall activo: $(ufw status | head -1)"
    echo "==================================="
EOF
  
  log_success "Configuración de VPS completada"
}

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=== Iniciando configuración de VPS ==="
  log_info "VPS: $VPS_USER@$VPS_HOST:$VPS_PORT"
  log_info "Fecha: $(date)"
  
  validate_connection
  update_system
  create_deploy_user
  setup_firewall
  install_docker
  setup_project_structure
  configure_fail2ban
  finalize_setup
  
  log_success "🎉 ¡Configuración de VPS completada exitosamente!"
  log_info "Siguiente paso: Desplegar la aplicación con deploy-vps.sh"
  log_info "Recuerda configurar tus variables de entorno seguras en .env.secure"
}

main "$@"