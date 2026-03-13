#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Restore de Base de Datos
# =============================================================================
# Restaura PostgreSQL y Redis desde backups disponibles
# Con verificación post-restore y health check de servicios
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
log_verify() { echo -e "${MAGENTA}✓ $1${NC}"; }

# Variables por defecto
BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-sistema-reservas-db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-sistema-reservas-redis}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-sistema_reservas}"
DRY_RUN=false
SKIP_VERIFY=false
FORCE=false
PG_BACKUP=""
REDIS_BACKUP=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --skip-verify) SKIP_VERIFY=true; shift ;;
    --force) FORCE=true; shift ;;
    --pg-backup) PG_BACKUP="$2"; shift 2 ;;
    --redis-backup) REDIS_BACKUP="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --dry-run           Simular sin ejecutar"
      echo "  --skip-verify       Omitir verificación post-restore"
      echo "  --force             Forzar restore sin confirmación"
      echo "  --pg-backup         Archivo de backup PostgreSQL específico"
      echo "  --redis-backup      Archivo de backup Redis específico"
      echo "  --backup-dir        Directorio de backups (default: ./backups)"
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
  
  # Check pg_restore
  if ! command -v pg_restore &>/dev/null; then
    log_error "pg_restore no está instalado (postgresql-client requerido)"
    ((errors++))
  fi
  
  # Check backup directory
  if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Directorio de backups no existe: $BACKUP_DIR"
    ((errors++))
  fi
  
  if [ $errors -gt 0 ]; then
    log_error "Prerequisites fallaron con $errors errores"
    return 1
  fi
  
  log_success "Prerequisites verificados"
}

# =============================================================================
# List Available Backups
# =============================================================================

list_backups() {
  log_step "Backups disponibles en $BACKUP_DIR:"
  echo ""
  
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
    log_error "No hay backups en $BACKUP_DIR"
    return 1
  fi
  
  echo -e "${CYAN}=== PostgreSQL Backups ===${NC}"
  local pg_count=0
  while IFS= read -r file; do
    if [ -n "$file" ]; then
      local size=$(du -h "$file" | cut -f1)
      local date=$(stat -c %y "$file" 2>/dev/null | cut -d' ' -f1)
      echo "  $date | $size | $(basename "$file")"
      ((pg_count++))
    fi
  done < <(ls -lt "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null)
  
  if [ $pg_count -eq 0 ]; then
    log_info "Sin backups de PostgreSQL"
  fi
  
  echo ""
  echo -e "${CYAN}=== Redis Backups ===${NC}"
  local redis_count=0
  while IFS= read -r file; do
    if [ -n "$file" ]; then
      local size=$(du -h "$file" | cut -f1)
      local date=$(stat -c %y "$file" 2>/dev/null | cut -d' ' -f1)
      echo "  $date | $size | $(basename "$file")"
      ((redis_count++))
    fi
  done < <(ls -lt "$BACKUP_DIR"/redis_*.rdb.gz 2>/dev/null)
  
  if [ $redis_count -eq 0 ]; then
    log_info "Sin backups de Redis"
  fi
  
  echo ""
  log_info "Total: $pg_count PostgreSQL, $redis_count Redis"
  echo ""
  
  return 0
}

# =============================================================================
# Select Latest Backup
# =============================================================================

select_latest_backup() {
  local type="$1"
  
  if [ "$type" = "pg" ]; then
    ls -t "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null | head -1
  elif [ "$type" = "redis" ]; then
    ls -t "$BACKUP_DIR"/redis_*.rdb.gz 2>/dev/null | head -1
  fi
}

# =============================================================================
# Confirm Restore
# =============================================================================

confirm_restore() {
  local pg_file="$1"
  local redis_file="$2"
  
  if [ "$FORCE" = true ]; then
    log_warning "MODO FORCE: Sin confirmación"
    return 0
  fi
  
  echo ""
  log_warning "=== CONFIRMACIÓN DE RESTORE ==="
  echo ""
  
  if [ -n "$pg_file" ]; then
    echo -e "${CYAN}PostgreSQL:${NC} $(basename "$pg_file")"
  fi
  
  if [ -n "$redis_file" ]; then
    echo -e "${CYAN}Redis:${NC} $(basename "$redis_file")"
  fi
  
  echo ""
  log_warning "⚠️  ESTO SOBREESCRIBIRÁ LOS DATOS ACTUALES"
  echo ""
  read -p "¿Continuar con el restore? (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    log_info "Restore cancelado por el usuario"
    exit 0
  fi
  
  log_info "Restore confirmado"
}

# =============================================================================
# PostgreSQL Restore
# =============================================================================

restore_postgres() {
  local backup_file="$1"
  
  if [ -z "$backup_file" ]; then
    log_warning "No hay backup de PostgreSQL para restaurar"
    return 0
  fi
  
  log_step "Restaurando PostgreSQL desde: $(basename "$backup_file")"
  log_info "Container: $PG_CONTAINER"
  log_info "Database: $PG_DB"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] gunzip -c $backup_file | docker exec -i $PG_CONTAINER pg_restore -U $PG_USER -d $PG_DB --clean --if-exists"
    log_success "[DRY-RUN] PostgreSQL restore simulado"
    return 0
  fi
  
  # Check container running
  if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    log_error "Container PostgreSQL no está corriendo: $PG_CONTAINER"
    return 1
  fi
  
  # Decompress and restore
  log_info "Descomprimiendo y restaurando..."
  
  if gunzip -c "$backup_file" | docker exec -i "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists 2>/dev/null; then
    log_success "PostgreSQL restore completado"
  else
    log_error "PostgreSQL restore falló"
    return 1
  fi
  
  return 0
}

# =============================================================================
# Redis Restore
# =============================================================================

restore_redis() {
  local backup_file="$1"
  
  if [ -z "$backup_file" ]; then
    log_warning "No hay backup de Redis para restaurar"
    return 0
  fi
  
  log_step "Restaurando Redis desde: $(basename "$backup_file")"
  log_info "Container: $REDIS_CONTAINER"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] gunzip -c $backup_file > /tmp/dump.rdb"
    log_info "[DRY-RUN] docker cp /tmp/dump.rdb $REDIS_CONTAINER:/data/dump.rdb"
    log_info "[DRY-RUN] docker exec $REDIS_CONTAINER redis-cli BGSAVE"
    log_success "[DRY-RUN] Redis restore simulado"
    return 0
  fi
  
  # Check container running
  if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    log_error "Container Redis no está corriendo: $REDIS_CONTAINER"
    return 1
  fi
  
  # Decompress to temp file
  local temp_rdb="/tmp/dump_restore_$$.rdb"
  log_info "Descomprimiendo backup..."
  gunzip -c "$backup_file" > "$temp_rdb"
  
  # Stop Redis temporarily
  log_info "Deteniendo Redis temporalmente..."
  docker stop "$REDIS_CONTAINER" >/dev/null 2>&1 || true
  
  # Copy RDB file
  log_info "Copiando RDB al container..."
  
  # Create data directory if not exists
  docker run --rm --volumes-from "$REDIS_CONTAINER" alpine mkdir -p /data 2>/dev/null || true
  
  # Use docker cp to copy the file
  if docker cp "$temp_rdb" "$REDIS_CONTAINER:/data/dump.rdb" 2>/dev/null; then
    log_success "RDB copiado al container"
  else
    # Alternative: use volume mount
    log_warning "docker cp falló, intentando método alternativo..."
    
    # Get volume name
    local volume_name=$(docker inspect "$REDIS_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')
    
    if [ -n "$volume_name" ]; then
      docker run --rm -v "$volume_name:/data" -v "$temp_rdb:/dump.rdb" alpine cp /dump.rdb /data/dump.rdb
      log_success "RDB copiado vía volume"
    else
      log_error "No se pudo copiar el RDB"
      rm -f "$temp_rdb"
      return 1
    fi
  fi
  
  # Restart Redis
  log_info "Iniciando Redis..."
  docker start "$REDIS_CONTAINER" >/dev/null 2>&1
  
  # Wait for Redis to be ready
  sleep 2
  
  # Force load RDB
  log_info "Forzando carga de RDB..."
  docker exec "$REDIS_CONTAINER" redis-cli BGSAVE >/dev/null 2>&1 || true
  
  # Cleanup
  rm -f "$temp_rdb"
  
  log_success "Redis restore completado"
  return 0
}

# =============================================================================
# Post-Restore Verification
# =============================================================================

verify_postgres() {
  if [ "$SKIP_VERIFY" = true ]; then
    log_info "Verificación omitida"
    return 0
  fi
  
  log_step "Verificando PostgreSQL..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker exec $PG_CONTAINER psql -U $PG_USER -d $PG_DB -c 'SELECT COUNT(*) FROM pg_tables'"
    return 0
  fi
  
  # Check tables exist
  local table_count=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
  
  if [ -n "$table_count" ] && [ "$table_count" -gt 0 ]; then
    log_verify "PostgreSQL: $table_count tablas encontradas"
  else
    log_error "PostgreSQL: No se encontraron tablas"
    return 1
  fi
  
  # Check specific tables (if they exist in the schema)
  local expected_tables=("users" "services" "appointments")
  for table in "${expected_tables[@]}"; do
    if docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table'" 2>/dev/null | grep -q 1; then
      log_verify "Tabla '$table' existe"
    fi
  done
  
  log_success "Verificación de PostgreSQL completada"
  return 0
}

verify_redis() {
  if [ "$SKIP_VERIFY" = true ]; then
    return 0
  fi
  
  log_step "Verificando Redis..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker exec $REDIS_CONTAINER redis-cli DBSIZE"
    return 0
  fi
  
  # Check Redis is responding
  if docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q "PONG"; then
    log_verify "Redis: Respondiendo"
  else
    log_error "Redis: No responde"
    return 1
  fi
  
  # Get DB size
  local db_size=$(docker exec "$REDIS_CONTAINER" redis-cli DBSIZE 2>/dev/null | awk '{print $2}')
  if [ -n "$db_size" ]; then
    log_verify "Redis: $db_size keys en la base de datos"
  fi
  
  log_success "Verificación de Redis completada"
  return 0
}

# =============================================================================
# Health Check
# =============================================================================

health_check() {
  log_step "Ejecutando health check de servicios..."
  
  local errors=0
  
  # Check PostgreSQL container
  if docker ps --format '{{.Names}}|{{.Status}}' | grep "^${PG_CONTAINER}|" | grep -q "Up"; then
    log_verify "PostgreSQL container: Healthy"
  else
    log_error "PostgreSQL container: No está corriendo"
    ((errors++))
  fi
  
  # Check Redis container
  if docker ps --format '{{.Names}}|{{.Status}}' | grep "^${REDIS_CONTAINER}|" | grep -q "Up"; then
    log_verify "Redis container: Healthy"
  else
    log_error "Redis container: No está corriendo"
    ((errors++))
  fi
  
  # Check PostgreSQL health
  if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; then
    log_verify "PostgreSQL service: Ready"
  else
    log_error "PostgreSQL service: Not ready"
    ((errors++))
  fi
  
  # Check Redis health
  if docker exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
    log_verify "Redis service: Ready"
  else
    log_error "Redis service: Not ready"
    ((errors++))
  fi
  
  if [ $errors -gt 0 ]; then
    log_error "Health check falló con $errors errores"
    return 1
  fi
  
  log_success "Health check completado - Todos los servicios OK"
  return 0
}

# =============================================================================
# Summary
# =============================================================================

show_summary() {
  echo ""
  log_info "=== Resumen del Restore ==="
  
  if [ -n "$PG_BACKUP" ]; then
    log_info "PostgreSQL: $(basename "$PG_BACKUP")"
  fi
  
  if [ -n "$REDIS_BACKUP" ]; then
    log_info "Redis: $(basename "$REDIS_BACKUP")"
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_warning "MODO DRY-RUN: No se realizaron cambios reales"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=== Restore de Base de Datos ==="
  log_info "Dry-run: $DRY_RUN"
  echo ""
  
  check_prerequisites
  
  # List available backups
  list_backups || exit 1
  
  # Select backups if not specified
  if [ -z "$PG_BACKUP" ]; then
    PG_BACKUP=$(select_latest_backup "pg")
  fi
  
  if [ -z "$REDIS_BACKUP" ]; then
    REDIS_BACKUP=$(select_latest_backup "redis")
  fi
  
  # Validate selected backups
  if [ -n "$PG_BACKUP" ] && [ ! -f "$PG_BACKUP" ]; then
    log_error "Backup de PostgreSQL no encontrado: $PG_BACKUP"
    exit 1
  fi
  
  if [ -n "$REDIS_BACKUP" ] && [ ! -f "$REDIS_BACKUP" ]; then
    log_error "Backup de Redis no encontrado: $REDIS_BACKUP"
    exit 1
  fi
  
  if [ -z "$PG_BACKUP" ] && [ -z "$REDIS_BACKUP" ]; then
    log_error "No hay backups disponibles para restaurar"
    exit 1
  fi
  
  # Confirm restore
  confirm_restore "$PG_BACKUP" "$REDIS_BACKUP"
  
  # Execute restores
  if [ -n "$PG_BACKUP" ]; then
    restore_postgres "$PG_BACKUP" || exit 1
    echo ""
  fi
  
  if [ -n "$REDIS_BACKUP" ]; then
    restore_redis "$REDIS_BACKUP" || exit 1
    echo ""
  fi
  
  # Verification
  if [ "$SKIP_VERIFY" = false ]; then
    verify_postgres || exit 1
    echo ""
    verify_redis || exit 1
    echo ""
  fi
  
  # Health check
  health_check || exit 1
  echo ""
  
  show_summary
  
  log_success "Restore completado exitosamente"
}

main "$@"
