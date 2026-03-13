#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Health Check del Sistema
# =============================================================================
# Verifica estado de contenedores, health checks, endpoints, SSL, disco, etc.
# Output con colores y exit code: 0 (OK) / 1 (PROBLEMAS)
# =============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${CYAN}🔧 $1${NC}"; }
log_ssl() { echo -e "${MAGENTA}🔒 $1${NC}"; }
log_disk() { echo -e "${WHITE}💾 $1${NC}"; }

# Variables por defecto
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-deploy}"
VPS_PORT="${VPS_PORT:-22}"
VPS_KEY="${VPS_KEY:-~/.ssh/id_rsa}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.prod.yml}"
FRONTEND_URL="${FRONTEND_URL:-https://reservas.dominio.com}"
API_URL="${API_URL:-https://api.reservas.dominio.com}"
TRAEFIK_URL="${TRAEFIK_URL:-https://traefik.reservas.dominio.com}"
SSL_WARN_DAYS="${SSL_WARN_DAYS:-30}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-80}"
DISK_CRIT_PERCENT="${DISK_CRIT_PERCENT:-90}"
QUIET=false
JSON_OUTPUT=false

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vps-host) VPS_HOST="$2"; shift 2 ;;
    --vps-user) VPS_USER="$2"; shift 2 ;;
    --vps-port) VPS_PORT="$2"; shift 2 ;;
    --vps-key) VPS_KEY="$2"; shift 2 ;;
    --frontend-url) FRONTEND_URL="$2"; shift 2 ;;
    --api-url) API_URL="$2"; shift 2 ;;
    --ssl-warn-days) SSL_WARN_DAYS="$2"; shift 2 ;;
    --disk-warn) DISK_WARN_PERCENT="$2"; shift 2 ;;
    --disk-crit) DISK_CRIT_PERCENT="$2"; shift 2 ;;
    --quiet) QUIET=true; shift ;;
    --json) JSON_OUTPUT=true; shift ;;
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --vps-host          Host de la VPS (opcional, para remote checks)"
      echo "  --vps-user          Usuario de la VPS (default: deploy)"
      echo "  --vps-port          Puerto SSH de la VPS (default: 22)"
      echo "  --vps-key           SSH key para la VPS (default: ~/.ssh/id_rsa)"
      echo "  --frontend-url      URL del frontend (default: https://reservas.dominio.com)"
      echo "  --api-url           URL de la API (default: https://api.reservas.dominio.com)"
      echo "  --ssl-warn-days     Días para warning de SSL (default: 30)"
      echo "  --disk-warn         % disco para warning (default: 80)"
      echo "  --disk-crit         % disco para crítico (default: 90)"
      echo "  --quiet             Output mínimo (solo errores)"
      echo "  --json              Output en formato JSON"
      echo "  -h, --help          Mostrar esta ayuda"
      exit 0
      ;;
    *) log_error "Opción desconocida: $1"; exit 1 ;;
  esac
done

# =============================================================================
# Helper Functions
# =============================================================================

record_pass() {
  ((TOTAL_CHECKS++))
  ((PASSED_CHECKS++))
  if [ "$QUIET" = false ]; then
    log_success "$1"
  fi
}

record_warning() {
  ((TOTAL_CHECKS++))
  ((WARNING_CHECKS++))
  if [ "$QUIET" = false ]; then
    log_warning "$1"
  fi
}

record_fail() {
  ((TOTAL_CHECKS++))
  ((FAILED_CHECKS++))
  log_error "$1"
}

run_remote() {
  local cmd="$1"
  
  if [ -n "$VPS_HOST" ]; then
    ssh -i "$VPS_KEY" -p "$VPS_PORT" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "$cmd" 2>/dev/null
  else
    bash -c "$cmd" 2>/dev/null
  fi
}

# =============================================================================
# Container Checks
# =============================================================================

check_containers() {
  log_step "=== Verificando Contenedores ==="
  
  local containers=("sistema-reservas-db" "sistema-reservas-redis" "sistema-reservas-backend" "sistema-reservas-frontend" "sistema-reservas-proxy")
  
  for container in "${containers[@]}"; do
    if run_remote "docker ps --format '{{.Names}}' | grep -q '^${container}$'"; then
      local status=$(run_remote "docker inspect -f '{{.State.Status}}' $container" 2>/dev/null)
      local health=$(run_remote "docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' $container" 2>/dev/null)
      
      if [ "$status" = "running" ]; then
        if [ "$health" = "healthy" ]; then
          record_pass "$container: Running (healthy)"
        elif [ "$health" = "unhealthy" ]; then
          record_warning "$container: Running (unhealthy)"
        else
          record_pass "$container: Running (no healthcheck)"
        fi
      else
        record_fail "$container: Status = $status"
      fi
    else
      record_fail "$container: Not found"
    fi
  done
  
  echo ""
}

# =============================================================================
# Docker Health Checks
# =============================================================================

check_docker_health() {
  log_step "=== Verificando Docker Health Checks ==="
  
  local containers_with_health=("sistema-reservas-db" "sistema-reservas-redis" "sistema-reservas-backend" "sistema-reservas-frontend")
  
  for container in "${containers_with_health[@]}"; do
    if run_remote "docker ps --format '{{.Names}}' | grep -q '^${container}$'"; then
      local health_status=$(run_remote "docker inspect -f '{{.State.Health.Status}}' $container" 2>/dev/null)
      local failing_streak=$(run_remote "docker inspect -f '{{.State.Health.FailingStreak}}' $container" 2>/dev/null)
      
      case "$health_status" in
        healthy)
          record_pass "$container health: $health_status (failing: $failing_streak)"
          ;;
        unhealthy)
          record_fail "$container health: $health_status (failing: $failing_streak)"
          ;;
        starting)
          record_warning "$container health: $health_status"
          ;;
        *)
          record_warning "$container: Sin health check configurado"
          ;;
      esac
    fi
  done
  
  echo ""
}

# =============================================================================
# Endpoint Checks
# =============================================================================

check_endpoints() {
  log_step "=== Verificando Endpoints Críticos ==="
  
  # Frontend root
  if curl -sf --max-time 10 "$FRONTEND_URL/" >/dev/null 2>&1; then
    local status=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$FRONTEND_URL/")
    if [ "$status" = "200" ]; then
      record_pass "Frontend (/): HTTP $status"
    else
      record_warning "Frontend (/): HTTP $status"
    fi
  else
    record_fail "Frontend (/): No responde"
  fi
  
  # API health
  if curl -sf --max-time 10 "$API_URL/health" >/dev/null 2>&1; then
    local status=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$API_URL/health")
    if [ "$status" = "200" ]; then
      record_pass "API (/health): HTTP $status"
    else
      record_warning "API (/health): HTTP $status"
    fi
  else
    record_fail "API (/health): No responde"
  fi
  
  # API root
  if curl -sf --max-time 10 "$API_URL/" >/dev/null 2>&1; then
    local status=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$API_URL/")
    if [ "$status" = "200" ]; then
      record_pass "API (/): HTTP $status"
    else
      record_warning "API (/): HTTP $status"
    fi
  else
    record_fail "API (/): No responde"
  fi
  
  # Traefik dashboard (optional)
  if curl -sf --max-time 10 "$TRAEFIK_URL" >/dev/null 2>&1; then
    local status=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$TRAEFIK_URL")
    record_pass "Traefik dashboard: HTTP $status"
  else
    record_warning "Traefik dashboard: No accesible (puede estar deshabilitado)"
  fi
  
  echo ""
}

# =============================================================================
# SSL Certificate Checks
# =============================================================================

check_ssl_certificates() {
  log_step "=== Verificando SSL Certificates ==="
  
  local urls=("$FRONTEND_URL" "$API_URL" "$TRAEFIK_URL")
  
  for url in "${urls[@]}"; do
    local domain=$(echo "$url" | sed 's|https://||' | cut -d'/' -f1)
    
    if echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
      local expiry_date=$(echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
      local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s 2>/dev/null || echo "0")
      local now_epoch=$(date +%s)
      local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
      
      if [ "$days_left" -lt 0 ]; then
        record_fail "SSL $domain: EXPIRED ($expiry_date)"
      elif [ "$days_left" -lt "$SSL_WARN_DAYS" ]; then
        record_warning "SSL $domain: Expira en $days_left días ($expiry_date)"
      else
        record_pass "SSL $domain: Válido por $days_left días (expira: $expiry_date)"
      fi
    else
      record_warning "SSL $domain: No se pudo verificar"
    fi
  done
  
  echo ""
}

# =============================================================================
# Disk Space Checks
# =============================================================================

check_disk_space() {
  log_step "=== Verificando Espacio en Disco ==="
  
  local disk_info=$(run_remote "df -h / | tail -1" 2>/dev/null)
  
  if [ -n "$disk_info" ]; then
    local usage=$(echo "$disk_info" | awk '{print $5}' | sed 's/%//')
    local available=$(echo "$disk_info" | awk '{print $4}')
    local total=$(echo "$disk_info" | awk '{print $2}')
    
    if [ "$usage" -ge "$DISK_CRIT_PERCENT" ]; then
      record_fail "Disco: ${usage}% usado (CRÍTICO) - Disponible: $available de $total"
    elif [ "$usage" -ge "$DISK_WARN_PERCENT" ]; then
      record_warning "Disco: ${usage}% usado (WARNING) - Disponible: $available de $total"
    else
      record_pass "Disco: ${usage}% usado - Disponible: $available de $total"
    fi
    
    # Check Docker disk usage
    local docker_size=$(run_remote "docker system df | grep 'Images' | awk '{print \$2}'" 2>/dev/null || echo "N/A")
    log_disk "Docker Images: $docker_size"
    
    # Check Docker volume usage
    local volumes_size=$(run_remote "docker system df -v | grep 'Local Volumes' | awk '{print \$2}'" 2>/dev/null || echo "N/A")
    log_disk "Docker Volumes: $volumes_size"
  else
    record_fail "Disco: No se pudo obtener información"
  fi
  
  echo ""
}

# =============================================================================
# Memory and CPU Checks
# =============================================================================

check_resources() {
  log_step "=== Verificando Recursos (Memory/CPU) ==="
  
  # Memory
  local mem_info=$(run_remote "free -m | grep Mem" 2>/dev/null)
  
  if [ -n "$mem_info" ]; then
    local total=$(echo "$mem_info" | awk '{print $2}')
    local used=$(echo "$mem_info" | awk '{print $3}')
    local free=$(echo "$mem_info" | awk '{print $7}')
    local percent=$((used * 100 / total))
    
    if [ "$percent" -ge 90 ]; then
      record_fail "Memoria: ${percent}% usado (${used}MB/${total}MB)"
    elif [ "$percent" -ge 80 ]; then
      record_warning "Memoria: ${percent}% usado (${used}MB/${total}MB)"
    else
      record_pass "Memoria: ${percent}% usado (${used}MB/${total}MB - libre: ${free}MB)"
    fi
  else
    record_warning "Memoria: No se pudo obtener información"
  fi
  
  # Load average
  local load=$(run_remote "cat /proc/loadavg | awk '{print \$1, \$2, \$3}'" 2>/dev/null || echo "N/A")
  log_info "Load average: $load"
  
  echo ""
}

# =============================================================================
# Container Logs Check
# =============================================================================

check_container_logs() {
  log_step "=== Verificando Logs Recientes (Errores) ==="
  
  local containers=("sistema-reservas-backend" "sistema-reservas-frontend")
  
  for container in "${containers[@]}"; do
    if run_remote "docker ps --format '{{.Names}}' | grep -q '^${container}$'"; then
      local errors=$(run_remote "docker logs --tail 100 $container 2>&1 | grep -ci 'error\\|exception\\|fatal' || echo 0")
      
      if [ "$errors" -gt 10 ]; then
        record_warning "$container: $errors errores en logs recientes"
      else
        record_pass "$container: $errors errores en logs recientes"
      fi
    fi
  done
  
  echo ""
}

# =============================================================================
# Network Checks
# =============================================================================

check_network() {
  log_step "=== Verificando Red ==="
  
  # Check if containers can reach each other
  local db_reachable=$(run_remote "docker exec sistema-reservas-backend ping -c 1 -W 2 sistema-reservas-db >/dev/null 2>&1 && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")
  
  if [ "$db_reachable" = "yes" ]; then
    record_pass "Backend → DB: Conectado"
  elif [ "$db_reachable" = "no" ]; then
    record_fail "Backend → DB: No conectable"
  else
    record_warning "Backend → DB: No verificable"
  fi
  
  local redis_reachable=$(run_remote "docker exec sistema-reservas-backend ping -c 1 -W 2 sistema-reservas-redis >/dev/null 2>&1 && echo 'yes' || echo 'no'" 2>/dev/null || echo "unknown")
  
  if [ "$redis_reachable" = "yes" ]; then
    record_pass "Backend → Redis: Conectado"
  elif [ "$redis_reachable" = "no" ]; then
    record_fail "Backend → Redis: No conectable"
  else
    record_warning "Backend → Redis: No verificable"
  fi
  
  echo ""
}

# =============================================================================
# Summary
# =============================================================================

show_summary() {
  echo ""
  echo -e "${WHITE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${WHITE}                    RESUMEN DEL HEALTH CHECK                ${NC}"
  echo -e "${WHITE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  
  if [ "$JSON_OUTPUT" = true ]; then
    cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "total_checks": $TOTAL_CHECKS,
  "passed": $PASSED_CHECKS,
  "warnings": $WARNING_CHECKS,
  "failed": $FAILED_CHECKS,
  "status": "$([ $FAILED_CHECKS -eq 0 ] && echo 'healthy' || echo 'unhealthy')",
  "vps_host": "${VPS_HOST:-local}"
}
EOF
  else
    echo -e "  Total Checks:    ${WHITE}$TOTAL_CHECKS${NC}"
    
    if [ $PASSED_CHECKS -gt 0 ]; then
      echo -e "  ${GREEN}✅ Passed:${NC}      ${GREEN}$PASSED_CHECKS${NC}"
    else
      echo -e "  Passed:        $PASSED_CHECKS"
    fi
    
    if [ $WARNING_CHECKS -gt 0 ]; then
      echo -e "  ${YELLOW}⚠️  Warnings:${NC}   ${YELLOW}$WARNING_CHECKS${NC}"
    else
      echo -e "  Warnings:      $WARNING_CHECKS"
    fi
    
    if [ $FAILED_CHECKS -gt 0 ]; then
      echo -e "  ${RED}❌ Failed:${NC}      ${RED}$FAILED_CHECKS${NC}"
    else
      echo -e "  Failed:        $FAILED_CHECKS"
    fi
    
    echo ""
    
    local health_percent=$((TOTAL_CHECKS > 0 ? (PASSED_CHECKS * 100 / TOTAL_CHECKS) : 0))
    
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -eq 0 ]; then
      echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║  ✅ SISTEMA SALUDABLE (${health_percent}% OK)                              ║${NC}"
      echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    elif [ $FAILED_CHECKS -eq 0 ]; then
      echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════╗${NC}"
      echo -e "${YELLOW}║  ⚠️  SISTEMA CON WARNINGS (${health_percent}% OK)                         ║${NC}"
      echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════╝${NC}"
    else
      echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
      echo -e "${RED}║  ❌ SISTEMA CON PROBLEMAS (${health_percent}% OK)                         ║${NC}"
      echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    fi
  fi
  
  echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
  if [ "$QUIET" = false ]; then
    log_info "=== Health Check del Sistema ==="
    log_info "Fecha: $(date +"%Y-%m-%d %H:%M:%S")"
    
    if [ -n "$VPS_HOST" ]; then
      log_info "VPS: $VPS_USER@$VPS_HOST:$VPS_PORT"
    else
      log_info "Local: $(hostname)"
    fi
    
    echo ""
  fi
  
  # Run all checks
  check_containers
  check_docker_health
  check_endpoints
  check_ssl_certificates
  check_disk_space
  check_resources
  check_container_logs
  check_network
  
  # Show summary
  show_summary
  
  # Exit code
  if [ $FAILED_CHECKS -gt 0 ]; then
    exit 1
  else
    exit 0
  fi
}

main "$@"
