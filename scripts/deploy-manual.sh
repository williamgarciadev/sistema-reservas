#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Deploy Manual (Local → VPS)
# =============================================================================
# Deploy sin CI/CD - Build local, transferencia y deploy en VPS
# Opciones: docker save/load o push temporal a registry
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
log_vps() { echo -e "${MAGENTA}🖥️  $1${NC}"; }

# Variables por defecto
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-deploy}"
VPS_PORT="${VPS_PORT:-22}"
VPS_KEY="${VPS_KEY:-~/.ssh/id_rsa}"
PROJECT_NAME="${PROJECT_NAME:-sistema-reservas}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.prod.yml}"
TRANSFER_METHOD="${TRANSFER_METHOD:-save}"  # save | push
TEMP_REGISTRY="${TEMP_REGISTRY:-}"
DRY_RUN=false
SKIP_BUILD=false
SKIP_TRANSFER=false
NO_RESTART=false

# Directorios temporales
TEMP_DIR="/tmp/deploy_$$"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-transfer) SKIP_TRANSFER=true; shift ;;
    --no-restart) NO_RESTART=true; shift ;;
    --vps-host) VPS_HOST="$2"; shift 2 ;;
    --vps-user) VPS_USER="$2"; shift 2 ;;
    --vps-port) VPS_PORT="$2"; shift 2 ;;
    --vps-key) VPS_KEY="$2"; shift 2 ;;
    --method) TRANSFER_METHOD="$2"; shift 2 ;;
    --registry) TEMP_REGISTRY="$2"; shift 2 ;;
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --dry-run           Simular sin ejecutar"
      echo "  --skip-build        Omitir build de imágenes"
      echo "  --skip-transfer     Omitir transferencia (solo deploy local)"
      echo "  --no-restart        No reiniciar servicios después del deploy"
      echo "  --vps-host          Host de la VPS (requerido si --skip-transfer no está activo)"
      echo "  --vps-user          Usuario de la VPS (default: deploy)"
      echo "  --vps-port          Puerto SSH de la VPS (default: 22)"
      echo "  --vps-key           SSH key para la VPS (default: ~/.ssh/id_rsa)"
      echo "  --method            Método de transferencia: save | push (default: save)"
      echo "  --registry          Registry temporal para método push"
      echo "  -h, --help          Mostrar esta ayuda"
      exit 0
      ;;
    *) log_error "Opción desconocida: $1"; exit 1 ;;
  esac
done

# =============================================================================
# Prerequisites
# =============================================================================

check_prerequisites() {
  log_step "Verificando prerequisites..."
  
  local errors=0
  
  # Check Docker
  if ! command -v docker &>/dev/null; then
    log_error "Docker no está instalado"
    ((errors++))
  fi
  
  # Check docker-compose
  if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
    log_error "docker-compose no está instalado"
    ((errors++))
  fi
  
  # Check SSH if transfer enabled
  if [ "$SKIP_TRANSFER" = false ]; then
    if [ -z "$VPS_HOST" ]; then
      log_error "VPS_HOST requerido (o usar --skip-transfer)"
      ((errors++))
    fi
    
    if ! command -v ssh &>/dev/null; then
      log_error "SSH client no está instalado"
      ((errors++))
    fi
    
    if ! command -v scp &>/dev/null; then
      log_error "SCP no está instalado"
      ((errors++))
    fi
  fi
  
  # Check docker-compose.prod.yml exists
  if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    log_error "Docker Compose file no encontrado: $DOCKER_COMPOSE_FILE"
    ((errors++))
  fi
  
  # Check .env file
  if [ ! -f ".env" ]; then
    log_warning ".env file no encontrado - variables de entorno pueden faltar"
  fi
  
  if [ $errors -gt 0 ]; then
    log_error "Prerequisites fallaron con $errors errores"
    return 1
  fi
  
  log_success "Prerequisites verificados"
}

# =============================================================================
# SSH Connection Test
# =============================================================================

test_ssh_connection() {
  if [ "$SKIP_TRANSFER" = true ]; then
    return 0
  fi
  
  log_step "Probando conexión SSH a $VPS_HOST..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ssh -i $VPS_KEY -p $VPS_PORT $VPS_USER@$VPS_HOST 'echo test'"
    return 0
  fi
  
  if ssh -i "$VPS_KEY" -p "$VPS_PORT" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    log_success "Conexión SSH establecida"
  else
    log_error "No se pudo conectar a la VPS via SSH"
    return 1
  fi
}

# =============================================================================
# Build Images
# =============================================================================

build_images() {
  if [ "$SKIP_BUILD" = true ]; then
    log_info "Build omitido"
    return 0
  fi
  
  log_step "Construyendo imágenes Docker..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker-compose -f $DOCKER_COMPOSE_FILE build"
    log_success "[DRY-RUN] Build simulado"
    return 0
  fi
  
  # Build all services
  if docker-compose -f "$DOCKER_COMPOSE_FILE" build --parallel; then
    log_success "Imágenes construidas exitosamente"
  else
    log_error "Build falló"
    return 1
  fi
  
  # List built images
  log_step "Imágenes construidas:"
  docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "$PROJECT_NAME|backend|frontend" || true
}

# =============================================================================
# Transfer Method: Docker Save/Load
# =============================================================================

transfer_with_save() {
  log_step "Método: Docker Save/Load"
  
  mkdir -p "$TEMP_DIR"
  
  # Get list of images
  local images=()
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      images+=("$line")
    fi
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "$PROJECT_NAME|backend|frontend")
  
  if [ ${#images[@]} -eq 0 ]; then
    log_error "No se encontraron imágenes para transferir"
    return 1
  fi
  
  log_info "Imágenes a transferir: ${#images[@]}"
  
  # Save each image
  for image in "${images[@]}"; do
    local safe_name=$(echo "$image" | sed 's/[^a-zA-Z0-9]/_/g')
    local tar_file="$TEMP_DIR/${safe_name}.tar"
    
    log_step "Guardando imagen: $image"
    
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] docker save -o $tar_file $image"
      continue
    fi
    
    if docker save -o "$tar_file" "$image"; then
      local size=$(du -h "$tar_file" | cut -f1)
      log_success "Imagen guardada: $size"
    else
      log_error "Failed to save image: $image"
      return 1
    fi
  done
  
  # Transfer to VPS
  if [ "$SKIP_TRANSFER" = false ]; then
    log_step "Transfiriendo imágenes a VPS..."
    
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] scp -i $VPS_KEY -P $VPS_PORT $TEMP_DIR/*.tar $VPS_USER@$VPS_HOST:/tmp/"
      log_success "[DRY-RUN] Transferencia simulada"
      return 0
    fi
    
    # Create temp directory on VPS
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "mkdir -p /tmp/docker_images"
    
    # Transfer files
    if scp -i "$VPS_KEY" -P "$VPS_PORT" -r "$TEMP_DIR/"*.tar "$VPS_USER@$VPS_HOST:/tmp/docker_images/"; then
      log_success "Imágenes transferidas"
    else
      log_error "Transferencia falló"
      return 1
    fi
    
    # Load images on VPS
    log_vps "Cargando imágenes en VPS..."
    
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
      cd /tmp/docker_images
      for tar in *.tar; do
        echo "Loading $tar..."
        docker load -i "$tar"
      done
      rm -rf /tmp/docker_images
ENDSSH
    
    log_vps "Imágenes cargadas en VPS"
  else
    log_info "Transferencia omitida (imágenes guardadas en $TEMP_DIR)"
  fi
}

# =============================================================================
# Transfer Method: Push to Temp Registry
# =============================================================================

transfer_with_push() {
  log_step "Método: Push a Registry Temporal"
  
  if [ -z "$TEMP_REGISTRY" ]; then
    log_error "Registry requerido para método push (usar --registry)"
    return 1
  fi
  
  # Get list of images
  local images=()
  while IFS= read -r line; do
    if [ -n "$line" ]; then
      images+=("$line")
    fi
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "$PROJECT_NAME|backend|frontend")
  
  if [ ${#images[@]} -eq 0 ]; then
    log_error "No se encontraron imágenes para transferir"
    return 1
  fi
  
  # Tag and push each image
  for image in "${images[@]}"; do
    local repo=$(echo "$image" | cut -d':' -f1)
    local tag=$(echo "$image" | cut -d':' -f2)
    local new_tag="${TEMP_REGISTRY}/${repo}:${tag}"
    
    log_step "Tagging: $image → $new_tag"
    
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] docker tag $image $new_tag"
      log_info "[DRY-RUN] docker push $new_tag"
      continue
    fi
    
    if docker tag "$image" "$new_tag" && docker push "$new_tag"; then
      log_success "Push completado: $new_tag"
    else
      log_error "Push falló: $new_tag"
      return 1
    fi
  done
  
  # Pull images on VPS
  if [ "$SKIP_TRANSFER" = false ]; then
    log_vps "Pulling imágenes en VPS..."
    
    if [ "$DRY_RUN" = true ]; then
      log_vps "[DRY-RUN] ssh $VPS_HOST 'docker pull ...'"
      return 0
    fi
    
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << ENDSSH
      $(for image in "${images[@]}"; do
        local repo=$(echo "$image" | cut -d':' -f1)
        local tag=$(echo "$image" | cut -d':' -f2)
        echo "docker pull ${TEMP_REGISTRY}/${repo}:${tag}"
      done)
ENDSSH
    
    log_vps "Imágenes pulled en VPS"
  fi
}

# =============================================================================
# Deploy on VPS
# =============================================================================

deploy_on_vps() {
  if [ "$SKIP_TRANSFER" = true ]; then
    log_info "Deploy local..."
  else
    log_vps "Desplegando en VPS..."
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker-compose -f $DOCKER_COMPOSE_FILE up -d"
    log_success "[DRY-RUN] Deploy simulado"
    return 0
  fi
  
  # Copy docker-compose file and .env to VPS if needed
  if [ "$SKIP_TRANSFER" = false ]; then
    log_step "Copiando archivos de configuración..."
    
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "mkdir -p ~/sistema-reservas"
    
    scp -i "$VPS_KEY" -P "$VPS_PORT" "$DOCKER_COMPOSE_FILE" "$VPS_USER@$VPS_HOST:~/sistema-reservas/docker-compose.prod.yml"
    scp -i "$VPS_KEY" -P "$VPS_PORT" ".env" "$VPS_USER@$VPS_HOST:~/sistema-reservas/.env" 2>/dev/null || log_warning ".env no se copió (puede no existir)"
  fi
  
  # Stop existing containers
  log_step "Deteniendo servicios existentes..."
  
  if [ "$SKIP_TRANSFER" = false ]; then
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
      cd ~/sistema-reservas
      docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
ENDSSH
  else
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
  fi
  
  # Start new containers
  log_step "Iniciando nuevos servicios..."
  
  if [ "$SKIP_TRANSFER" = false ]; then
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
      cd ~/sistema-reservas
      docker-compose -f docker-compose.prod.yml up -d
ENDSSH
  else
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
  fi
  
  log_success "Servicios desplegados"
}

# =============================================================================
# Health Check
# =============================================================================

health_check() {
  log_step "Ejecutando health check..."
  
  sleep 10  # Wait for services to start
  
  local errors=0
  
  # Check containers status
  log_step "Verificando contenedores..."
  
  if [ "$SKIP_TRANSFER" = false ]; then
    ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
      docker ps --format "table {{.Names}}\t{{.Status}}" | grep sistema-reservas
ENDSSH
  else
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep sistema-reservas || true
  fi
  
  # Check each service
  local services=("sistema-reservas-db" "sistema-reservas-redis" "sistema-reservas-backend" "sistema-reservas-frontend" "sistema-reservas-proxy")
  
  for service in "${services[@]}"; do
    if [ "$SKIP_TRANSFER" = false ]; then
      if ssh -i "$VPS_KEY" -p "$VPS_PORT" "$VPS_USER@$VPS_HOST" "docker ps --format '{{.Names}}' | grep -q '^${service}$'"; then
        log_success "$service: Running"
      else
        log_error "$service: Not running"
        ((errors++))
      fi
    else
      if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
        log_success "$service: Running"
      else
        log_warning "$service: Not running"
      fi
    fi
  done
  
  if [ $errors -gt 0 ]; then
    log_error "Health check falló con $errors errores"
    return 1
  fi
  
  log_success "Health check completado"
  return 0
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup() {
  log_step "Limpiando archivos temporales..."
  
  if [ -d "$TEMP_DIR" ]; then
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] rm -rf $TEMP_DIR"
    else
      rm -rf "$TEMP_DIR"
    fi
    log_success "Limpieza completada"
  fi
}

# =============================================================================
# Summary
# =============================================================================

show_summary() {
  echo ""
  log_info "=== Resumen del Deploy ==="
  log_info "Proyecto: $PROJECT_NAME"
  log_info "Método: $TRANSFER_METHOD"
  
  if [ "$SKIP_TRANSFER" = false ]; then
    log_info "VPS: $VPS_USER@$VPS_HOST:$VPS_PORT"
  else
    log_info "VPS: LOCAL (skip-transfer)"
  fi
  
  log_info "Dry-run: $DRY_RUN"
  
  echo ""
  if [ "$SKIP_TRANSFER" = false ]; then
    log_info "=== Comandos útiles ==="
    echo "Ver logs:"
    echo "  ssh -i $VPS_KEY -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd ~/sistema-reservas && docker-compose logs -f'"
    echo ""
    echo "Verificar servicios:"
    echo "  ssh -i $VPS_KEY -p $VPS_PORT $VPS_USER@$VPS_HOST 'docker ps'"
    echo ""
    echo "Restart servicios:"
    echo "  ssh -i $VPS_KEY -p $VPS_PORT $VPS_USER@$VPS_HOST 'cd ~/sistema-reservas && docker-compose restart'"
  else
    log_info "=== Comandos útiles ==="
    echo "Ver logs:"
    echo "  docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo ""
    echo "Verificar servicios:"
    echo "  docker ps"
  fi
}

# =============================================================================
# Trap for cleanup
# =============================================================================

trap cleanup EXIT

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=== Deploy Manual (Local → VPS) ==="
  log_info "Fecha: $(date +"%Y-%m-%d %H:%M:%S")"
  log_info "Dry-run: $DRY_RUN"
  echo ""
  
  check_prerequisites
  test_ssh_connection
  
  build_images
  echo ""
  
  if [ "$TRANSFER_METHOD" = "save" ]; then
    transfer_with_save
  elif [ "$TRANSFER_METHOD" = "push" ]; then
    transfer_with_push
  else
    log_error "Método de transferencia inválido: $TRANSFER_METHOD"
    exit 1
  fi
  echo ""
  
  if [ "$NO_RESTART" = false ]; then
    deploy_on_vps
    echo ""
    health_check
  else
    log_info "Restart omitido (--no-restart)"
  fi
  
  show_summary
  
  log_success "Deploy manual completado exitosamente"
}

main "$@"
