#!/bin/bash
set -euo pipefail

# =============================================================================
# Script: Backup de Base de Datos
# =============================================================================
# Realiza backup de PostgreSQL (pg_dump custom) y Redis (RDB snapshot)
# Con compresión gzip, rotación automática (7 días) y upload opcional a S3/R2
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
log_s3() { echo -e "${MAGENTA}☁️  $1${NC}"; }

# Variables por defecto
BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-sistema-reservas-db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-sistema-reservas-redis}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-sistema_reservas}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DRY_RUN=false
SKIP_REDIS=false
SKIP_POSTGRES=false
S3_UPLOAD=false
S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"

# Timestamp para nombres de archivos
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_HUMAN=$(date +"%Y-%m-%d %H:%M:%S")

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --skip-redis) SKIP_REDIS=true; shift ;;
    --skip-postgres) SKIP_POSTGRES=true; shift ;;
    --s3-upload) S3_UPLOAD=true; shift ;;
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-endpoint) S3_ENDPOINT="$2"; shift 2 ;;
    --retention) RETENTION_DAYS="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    -h|--help)
      echo -e "${CYAN}Uso: $0 [opciones]${NC}"
      echo ""
      echo "Opciones:"
      echo "  --dry-run           Simular sin ejecutar"
      echo "  --skip-redis        Omitir backup de Redis"
      echo "  --skip-postgres     Omitir backup de PostgreSQL"
      echo "  --s3-upload         Upload a S3/R2 después del backup"
      echo "  --s3-bucket         Nombre del bucket S3"
      echo "  --s3-endpoint       Endpoint S3 (ej: https://s3.us-east-1.amazonaws.com)"
      echo "  --retention         Días a retener (default: 7)"
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
  
  # Check pg_dump
  if ! command -v pg_dump &>/dev/null; then
    log_error "pg_dump no está instalado (postgresql-client requerido)"
    ((errors++))
  fi
  
  # Check gzip
  if ! command -v gzip &>/dev/null; then
    log_error "gzip no está instalado"
    ((errors++))
  fi
  
  # Check backup directory
  if [ ! -d "$BACKUP_DIR" ]; then
    if [ "$DRY_RUN" = true ]; then
      log_info "[DRY-RUN] mkdir -p $BACKUP_DIR"
    else
      mkdir -p "$BACKUP_DIR"
      log_success "Directorio de backups creado: $BACKUP_DIR"
    fi
  fi
  
  # Check S3 credentials if upload enabled
  if [ "$S3_UPLOAD" = true ]; then
    if [ -z "$S3_BUCKET" ] || [ -z "$S3_ACCESS_KEY" ] || [ -z "$S3_SECRET_KEY" ]; then
      log_error "S3 upload habilitado pero faltan credenciales (S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY)"
      ((errors++))
    fi
    
    if ! command -v aws &>/dev/null && ! command -v rclone &>/dev/null; then
      log_error "aws-cli o rclone requerido para S3 upload"
      ((errors++))
    fi
  fi
  
  if [ $errors -gt 0 ]; then
    log_error "Prerequisites fallaron con $errors errores"
    return 1
  fi
  
  log_success "Prerequisites verificados"
}

# =============================================================================
# PostgreSQL Backup
# =============================================================================

backup_postgres() {
  local backup_file="$BACKUP_DIR/pg_${PG_DB}_${TIMESTAMP}.dump"
  local compressed_file="${backup_file}.gz"
  
  log_step "Iniciando backup de PostgreSQL..."
  log_info "Container: $PG_CONTAINER"
  log_info "Database: $PG_DB"
  log_info "Output: $compressed_file"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker exec $PG_CONTAINER pg_dump -U $PG_USER -F c -b -v $PG_DB"
    log_info "[DRY-RUN] gzip $backup_file"
    log_success "[DRY-RUN] PostgreSQL backup simulado"
    return 0
  fi
  
  # Check container running
  if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    log_error "Container PostgreSQL no está corriendo: $PG_CONTAINER"
    return 1
  fi
  
  # pg_dump en formato custom (-F c) con compresión
  if docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -F c -b -v "$PG_DB" > "$backup_file" 2>/dev/null; then
    log_success "pg_dump completado"
  else
    log_error "pg_dump falló"
    return 1
  fi
  
  # Comprimir con gzip
  log_step "Comprimiendo backup..."
  if gzip "$backup_file"; then
    local size=$(du -h "$compressed_file" | cut -f1)
    log_success "Compresión completada ($size)"
  else
    log_error "Compresión falló"
    return 1
  fi
  
  log_success "PostgreSQL backup: $compressed_file"
  echo "$compressed_file"
}

# =============================================================================
# Redis Backup
# =============================================================================

backup_redis() {
  local backup_file="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
  local compressed_file="${backup_file}.gz"
  
  log_step "Iniciando backup de Redis..."
  log_info "Container: $REDIS_CONTAINER"
  log_info "Output: $compressed_file"
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] docker exec $REDIS_CONTAINER redis-cli BGSAVE"
    log_info "[DRY-RUN] docker cp $REDIS_CONTAINER:/data/dump.rdb $backup_file"
    log_info "[DRY-RUN] gzip $backup_file"
    log_success "[DRY-RUN] Redis backup simulado"
    return 0
  fi
  
  # Check container running
  if ! docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    log_error "Container Redis no está corriendo: $REDIS_CONTAINER"
    return 1
  fi
  
  # Forzar BGSAVE
  log_info "Forzando BGSAVE en Redis..."
  if ! docker exec "$REDIS_CONTAINER" redis-cli BGSAVE > /dev/null 2>&1; then
    log_warning "BGSAVE no respondió (puede estar deshabilitado)"
  else
    log_success "BGSAVE iniciado"
    # Esperar a que termine el save
    sleep 2
  fi
  
  # Copiar dump.rdb
  if docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$backup_file" 2>/dev/null; then
    log_success "RDB copiado del container"
  else
    log_warning "No se encontró dump.rdb (Redis puede estar usando appendonly)"
    # Crear backup vacío como placeholder
    touch "$backup_file"
  fi
  
  # Comprimir
  log_step "Comprimiendo backup..."
  if gzip "$backup_file"; then
    local size=$(du -h "$compressed_file" | cut -f1)
    log_success "Compresión completada ($size)"
  else
    log_error "Compresión falló"
    return 1
  fi
  
  log_success "Redis backup: $compressed_file"
  echo "$compressed_file"
}

# =============================================================================
# Rotation (Keep N days)
# =============================================================================

rotate_backups() {
  log_step "Rotación de backups (keep $RETENTION_DAYS días)..."
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] find $BACKUP_DIR -name '*.gz' -mtime +$RETENTION_DAYS -delete"
    return 0
  fi
  
  local count_before=$(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)
  local deleted=0
  
  # Eliminar backups antiguos
  while IFS= read -r file; do
    if [ -n "$file" ]; then
      rm -f "$file"
      ((deleted++))
      log_info "Eliminado: $(basename "$file")"
    fi
  done < <(find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS)
  
  local count_after=$(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l)
  
  if [ $deleted -gt 0 ]; then
    log_success "Rotación completada: $deleted backups eliminados ($count_before → $count_after)"
  else
    log_info "No hay backups antiguos para eliminar"
  fi
}

# =============================================================================
# S3 Upload (Opcional)
# =============================================================================

upload_to_s3() {
  local file="$1"
  local filename=$(basename "$file")
  local s3_path="s3://$S3_BUCKET/backups/$filename"
  
  log_s3 "Upload a S3: $filename"
  
  if [ "$DRY_RUN" = true ]; then
    log_s3 "[DRY-RUN] aws s3 cp $file $s3_path"
    return 0
  fi
  
  # Configurar AWS CLI para endpoint custom (R2, etc)
  if [ -n "$S3_ENDPOINT" ]; then
    export AWS_ENDPOINT_URL="$S3_ENDPOINT"
  fi
  
  export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
  
  if aws s3 cp "$file" "$s3_path" --acl private 2>/dev/null; then
    log_s3 "✅ Upload completado: $s3_path"
  else
    log_error "S3 upload falló"
    return 1
  fi
}

# =============================================================================
# List Backups
# =============================================================================

list_backups() {
  log_step "Backups disponibles en $BACKUP_DIR:"
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    log_info "[DRY-RUN] ls -lh $BACKUP_DIR"
    return 0
  fi
  
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
    log_warning "No hay backups en $BACKUP_DIR"
    return 0
  fi
  
  echo -e "${CYAN}PostgreSQL:${NC}"
  ls -lht "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null | head -10 || log_info "Sin backups de PostgreSQL"
  
  echo ""
  echo -e "${CYAN}Redis:${NC}"
  ls -lht "$BACKUP_DIR"/redis_*.rdb.gz 2>/dev/null | head -10 || log_info "Sin backups de Redis"
  
  echo ""
  log_info "Total: $(find "$BACKUP_DIR" -name "*.gz" -type f | wc -l) backups"
}

# =============================================================================
# Summary
# =============================================================================

show_summary() {
  echo ""
  log_info "=== Resumen del Backup ==="
  log_info "Fecha: $DATE_HUMAN"
  log_info "Directorio: $BACKUP_DIR"
  log_info "Retención: $RETENTION_DAYS días"
  log_info "S3 Upload: $S3_UPLOAD"
  
  if [ "$DRY_RUN" = true ]; then
    log_warning "MODO DRY-RUN: No se realizaron cambios reales"
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=== Backup de Base de Datos ==="
  log_info "Fecha: $DATE_HUMAN"
  log_info "Dry-run: $DRY_RUN"
  echo ""
  
  check_prerequisites
  
  local pg_backup=""
  local redis_backup=""
  
  # PostgreSQL backup
  if [ "$SKIP_POSTGRES" = false ]; then
    pg_backup=$(backup_postgres)
    if [ -n "$pg_backup" ] && [ "$S3_UPLOAD" = true ]; then
      upload_to_s3 "$pg_backup"
    fi
    echo ""
  else
    log_info "PostgreSQL backup: OMITIDO"
    echo ""
  fi
  
  # Redis backup
  if [ "$SKIP_REDIS" = false ]; then
    redis_backup=$(backup_redis)
    if [ -n "$redis_backup" ] && [ "$S3_UPLOAD" = true ]; then
      upload_to_s3 "$redis_backup"
    fi
    echo ""
  else
    log_info "Redis backup: OMITIDO"
    echo ""
  fi
  
  # Rotation
  rotate_backups
  echo ""
  
  # List backups
  list_backups
  echo ""
  
  show_summary
  
  log_success "Backup completado exitosamente"
}

main "$@"
