# Backup & Restore Procedures

Procedimientos completos para backup, restore y disaster recovery del sistema de reservas.

## Índice

1. [Estrategia de Backup](#1-estrategia-de-backup)
2. [Backup de PostgreSQL](#2-backup-de-postgresql)
3. [Backup de Redis](#3-backup-de-redis)
4. [Backup Remoto (S3/R2)](#4-backup-remoto-s3r2)
5. [Restore de PostgreSQL](#5-restore-de-postgresql)
6. [Restore de Redis](#6-restore-de-redis)
7. [Verificación de Backups](#7-verificación-de-backups)
8. [Disaster Recovery Plan](#8-disaster-recovery-plan)

---

## 1. Estrategia de Backup

### 1.1 Qué Backear

| Componente         | Tipo                 | Frecuencia    | Retención                | Método         |
| ------------------ | -------------------- | ------------- | ------------------------ | -------------- |
| PostgreSQL         | Datos críticos       | Cada 6 horas  | 7 días local, 30 días S3 | pg_dump custom |
| Redis              | Cache/sesiones       | Diario        | 3 días                   | RDB snapshot   |
| Archivos estáticos | Media uploads        | Cada 12 horas | 14 días                  | rsync + S3     |
| Configuración      | .env, docker-compose | Cada cambio   | Indefinido               | Git + S3       |
| Logs               | Logs de aplicación   | Semanal       | 30 días                  | Log rotation   |

### 1.2 Cuándo Backear

```bash
# Crontab recomendado
crontab -e

# Backup PostgreSQL cada 6 horas
0 */6 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-db.sh --skip-redis >> /var/log/backup.log 2>&1

# Backup Redis diario (1 AM)
0 1 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-db.sh --skip-postgres >> /var/log/backup.log 2>&1

# Backup completo a S3 diario (2 AM)
0 2 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-db.sh --s3-upload >> /var/log/backup-s3.log 2>&1

# Verificación semanal de backups (Domingo 3 AM)
0 3 * * 0 cd /home/deploy/sistema-reservas && ./scripts/verify-backup.sh >> /var/log/backup-verify.log 2>&1

# Limpieza de backups locales antiguos (4 AM)
0 4 * * * find /home/deploy/sistema-reservas/backups -name "*.gz" -mtime +7 -delete
```

### 1.3 Dónde Almacenar

```
Estructura de almacenamiento:

Local (VPS):
/home/deploy/sistema-reservas/backups/
├── pg_sistema_reservas_20240101_060000.dump.gz
├── pg_sistema_reservas_20240101_120000.dump.gz
├── redis_20240101_010000.rdb.gz
└── ...

Remoto (S3/R2):
s3://mi-bucket/backups/
├── 2024/
│   ├── 01/
│   │   ├── pg_sistema_reservas_20240101_060000.dump.gz
│   │   ├── pg_sistema_reservas_20240101_120000.dump.gz
│   │   └── redis_20240101_010000.rdb.gz
│   └── ...
└── ...

Offsite (Opcional - otro proveedor):
- Google Cloud Storage
- AWS S3 (otra región)
- Backblaze B2
```

### 1.4 Política de Retención

```yaml
Retención local (VPS):
  postgresql: 7 días
  redis: 3 días
  configuracion: 30 días
  logs: 30 días

Retención remota (S3):
  postgresql: 30 días
  redis: 7 días
  configuracion: 90 días
  logs: 90 días

Retención a largo plazo (Glacier/Archive):
  postgresql: 1 año (backup mensual)
  configuracion: 5 años
```

---

## 2. Backup de PostgreSQL

### 2.1 Script de Backup

```bash
#!/bin/bash
# scripts/backup-db.sh (extracto PostgreSQL)

# Variables
BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-sistema-reservas-db}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-sistema_reservas}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Backup con pg_dump en formato custom
docker exec "$PG_CONTAINER" pg_dump \
  -U "$PG_USER" \
  -F c \
  -b \
  -v \
  "$PG_DB" > "$BACKUP_DIR/pg_${PG_DB}_${TIMESTAMP}.dump"

# Comprimir
gzip "$BACKUP_DIR/pg_${PG_DB}_${TIMESTAMP}.dump"

# Resultado: pg_sistema_reservas_20240101_120000.dump.gz
```

### 2.2 Ejecutar Backup Manual

```bash
# Backup completo (PostgreSQL + Redis)
cd ~/sistema-reservas
./scripts/backup-db.sh

# Solo PostgreSQL
./scripts/backup-db.sh --skip-redis

# Backup con nombre custom
./scripts/backup-db.sh --backup-dir /path/to/backups

# Dry-run (ver qué haría sin ejecutar)
./scripts/backup-db.sh --dry-run

# Ver ayuda
./scripts/backup-db.sh --help
```

### 2.3 Opciones del Script

```bash
./scripts/backup-db.sh [opciones]

Opciones:
  --dry-run           Simular sin ejecutar
  --skip-redis        Omitir backup de Redis
  --skip-postgres     Omitir backup de PostgreSQL
  --s3-upload         Upload a S3/R2 después del backup
  --s3-bucket         Nombre del bucket S3
  --s3-endpoint       Endpoint S3 (ej: https://s3.us-east-1.amazonaws.com)
  --retention         Días a retener (default: 7)
  --backup-dir        Directorio de backups (default: ./backups)
  -h, --help          Mostrar ayuda
```

### 2.4 Formato de Archivo de Backup

```
Nombre: pg_sistema_reservas_YYYYMMDD_HHMMSS.dump.gz

Contenido:
- Formato custom de PostgreSQL (-F c)
- Comprimido con gzip
- Incluye blobs (-b)
- Verbose (-v)

Tamaño típico: 10-500 MB (dependiendo de los datos)

Restaurar:
gunzip -c archivo.dump.gz | pg_restore -U postgres -d sistema_reservas
```

### 2.5 Backup Parcial (Tablas Específicas)

```bash
# Backup solo de tablas específicas
docker exec sistema-reservas-db pg_dump \
  -U postgres \
  -F c \
  -t appointments \
  -t users \
  -t services \
  sistema_reservas > partial_backup.dump

# Backup excluyendo tablas
docker exec sistema-reservas-db pg_dump \
  -U postgres \
  -F c \
  -T cache_* \
  -T logs_* \
  sistema_reservas > backup_sin_cache.dump
```

### 2.6 Backup con Encriptación

```bash
# Backup encriptado con GPG
docker exec sistema-reservas-db pg_dump \
  -U postgres \
  -F c \
  sistema_reservas | gpg --encrypt --recipient tu@email.com > backup.dump.gpg

# Restaurar backup encriptado
gpg --decrypt backup.dump.gpg | pg_restore -U postgres -d sistema_reservas
```

---

## 3. Backup de Redis

### 3.1 Script de Backup

```bash
#!/bin/bash
# scripts/backup-db.sh (extracto Redis)

# Variables
BACKUP_DIR="${BACKUP_DIR:-./backups}"
REDIS_CONTAINER="${REDIS_CONTAINER:-sistema-reservas-redis}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Forzar BGSAVE (guardado en background)
docker exec "$REDIS_CONTAINER" redis-cli BGSAVE

# Esperar a que termine
sleep 2

# Copiar dump.rdb del container
docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

# Comprimir
gzip "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

# Resultado: redis_20240101_010000.rdb.gz
```

### 3.2 Ejecutar Backup de Redis

```bash
# Backup completo (incluye Redis)
./scripts/backup-db.sh

# Solo Redis
./scripts/backup-db.sh --skip-postgres

# Backup manual
docker exec sistema-reservas-redis redis-cli BGSAVE
docker cp sistema-reservas-redis:/data/dump.rdb ./backups/redis_manual.rdb
gzip ./backups/redis_manual.rdb
```

### 3.3 Configuración de Persistencia Redis

```yaml
# docker-compose.prod.yml
redis:
  command: >
    redis-server
    --appendonly yes
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --save 900 1
    --save 300 10
    --save 60 10000
  volumes:
    - redis_data:/data
```

### 3.4 Tipos de Persistencia

```
RDB (Snapshot):
- Ventaja: Archivos compactos, rápido restore
- Desventaja: Puede perder datos entre snapshots
- Uso: Backup periódico

AOF (Append Only):
- Ventaja: Menor pérdida de datos
- Desventaja: Archivos más grandes, restore más lento
- Uso: Producción crítica

Recomendado: Ambos habilitados
```

---

## 4. Backup Remoto (S3/R2)

### 4.1 Configurar AWS CLI

```bash
# Instalar AWS CLI
apt update && apt install -y awscli

# Configurar credenciales
aws configure set aws_access_key_id $S3_ACCESS_KEY
aws configure set aws_secret_access_key $S3_SECRET_KEY
aws configure set default.region us-east-1

# Para Cloudflare R2
aws configure set default.s3.endpoint_url https://<account-id>.r2.cloudflarestorage.com
```

### 4.2 Configurar rclone (Alternativa)

```bash
# Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# Configurar remote S3
rclone config

# Configurar remote R2
rclone config create mi-r2 s3 \
  provider Cloudflare \
  access_key_id $S3_ACCESS_KEY \
  secret_access_key $S3_SECRET_KEY \
  endpoint https://<account-id>.r2.cloudflarestorage.com \
  region auto
```

### 4.3 Upload a S3/R2

```bash
# Upload manual con AWS CLI
aws s3 cp ./backups/pg_sistema_reservas_20240101_120000.dump.gz \
  s3://mi-bucket/backups/2024/01/ \
  --acl private

# Upload con rclone
rclone copy ./backups/pg_sistema_reservas_20240101_120000.dump.gz \
  mi-r2:mi-bucket/backups/2024/01/

# Sync completo (bidireccional)
aws s3 sync ./backups s3://mi-bucket/backups --delete
```

### 4.4 Backup Automático a S3

```bash
# Script: scripts/backup-s3.sh
#!/bin/bash

BACKUP_DIR=~/sistema-reservas/backups
S3_BUCKET=$S3_BUCKET
S3_PATH="s3://$S3_BUCKET/backups/$(date +%Y/%m/%d)"

# Crear backup local primero
./scripts/backup-db.sh

# Upload a S3
aws s3 sync $BACKUP_DIR $S3_PATH --acl private

# Verificar upload
aws s3 ls $S3_PATH

# Limpiar backups locales antiguos
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup a S3 completado: $S3_PATH"
```

### 4.5 Lifecycle Policies (S3)

```json
{
  "Rules": [
    {
      "ID": "BackupRetention",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "backups/"
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

### 4.6 Versioning (S3)

```bash
# Habilitar versioning
aws s3api put-bucket-versioning \
  --bucket mi-bucket \
  --versioning-configuration Status=Enabled

# Ver versioning
aws s3api get-bucket-versioning --bucket mi-bucket

# Listar versiones de un archivo
aws s3api list-object-versions \
  --bucket mi-bucket \
  --prefix backups/pg_sistema_reservas_20240101_120000.dump.gz
```

---

## 5. Restore de PostgreSQL

### 5.1 Script de Restore

```bash
#!/bin/bash
# scripts/restore-db.sh (extracto PostgreSQL)

# Variables
BACKUP_FILE="$1"
PG_CONTAINER="${PG_CONTAINER:-sistema-reservas-db}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-sistema_reservas}"

# Verificar backup existe
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup no encontrado: $BACKUP_FILE"
  exit 1
fi

# Decomprimir y restaurar
gunzip -c "$BACKUP_FILE" | docker exec -i "$PG_CONTAINER" pg_restore \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --clean \
  --if-exists

# Verificar restore
docker exec "$PG_CONTAINER" psql \
  -U "$PG_USER" \
  -d "$PG_DB" \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
```

### 5.2 Ejecutar Restore Manual

```bash
# Listar backups disponibles
./scripts/restore-db.sh --help

# Restore automático (último backup)
./scripts/restore-db.sh

# Restore específico
./scripts/restore-db.sh \
  --pg-backup ./backups/pg_sistema_reservas_20240101_120000.dump.gz

# Dry-run (simular)
./scripts/restore-db.sh --dry-run

# Forzar restore sin confirmación
./scripts/restore-db.sh --force

# Omitir verificación
./scripts/restore-db.sh --skip-verify
```

### 5.3 Opciones del Script

```bash
./scripts/restore-db.sh [opciones]

Opciones:
  --dry-run           Simular sin ejecutar
  --skip-verify       Omitir verificación post-restore
  --force             Forzar restore sin confirmación
  --pg-backup         Archivo de backup PostgreSQL específico
  --redis-backup      Archivo de backup Redis específico
  --backup-dir        Directorio de backups (default: ./backups)
  -h, --help          Mostrar ayuda
```

### 5.4 Restore Parcial (Tabla Específica)

```bash
# Restaurar solo una tabla
gunzip -c backup.dump.gz | pg_restore \
  -U postgres \
  -d sistema_reservas \
  -t users \
  --clean \
  --if-exists

# Listar tablas en el backup
pg_restore -l backup.dump | grep TABLE
```

### 5.5 Restore a Nueva Base de Datos

```bash
# Crear nueva BD
docker exec sistema-reservas-db createdb -U postgres sistema_reservas_restore

# Restaurar a nueva BD
gunzip -c backup.dump.gz | pg_restore \
  -U postgres \
  -d sistema_reservas_restore \
  --clean \
  --if-exists

# Verificar
docker exec sistema-reservas-db psql \
  -U postgres \
  -d sistema_reservas_restore \
  -c "\dt"
```

### 5.6 Restore desde S3

```bash
# Descargar desde S3
aws s3 cp s3://mi-bucket/backups/2024/01/pg_backup.dump.gz ./backups/

# Restaurar
./scripts/restore-db.sh --pg-backup ./backups/pg_backup.dump.gz

# O directo desde S3 (streaming)
aws s3 cp s3://mi-bucket/backups/pg_backup.dump.gz - | \
  gunzip | \
  docker exec -i sistema-reservas-db pg_restore -U postgres -d sistema_reservas
```

---

## 6. Restore de Redis

### 6.1 Script de Restore

```bash
#!/bin/bash
# scripts/restore-db.sh (extracto Redis)

# Variables
BACKUP_FILE="$1"
REDIS_CONTAINER="${REDIS_CONTAINER:-sistema-reservas-redis}"
TEMP_RDB="/tmp/dump_restore_$$.rdb"

# Decomprimir
gunzip -c "$BACKUP_FILE" > "$TEMP_RDB"

# Detener Redis temporalmente
docker stop "$REDIS_CONTAINER"

# Copiar RDB al container
docker cp "$TEMP_RDB" "$REDIS_CONTAINER:/data/dump.rdb"

# Iniciar Redis
docker start "$REDIS_CONTAINER"

# Forzar carga de RDB
docker exec "$REDIS_CONTAINER" redis-cli BGSAVE

# Cleanup
rm -f "$TEMP_RDB"
```

### 6.2 Ejecutar Restore de Redis

```bash
# Restore automático (último backup)
./scripts/restore-db.sh

# Restore específico
./scripts/restore-db.sh \
  --redis-backup ./backups/redis_20240101_010000.rdb.gz

# Restore manual
gunzip -c redis_20240101_010000.rdb.gz > /tmp/dump.rdb
docker cp /tmp/dump.rdb sistema-reservas-redis:/data/dump.rdb
docker restart sistema-reservas-redis
```

### 6.3 Verificar Restore de Redis

```bash
# Verificar Redis responde
docker exec sistema-reservas-redis redis-cli ping
# Debe responder: PONG

# Verificar tamaño de BD
docker exec sistema-reservas-redis redis-cli DBSIZE

# Verificar keys
docker exec sistema-reservas-redis redis-cli KEYS '*'

# Verificar memoria
docker exec sistema-reservas-redis redis-cli INFO memory
```

---

## 7. Verificación de Backups

### 7.1 Script de Verificación

```bash
#!/bin/bash
# scripts/verify-backup.sh

BACKUP_DIR="${BACKUP_DIR:-./backups}"
PG_CONTAINER="${PG_CONTAINER:-sistema-reservas-db}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-sistema_reservas}"
TEST_DB="backup_verify_test"

echo "=== Verificación de Backups ==="

# Verificar último backup de PostgreSQL
LATEST_PG=$(ls -t "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null | head -1)

if [ -z "$LATEST_PG" ]; then
  echo "❌ No hay backups de PostgreSQL"
  exit 1
fi

echo "✅ Backup PostgreSQL encontrado: $(basename "$LATEST_PG")"
echo "   Tamaño: $(du -h "$LATEST_PG" | cut -f1)"
echo "   Fecha: $(stat -c %y "$LATEST_PG")"

# Verificar integridad del archivo
if gzip -t "$LATEST_PG" 2>/dev/null; then
  echo "✅ Integridad del archivo: OK"
else
  echo "❌ Integridad del archivo: FALLÓ"
  exit 1
fi

# Verificar que se puede listar el contenido
if gunzip -c "$LATEST_PG" | pg_restore -l >/dev/null 2>&1; then
  echo "✅ Contenido del backup: OK"
else
  echo "❌ Contenido del backup: FALLÓ"
  exit 1
fi

# Verificar último backup de Redis
LATEST_REDIS=$(ls -t "$BACKUP_DIR"/redis_*.rdb.gz 2>/dev/null | head -1)

if [ -z "$LATEST_REDIS" ]; then
  echo "⚠️  No hay backups de Redis"
else
  echo "✅ Backup Redis encontrado: $(basename "$LATEST_REDIS")"
  echo "   Tamaño: $(du -h "$LATEST_REDIS" | cut -f1)"

  # Verificar integridad
  if gzip -t "$LATEST_REDIS" 2>/dev/null; then
    echo "✅ Integridad del archivo: OK"
  else
    echo "❌ Integridad del archivo: FALLÓ"
  fi
fi

# Test restore en BD temporal
echo ""
echo "=== Test Restore (BD Temporal) ==="

# Crear BD temporal
docker exec "$PG_CONTAINER" createdb -U "$PG_USER" "$TEST_DB" 2>/dev/null

# Restaurar
if gunzip -c "$LATEST_PG" | docker exec -i "$PG_CONTAINER" pg_restore \
  -U "$PG_USER" \
  -d "$TEST_DB" \
  --clean \
  --if-exists \
  --no-owner \
  2>/dev/null; then

  echo "✅ Restore de prueba: OK"

  # Verificar tablas
  TABLE_COUNT=$(docker exec "$PG_CONTAINER" psql \
    -U "$PG_USER" \
    -d "$TEST_DB" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")

  echo "   Tablas restauradas: $TABLE_COUNT"
else
  echo "❌ Restore de prueba: FALLÓ"
fi

# Eliminar BD temporal
docker exec "$PG_CONTAINER" dropdb -U "$PG_USER" "$TEST_DB" 2>/dev/null

echo ""
echo "=== Verificación Completada ==="
```

### 7.2 Ejecutar Verificación

```bash
# Verificación manual
./scripts/verify-backup.sh

# Verificación programada (cron)
crontab -e
# Cada domingo a las 3 AM
0 3 * * 0 cd /home/deploy/sistema-reservas && ./scripts/verify-backup.sh >> /var/log/backup-verify.log 2>&1
```

### 7.3 Checklist de Verificación

```markdown
## Verificación Diaria

- [ ] Backup PostgreSQL más reciente < 24 horas
- [ ] Backup Redis más reciente < 24 horas
- [ ] Tamaño del backup dentro del rango esperado
- [ ] Upload a S3 completado

## Verificación Semanal

- [ ] Test de restore en BD temporal
- [ ] Verificar integridad de archivos (gzip -t)
- [ ] Verificar logs de backup sin errores
- [ ] Revisar espacio en disco disponible

## Verificación Mensual

- [ ] Restore completo en ambiente de staging
- [ ] Verificar RPO (Recovery Point Objective)
- [ ] Verificar RTO (Recovery Time Objective)
- [ ] Actualizar documentación de DR
```

### 7.4 Monitoreo de Backups

```bash
# Script: scripts/monitor-backups.sh
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-./backups}"
MAX_AGE_HOURS=25  # Alertar si backup tiene más de 25 horas

# Verificar último backup
LATEST=$(ls -t "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "CRITICAL: No hay backups de PostgreSQL"
  exit 2
fi

# Calcular edad del backup
LATEST_TIME=$(stat -c %Y "$LATEST")
NOW=$(date +%s)
AGE_HOURS=$(( (NOW - LATEST_TIME) / 3600 ))

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
  echo "WARNING: Último backup tiene $AGE_HOURS horas"
  exit 1
fi

echo "OK: Último backup tiene $AGE_HOURS horas"
exit 0
```

---

## 8. Disaster Recovery Plan

### 8.1 Escenarios de Desastre

#### Escenario 1: Caída de la VPS

```markdown
**Situación**: La VPS no responde (hardware failure, proveedor down)

**Impacto**:

- Sistema completamente inaccesible
- Datos en riesgo si no hay backups remotos

**RTO**: 1-2 horas
**RPO**: Último backup (máx 6 horas de datos)

**Procedimiento**:

1. Verificar que la VPS no responde
   - ping <vps-ip>
   - ssh deploy@<vps-ip>
   - Contactar soporte del proveedor

2. Provisionar nueva VPS
   - Crear nueva instancia con Ubuntu 22.04
   - Configurar SSH keys
   - Configurar firewall

3. Instalar Docker y dependencias
   - Seguir Fase 1 y Fase 2 de DEPLOY_VPS.md

4. Restaurar desde backup S3
   - aws s3 cp s3://bucket/backups/latest .
   - ./scripts/restore-db.sh

5. Actualizar DNS
   - Cambiar A record a nueva IP
   - Esperar propagación (5-30 min)

6. Verificar sistema
   - ./scripts/health-check.sh
   - Probar funcionalidades críticas

7. Post-mortem
   - Documentar causa raíz
   - Notificar a stakeholders
```

#### Escenario 2: Corrupción de Base de Datos

```markdown
**Situación**: Datos corruptos o perdidos en PostgreSQL

**Impacto**:

- Aplicación puede funcionar pero con datos incorrectos
- Posible pérdida de datos

**RTO**: 30-60 minutos
**RPO**: Último backup válido

**Procedimiento**:

1. Detener aplicación inmediatamente
   - docker compose -f docker-compose.prod.yml down

2. Identificar causa de corrupción
   - Revisar logs de PostgreSQL
   - docker logs sistema-reservas-db

3. Identificar último backup válido
   - ls -lt backups/pg\_\*.dump.gz
   - Verificar integridad: gzip -t backup.dump.gz

4. Restaurar backup
   - ./scripts/restore-db.sh --pg-backup <archivo>
   - Verificar restore: ./scripts/verify-backup.sh

5. Reiniciar servicios
   - docker compose -f docker-compose.prod.yml up -d

6. Verificar datos
   - Probar funcionalidades críticas
   - Verificar integridad referencial

7. Notificar a usuarios (si aplica)
   - Comunicar incidente
   - Informar datos afectados
```

#### Escenario 3: Ataque de Seguridad (Ransomware, Hack)

```markdown
**Situación**: Sistema comprometido por atacante

**Impacto**:

- Datos pueden estar expuestos
- Sistema puede estar comprometido

**RTO**: 2-4 horas
**RPO**: Último backup antes del ataque

**Procedimiento**:

1. Aislar sistema inmediatamente
   - Cortar acceso de red (firewall)
   - No apagar (preservar evidencia)

2. Evaluar daño
   - Revisar logs de acceso
   - Identificar punto de entrada
   - Determinar datos afectados

3. Notificar
   - Equipo de seguridad
   - Legal/compliance (si hay datos personales)
   - Autoridades (si aplica por ley)

4. Reconstruir desde cero
   - Nueva VPS (no reusar comprometida)
   - Rotar TODAS las credenciales
   - Revisar código en busca de backdoors

5. Restaurar datos
   - Usar backup ANTERIOR al ataque
   - Verificar integridad

6. Hardening adicional
   - Revisar firewall rules
   - Implementar 2FA
   - Auditar accesos

7. Post-mortem detallado
   - Documentar timeline
   - Identificar lecciones aprendidas
   - Implementar medidas preventivas
```

### 8.2 Procedimiento de Restore de Emergencia

```bash
#!/bin/bash
# scripts/emergency-restore.sh

set -euo pipefail

echo "╔══════════════════════════════════════════════════════════╗"
echo "║            RESTORE DE EMERGENCIA                         ║"
echo "╚══════════════════════════════════════════════════════════╝"

# Verificar backup más reciente
BACKUP_DIR="${BACKUP_DIR:-./backups}"
LATEST_PG=$(ls -t "$BACKUP_DIR"/pg_*.dump.gz 2>/dev/null | head -1)

if [ -z "$LATEST_PG" ]; then
  echo "❌ ERROR: No hay backups disponibles"
  exit 1
fi

echo "✅ Backup encontrado: $(basename "$LATEST_PG")"
echo "   Fecha: $(stat -c %y "$LATEST_PG")"
echo "   Tamaño: $(du -h "$LATEST_PG" | cut -f1)"
echo ""

# Confirmar restore
read -p "⚠️  ESTO SOBREESCRIBIRÁ LA BASE DE DATOS ACTUAL. ¿Continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelado"
  exit 0
fi

# Detener aplicación
echo "🔧 Deteniendo aplicación..."
docker compose -f docker-compose.prod.yml down

# Restaurar PostgreSQL
echo "🔧 Restaurando PostgreSQL..."
./scripts/restore-db.sh --pg-backup "$LATEST_PG" --force --skip-verify

# Restaurar Redis (opcional)
LATEST_REDIS=$(ls -t "$BACKUP_DIR"/redis_*.rdb.gz 2>/dev/null | head -1)
if [ -n "$LATEST_REDIS" ]; then
  echo "🔧 Restaurando Redis..."
  ./scripts/restore-db.sh --redis-backup "$LATEST_REDIS" --force --skip-verify
fi

# Iniciar aplicación
echo "🔧 Iniciando aplicación..."
docker compose -f docker-compose.prod.yml up -d

# Esperar servicios
echo "⏳ Esperando servicios..."
sleep 15

# Health check
echo "🔍 Ejecutando health check..."
./scripts/health-check.sh

if [ $? -eq 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  ✅ RESTORE DE EMERGENCIA COMPLETADO                     ║"
  echo "╚══════════════════════════════════════════════════════════╝"
else
  echo ""
  echo "❌ ERROR: Health check falló después del restore"
  exit 1
fi
```

### 8.3 Contactos de Emergencia

```markdown
## Equipo Técnico

- DevOps Lead: devops@email.com | +1-XXX-XXX-XXXX
- Backend Lead: backend@email.com | +1-XXX-XXX-XXXX
- CTO: cto@email.com | +1-XXX-XXX-XXXX

## Proveedores

- VPS Support: support@vps-provider.com | +1-800-XXX-XXXX
- Domain Registrar: support@registrar.com
- SSL Provider: support@letsencrypt.org

## Servicios Externos

- AWS Support: (si usas S3)
- Stripe Support: support@stripe.com
- Resend Support: support@resend.com

## Escalamiento

Nivel 1: Equipo de guardia (on-call)
Nivel 2: DevOps Lead
Nivel 3: CTO
```

### 8.4 Post-Mortem Template

```markdown
# Post-Mortem: [Nombre del Incidente]

## Resumen Ejecutivo

[2-3 líneas describiendo el incidente]

## Timeline

- **YYYY-MM-DD HH:MM** - Detectado el problema
- **YYYY-MM-DD HH:MM** - Equipo notificado
- **YYYY-MM-DD HH:MM** - Restore iniciado
- **YYYY-MM-DD HH:MM** - Sistema restaurado
- **YYYY-MM-DD HH:MM** - Incidente cerrado

## Impacto

- **Duración**: X horas Y minutos
- **Usuarios afectados**: X%
- **Datos perdidos**: Sí/No (cuántos)
- **Ingresos afectados**: $X

## Causa Raíz

[Descripción técnica de la causa]

## Acciones Correctivas

- [ ] Acción 1
- [ ] Acción 2
- [ ] Acción 3

## Lecciones Aprendidas

- Qué funcionó bien
- Qué se puede mejorar
- Qué se hará diferente

## Métricas

- **MTTD** (Mean Time to Detect): X minutos
- **MTTR** (Mean Time to Recover): X horas
- **RPO Achieved**: X horas de datos
```

### 8.5 Testing de Disaster Recovery

```markdown
## DR Test - Checklist Trimestral

### Preparación

- [ ] Agendar ventana de mantenimiento
- [ ] Notificar a stakeholders
- [ ] Preparar ambiente de testing
- [ ] Backup actual del production

### Ejecución

- [ ] Simular caída de VPS (apagar)
- [ ] Iniciar procedimiento de DR
- [ ] Cronometrar tiempo de recovery
- [ ] Verificar integridad de datos
- [ ] Ejecutar health checks

### Validación

- [ ] Todas las funcionalidades críticas operativas
- [ ] Datos consistentes y completos
- [ ] Performance dentro de SLA
- [ ] Monitoreo funcionando

### Documentación

- [ ] Actualizar runbooks si es necesario
- [ ] Documentar lecciones aprendidas
- [ ] Actualizar contactos de emergencia
- [ ] Reportar a stakeholders

### Métricas del Test

- **RTO Objetivo**: < 2 horas
- **RTO Real**: X horas
- **RPO Objetivo**: < 6 horas
- **RPO Real**: X horas
- **Issues encontrados**: [lista]
```

---

## Apéndice A: Comandos Rápidos

```bash
# Backup inmediato
./scripts/backup-db.sh

# Ver backups disponibles
ls -lht ./backups/*.gz

# Restore último backup
./scripts/restore-db.sh

# Verificar backup
./scripts/verify-backup.sh

# Health check
./scripts/health-check.sh

# Emergency restore
./scripts/emergency-restore.sh

# Upload a S3
aws s3 sync ./backups s3://bucket/backups

# Download desde S3
aws s3 cp s3://bucket/backups/latest.dump.gz .
```

## Apéndice B: Glosario

| Término                            | Definición                                                  |
| ---------------------------------- | ----------------------------------------------------------- |
| **RPO** (Recovery Point Objective) | Máxima cantidad de datos que se pueden perder (ej: 6 horas) |
| **RTO** (Recovery Time Objective)  | Tiempo máximo para recuperar el servicio (ej: 2 horas)      |
| **Backup completo**                | Copia completa de todos los datos                           |
| **Backup incremental**             | Copia solo de cambios desde último backup                   |
| **Backup diferencial**             | Copia de cambios desde último backup completo               |
| **DR** (Disaster Recovery)         | Proceso de recuperación ante desastres                      |
| **Failover**                       | Cambio automático a sistema redundante                      |
| **Cold standby**                   | Sistema de backup que requiere activación manual            |
| **Hot standby**                    | Sistema de backup siempre activo y sincronizado             |

---

**Última actualización**: Marzo 2026
**Versión**: 1.0.0
