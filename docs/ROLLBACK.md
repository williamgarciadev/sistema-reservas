# Rollback Procedures

Procedimientos para revertir cambios en la aplicación, base de datos y configuración.

## Índice

1. [Cuándo Hacer Rollback](#1-cuándo-hacer-rollback)
2. [Rollback de Aplicación](#2-rollback-de-aplicación)
3. [Rollback de Base de Datos](#3-rollback-de-base-de-datos)
4. [Rollback de Configuración](#4-rollback-de-configuración)
5. [Rollback de Infraestructura](#5-rollback-de-infraestructura)
6. [Post-Rollback Checklist](#6-post-rollback-checklist)

---

## 1. Cuándo Hacer Rollback

### 1.1 Criterios de Rollback

```markdown
## Hacer Rollback Inmediatamente Si:

### Critical (Rollback automático)

- [ ] Error 500 en > 10% de requests
- [ ] Health check falla por > 5 minutos
- [ ] Base de datos no responde
- [ ] Pérdida de datos detectada
- [ ] Brecha de seguridad confirmada
- [ ] Performance degrade > 50%

### High (Rollback en < 30 min)

- [ ] Feature crítica no funcional
- [ ] Error en flujo de pagos
- [ ] Emails/SMS no se envían
- [ ] Login no funciona
- [ ] Data corruption menor
- [ ] Memory leak detectado

### Medium (Evaluar rollback)

- [ ] Bugs UI menores
- [ ] Performance degrade < 20%
- [ ] Feature no crítica rota
- [ ] Errores en logs < 1%

### Low (No requiere rollback)

- [ ] Typos en textos
- [ ] Issues cosméticos
- [ ] Features experimentales
```

### 1.2 Decision Tree

```
                    ¿Error en producción?
                           │
                           ▼
                    ¿Afecta usuarios?
                    ┌─────┴─────┐
                    │           │
                   Sí          No
                    │           │
                    ▼           ▼
            ¿Error crítico?  Monitorear
            ┌─────┴─────┐
            │           │
           Sí          No
            │           │
            ▼           ▼
    ┌───────────────┐   ¿Feature nueva?
    │ ROLLBACK      │   ┌─────┴─────┐
    │ INMEDIATO     │   │           │
    └───────────────┘  Sí          No
                        │           │
                        ▼           ▼
                ¿Se puede fixear  Hotfix
                en < 30 min?      ┌─────┴─────┐
                ┌─────┴─────┐     │           │
                │           │    Sí          No
               Sí          No     │           │
                │           │     ▼           ▼
                ▼           ▼  Hotfix    ROLLBACK
            Hotfix     ROLLBACK
```

### 1.3 Matriz de Decisión

| Escenario                 | Acción              | Tiempo Máx | Responsable  |
| ------------------------- | ------------------- | ---------- | ------------ |
| Error 500 > 10%           | Rollback automático | 5 min      | On-call      |
| Pagos fallando            | Rollback inmediato  | 15 min     | DevOps       |
| Login no funciona         | Rollback inmediato  | 15 min     | DevOps       |
| Data corruption           | Rollback + restore  | 30 min     | DevOps + DBA |
| Performance > 50% degrade | Rollback            | 30 min     | DevOps       |
| Bug UI menor              | Hotfix              | 4 horas    | Dev team     |
| Typos                     | Hotfix              | 24 horas   | Dev team     |

---

## 2. Rollback de Aplicación

### 2.1 Rollback con Docker

```bash
# Ver imágenes disponibles
docker images | grep sistema-reservas

# Listar contenedores running
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# Rollback a versión anterior (si existe)
docker compose -f docker-compose.prod.yml down

# Especificar tag anterior en docker-compose.yml
# Cambiar de:
#   image: sistema-reservas-backend:latest
# a:
#   image: sistema-reservas-backend:v1.2.3

# Reiniciar con versión anterior
docker compose -f docker-compose.prod.yml up -d

# Verificar
docker ps
./scripts/health-check.sh
```

### 2.2 Rollback con Git

```bash
# En la VPS
cd ~/sistema-reservas

# Ver commits recientes
git log --oneline -10

# Identificar commit anterior (antes del deploy problemático)
git log --oneline --grep="deploy\|build"

# Hacer checkout al commit anterior
git fetch origin
git checkout <commit-hash-anterior>

# Rebuild y restart
docker compose -f docker-compose.prod.yml build --parallel
docker compose -f docker-compose.prod.yml up -d

# Ejecutar migraciones (si aplica)
docker exec sistema-reservas-backend npx prisma migrate deploy

# Verificar
./scripts/health-check.sh
```

### 2.3 Rollback con CI/CD

```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      target_version:
        description: "Versión a la que volver (tag o commit hash)"
        required: true
      reason:
        description: "Razón del rollback"
        required: true

jobs:
  rollback:
    name: Rollback to ${{ github.event.inputs.target_version }}
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.target_version }}

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}

      - name: Execute Rollback
        run: |
          ssh -p ${{ secrets.VPS_PORT }} ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'ENDSSH'
            cd ~/sistema-reservas
            
            # Stop current version
            docker compose -f docker-compose.prod.yml down
            
            # Checkout target version
            git fetch origin
            git checkout ${{ github.event.inputs.target_version }}
            
            # Rebuild
            docker compose -f docker-compose.prod.yml build --parallel
            
            # Deploy
            docker compose -f docker-compose.prod.yml up -d
            
            # Migrations
            docker exec sistema-reservas-backend npx prisma migrate deploy || true
            
            # Health check
            sleep 10
            ./scripts/health-check.sh
          ENDSSH

      - name: Notify
        uses: slackapi/slack-github-action@v1.23.0
        with:
          payload: |
            {
              "text": "🔄 Rollback completado\n*Versión*: ${{ github.event.inputs.target_version }}\n*Razón*: ${{ github.event.inputs.reason }}\n*Por*: ${{ github.actor }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2.4 Script de Rollback Automático

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging
log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Variables
TARGET_VERSION="${1:-}"
REASON="${2:-No especificada}"
BACKUP_BEFORE_ROLLBACK=true

# Usage
if [ -z "$TARGET_VERSION" ]; then
  echo -e "${RED}Uso: $0 <target_version> [reason]${NC}"
  echo ""
  echo "Ejemplos:"
  echo "  $0 v1.2.3"
  echo "  $0 v1.2.3 \"Pagos fallando en producción\""
  echo ""
  echo "Versiones disponibles:"
  git tag --sort=-creatordate | head -10
  exit 1
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ROLLBACK DE APLICACIÓN                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
log_info "Versión target: $TARGET_VERSION"
log_info "Razón: $REASON"
log_info "Backup antes de rollback: $BACKUP_BEFORE_ROLLBACK"
echo ""

# Confirmar rollback
read -p "⚠️  ¿Confirmar rollback a $TARGET_VERSION? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  log_info "Rollback cancelado"
  exit 0
fi

# Backup antes de rollback
if [ "$BACKUP_BEFORE_ROLLBACK" = true ]; then
  log_info "Creando backup antes del rollback..."
  ./scripts/backup-db.sh --skip-redis
  echo ""
fi

# Checkout a la versión target
log_info "Checkout a $TARGET_VERSION..."
if git rev-parse "$TARGET_VERSION" >/dev/null 2>&1; then
  git checkout "$TARGET_VERSION"
  log_success "Checkout completado"
else
  log_error "Versión no encontrada: $TARGET_VERSION"
  exit 1
fi
echo ""

# Rebuild
log_info "Reconstruyendo imágenes..."
docker compose -f docker-compose.prod.yml build --parallel
log_success "Build completado"
echo ""

# Stop servicios actuales
log_info "Deteniendo servicios actuales..."
docker compose -f docker-compose.prod.yml down
log_success "Servicios detenidos"
echo ""

# Start nueva versión
log_info "Iniciando versión $TARGET_VERSION..."
docker compose -f docker-compose.prod.yml up -d
log_success "Servicios iniciados"
echo ""

# Esperar servicios
log_info "Esperando servicios (15s)..."
sleep 15
echo ""

# Health check
log_info "Ejecutando health check..."
if ./scripts/health-check.sh --quiet; then
  log_success "Health check: OK"
else
  log_error "Health check: FALLÓ"
  echo ""
  log_warning "El rollback puede haber fallado. Verificar manualmente."
  exit 1
fi
echo ""

# Log rollback
log_info "Registrando rollback en logs..."
echo "$(date -Iseconds) ROLLBACK: $TARGET_VERSION - Reason: $REASON" >> /var/log/rollbacks.log

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ ROLLBACK COMPLETADO                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
log_info "Versión anterior: $(git describe --tags --always $(git rev-parse @{-1}) 2>/dev/null || echo 'unknown')"
log_info "Versión actual: $(git describe --tags --always)"
```

### 2.5 Ejecutar Rollback

```bash
# Ver versiones disponibles
git tag --sort=-creatordate | head -10

# Rollback interactivo
./scripts/rollback.sh

# Rollback a versión específica
./scripts/rollback.sh v1.2.3 "Pagos fallando"

# Rollback al commit anterior
./scripts/rollback.sh HEAD~1 "Bug crítico"
```

---

## 3. Rollback de Base de Datos

### 3.1 Cuándo Hacer Rollback de DB

```markdown
## Escenarios que Requieren Rollback de DB

### Migraciones Problemáticas

- [ ] Migración falló a mitad de ejecución
- [ ] Migración corruptó datos
- [ ] Migración eliminó datos por error
- [ ] Schema incompatible con versión anterior

### Data Corruption

- [ ] Datos incorrectos insertados/actualizados
- [ ] Bugs en la aplicación corrompieron datos
- [ ] Attack/SQL injection

### Performance

- [ ] Índices faltantes causan lentitud extrema
- [ ] Query plans cambian dramáticamente
```

### 3.2 Rollback de Migraciones Prisma

```bash
# Ver historial de migraciones
docker exec sistema-reservas-backend npx prisma migrate status

# Rollback de última migración
docker exec sistema-reservas-backend npx prisma migrate resolve \
  --rolled-back "20240101120000_migration_name"

# Rollback manual (paso a paso)
docker exec sistema-reservas-backend npx prisma migrate down

# Rollback a un punto específico
docker exec sistema-reservas-backend npx prisma migrate resolve \
  --rolled-back "20231201120000_target_migration"
```

### 3.3 Rollback desde Backup

```bash
# Listar backups disponibles
./scripts/restore-db.sh --help

# Identificar backup anterior al problema
ls -lt ./backups/pg_*.dump.gz

# Verificar backup
gzip -t ./backups/pg_YYYYMMDD_HHMMSS.dump.gz

# Restaurar backup específico
./scripts/restore-db.sh \
  --pg-backup ./backups/pg_YYYYMMDD_HHMMSS.dump.gz \
  --force

# Verificar restore
docker exec sistema-reservas-db psql \
  -U postgres \
  -d sistema_reservas \
  -c "SELECT COUNT(*) FROM users"
```

### 3.4 Rollback con Point-in-Time Recovery

```bash
# Si tienes WAL archiving habilitado

# 1. Identificar timestamp del incidente
#    Ej: 2024-01-01 15:30:00

# 2. Restaurar backup más reciente antes del incidente
./scripts/restore-db.sh --pg-backup ./backups/pg_20240101_120000.dump.gz

# 3. Aplicar WAL logs hasta el punto deseado
#    (requiere configuración de archive_mode = on)

# 4. Verificar datos en el punto recovery
docker exec sistema-reservas-db psql \
  -U postgres \
  -d sistema_reservas \
  -c "SELECT * FROM appointments WHERE created_at > '2024-01-01 15:00:00'"
```

### 3.5 Rollback Parcial (Tablas Específicas)

```bash
# Exportar tabla específica desde backup
gunzip -c backup.dump.gz | pg_restore \
  -U postgres \
  -d sistema_reservas \
  -t users \
  --data-only \
  --inserts > users_restore.sql

# Restaurar tabla específica
docker exec -i sistema-reservas-db psql \
  -U postgres \
  -d sistema_reservas \
  < users_restore.sql

# Verificar
docker exec sistema-reservas-db psql \
  -U postgres \
  -d sistema_reservas \
  -c "SELECT COUNT(*) FROM users"
```

### 3.6 Script de Rollback de DB

```bash
#!/bin/bash
# scripts/rollback-db.sh

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Variables
TARGET_BACKUP="${1:-}"
SKIP_CONFIRM="${2:-false}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ROLLBACK DE BASE DE DATOS                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Listar backups si no se especificó
if [ -z "$TARGET_BACKUP" ]; then
  log_info "Backups disponibles:"
  echo ""
  ls -lht ./backups/pg_*.dump.gz 2>/dev/null | head -10
  echo ""
  read -p "Ingrese nombre del backup a restaurar: " TARGET_BACKUP
  TARGET_BACKUP="./backups/$TARGET_BACKUP"
fi

# Verificar backup existe
if [ ! -f "$TARGET_BACKUP" ]; then
  log_error "Backup no encontrado: $TARGET_BACKUP"
  exit 1
fi

log_info "Backup seleccionado: $(basename "$TARGET_BACKUP")"
log_info "Fecha: $(stat -c %y "$TARGET_BACKUP")"
log_info "Tamaño: $(du -h "$TARGET_BACKUP" | cut -f1)"
echo ""

# Confirmar
if [ "$SKIP_CONFIRM" != "true" ]; then
  log_warning "⚠️  ESTO SOBREESCRIBIRÁ LA BASE DE DATOS ACTUAL"
  read -p "¿Continuar con el rollback? (yes/no): " confirm

  if [ "$confirm" != "yes" ]; then
    log_info "Rollback cancelado"
    exit 0
  fi
fi

# Backup del estado actual (por si acaso)
log_info "Creando backup del estado actual..."
./scripts/backup-db.sh --skip-redis
echo ""

# Detener aplicación para evitar escrituras
log_info "Deteniendo aplicación..."
docker compose -f docker-compose.prod.yml down
echo ""

# Restaurar backup
log_info "Restaurando backup..."
./scripts/restore-db.sh --pg-backup "$TARGET_BACKUP" --force --skip-verify
echo ""

# Iniciar aplicación
log_info "Iniciando aplicación..."
docker compose -f docker-compose.prod.yml up -d
echo ""

# Esperar servicios
log_info "Esperando servicios (15s)..."
sleep 15
echo ""

# Health check
log_info "Ejecutando health check..."
if ./scripts/health-check.sh --quiet; then
  log_success "Health check: OK"
else
  log_error "Health check: FALLÓ"
  exit 1
fi

echo ""
log_info "Registrando rollback..."
echo "$(date -Iseconds) DB_ROLLBACK: $(basename "$TARGET_BACKUP")" >> /var/log/rollbacks.log

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ ROLLBACK DE BASE DE DATOS COMPLETADO                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
```

---

## 4. Rollback de Configuración

### 4.1 Rollback de Variables de Entorno

```bash
# En la VPS
cd ~/sistema-reservas

# Ver cambios recientes en .env
git diff HEAD~1 .env

# Restaurar .env anterior
git checkout HEAD~1 -- .env

# O editar manualmente
nano .env

# Restart servicios para aplicar cambios
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Verificar
docker exec sistema-reservas-backend printenv | grep -E "JWT|DATABASE"
```

### 4.2 Rollback de docker-compose.yml

```bash
# Ver cambios recientes
git diff HEAD~1 docker-compose.prod.yml

# Restaurar versión anterior
git checkout HEAD~1 -- docker-compose.prod.yml

# Rebuild si es necesario
docker compose -f docker-compose.prod.yml build

# Restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### 4.3 Rollback de Traefik

```bash
# Ver cambios en configuración
git diff HEAD~1 traefik/traefik.yml
git diff HEAD~1 traefik/dynamic/middlewares.yml

# Restaurar configuración anterior
git checkout HEAD~1 -- traefik/traefik.yml
git checkout HEAD~1 -- traefik/dynamic/middlewares.yml

# Reload Traefik (sin downtime)
docker exec sistema-reservas-proxy kill -SIGHUP 1

# O restart completo
docker restart sistema-reservas-proxy

# Verificar
curl -I https://reservas.tudominio.com
```

### 4.4 Rollback de Configuración de Redis

```bash
# Ver configuración actual
docker exec sistema-reservas-redis redis-cli CONFIG GET '*'

# Restaurar configuración anterior (en docker-compose.yml)
# Editar el comando de redis:
# command: redis-server --appendonly yes --maxmemory 256mb

# Restart Redis
docker restart sistema-reservas-redis

# Verificar
docker exec sistema-reservas-redis redis-cli INFO
```

### 4.5 Rollback de Configuración de PostgreSQL

```bash
# Ver configuración actual
docker exec sistema-reservas-db psql \
  -U postgres \
  -c "SHOW ALL"

# Restaurar postgresql.conf anterior (si está montado)
# docker exec sistema-reservas-db cat /var/lib/postgresql/data/postgresql.conf

# Restart PostgreSQL
docker restart sistema-reservas-db

# Verificar
docker exec sistema-reservas-db pg_isready
```

---

## 5. Rollback de Infraestructura

### 5.1 Rollback de DNS

```bash
# Si el problema es después de cambiar DNS

# Verificar DNS actual
dig reservas.tudominio.com
dig api.reservas.tudominio.com

# Revertir en el panel de DNS del proveedor
# Cambiar A record a la IP anterior

# Verificar propagación
watch dig reservas.tudominio.com

# Forzar refresh local
sudo systemd-resolve --flush-caches
```

### 5.2 Rollback de SSL/TLS

```bash
# Si hay problemas con certificados SSL

# Ver certificados actuales
docker exec sistema-reservas-proxy ls -la /letsencrypt/

# Ver detalles
echo | openssl s_client -connect reservas.tudominio.com:443 2>/dev/null | openssl x509 -noout -dates

# Forzar renovación
docker exec sistema-reservas-proxy traefik traefik-job certificates renew

# O eliminar y regenerar
docker exec sistema-reservas-proxy rm /letsencrypt/acme.json
docker restart sistema-reservas-proxy

# Verificar
curl -vI https://reservas.tudominio.com
```

### 5.3 Rollback de Firewall

```bash
# Si hay problemas de conectividad

# Ver reglas actuales
ufw status verbose

# Restaurar reglas anteriores
# (deberían estar versionadas en git)
git checkout HEAD~1 -- docs/FIREWALL_RULES.md

# Aplicar reglas
ufw disable
ufw enable

# Verificar
ufw status
```

### 5.4 Rollback de Docker Network

```bash
# Si hay problemas de red entre contenedores

# Ver redes
docker network ls

# Inspeccionar red
docker network inspect web
docker network inspect internal

# Recrear redes
docker compose -f docker-compose.prod.yml down
docker network rm web internal
docker compose -f docker-compose.prod.yml up -d

# Verificar conectividad
docker exec sistema-reservas-backend ping -c 3 sistema-reservas-db
docker exec sistema-reservas-backend ping -c 3 sistema-reservas-redis
```

---

## 6. Post-Rollback Checklist

### 6.1 Verificación Inmediata (5 min)

```markdown
## Health Check

- [ ] `./scripts/health-check.sh` pasa
- [ ] Todos los contenedores running
- [ ] Health checks de Docker passing

## Endpoints Críticos

- [ ] Frontend carga (https://reservas.dominio.com)
- [ ] API responde (https://api.dominio.com/health)
- [ ] Login funciona
- [ ] Dashboard accesible

## Logs

- [ ] No hay errores críticos en logs
- [ ] Verificar: `docker logs --tail 100 sistema-reservas-backend`
- [ ] Verificar: `docker logs --tail 100 sistema-reservas-frontend`
```

### 6.2 Verificación Funcional (15 min)

```markdown
## Flujos Críticos

- [ ] Usuario puede registrarse
- [ ] Usuario puede loguearse
- [ ] Usuario puede crear cita
- [ ] Usuario puede ver citas
- [ ] Usuario puede cancelar cita
- [ ] Pagos procesan correctamente (si aplica)
- [ ] Emails se envían

## Admin

- [ ] Admin puede acceder al panel
- [ ] Admin puede ver usuarios
- [ ] Admin puede ver citas
- [ ] Admin puede exportar datos
```

### 6.3 Verificación de Datos (30 min)

````markdown
## Integridad de Datos

- [ ] Conteo de usuarios correcto
- [ ] Conteo de citas correcto
- [ ] No hay datos duplicados
- [ ] No hay datos corruptos
- [ ] Relaciones entre tablas intactas

## Queries de Verificación

```sql
-- Verificar usuarios
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM users WHERE role = 'admin';

-- Verificar citas
SELECT COUNT(*) FROM appointments;
SELECT COUNT(*) FROM appointments WHERE status = 'confirmed';

-- Verificar integridad
SELECT u.*, COUNT(a.id) as appointment_count
FROM users u
LEFT JOIN appointments a ON u.id = a.user_id
GROUP BY u.id
HAVING COUNT(a.id) = 0;
```
````

````

### 6.4 Verificación de Performance (1 hora)

```markdown
## Métricas
- [ ] Response time < 500ms (p95)
- [ ] Error rate < 0.1%
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] Disk I/O normal

## Herramientas
- [ ] `docker stats` - recursos normales
- [ ] `htop` - carga de CPU normal
- [ ] Dashboard de monitoreo - todas las métricas OK
````

### 6.5 Comunicación (2 horas)

```markdown
## Notificaciones

- [ ] Notificar al equipo de rollback completado
- [ ] Actualizar status page (si aplica)
- [ ] Notificar a stakeholders
- [ ] Documentar en Slack/Teams

## Template de Comunicación
```

Asunto: [RESUELTO] Incidente en producción - Rollback completado

Equipo,

El incidente detectado a las [HH:MM] ha sido resuelto mediante rollback
a la versión [X.X.X].

**Impacto**: [Descripción breve]
**Duración**: X minutos
**Causa raíz**: [Descripción]
**Acciones tomadas**: Rollback a versión estable

El sistema está operando normalmente. Se realizará post-mortem en las
próximas 24 horas.

Gracias,
[Nombre]

```

```

### 6.6 Post-Mortem (24-48 horas)

```markdown
## Reunión de Post-Mortem

### Participantes

- [ ] DevOps
- [ ] Dev Team
- [ ] QA
- [ ] Product Owner (si aplica)

### Agenda

1. Timeline del incidente (5 min)
2. Causa raíz (10 min)
3. Qué funcionó bien (5 min)
4. Qué se puede mejorar (15 min)
5. Action items (10 min)

### Action Items Template

| Acción                   | Responsable | Deadline   | Estado  |
| ------------------------ | ----------- | ---------- | ------- |
| Fix bug en feature X     | @dev1       | YYYY-MM-DD | Pending |
| Mejorar tests E2E        | @qa1        | YYYY-MM-DD | Pending |
| Implementar feature flag | @dev2       | YYYY-MM-DD | Pending |
| Actualizar runbook       | @devops     | YYYY-MM-DD | Pending |
```

### 6.7 Template de Post-Mortem

```markdown
# Post-Mortem: [Nombre del Incidente]

**Fecha**: YYYY-MM-DD
**Duración**: X horas Y minutos
**Severidad**: Critical/High/Medium/Low
**Author**: [Nombre]

## Resumen Ejecutivo

[2-3 párrafos describiendo el incidente, impacto y resolución]

## Timeline (UTC)

| Hora  | Evento                      |
| ----- | --------------------------- |
| HH:MM | Deploy de versión X.X.X     |
| HH:MM | Primeros errores detectados |
| HH:MM | Equipo notificado           |
| HH:MM | Rollback iniciado           |
| HH:MM | Rollback completado         |
| HH:MM | Sistema verificado          |

## Impacto

- **Usuarios afectados**: X%
- **Requests fallidos**: X (Y%)
- **Ingresos afectados**: $X (estimado)
- **SLA impactado**: Sí/No

## Causa Raíz

[Descripción técnica detallada de la causa raíz]

### ¿Por qué pasó?

[5 Whys analysis]

1. ¿Por qué [problema]? → [respuesta]
2. ¿Por qué [respuesta anterior]? → [respuesta]
3. ¿Por qué [respuesta anterior]? → [respuesta]
4. ¿Por qué [respuesta anterior]? → [respuesta]
5. ¿Por qué [respuesta anterior]? → [causa raíz]

## Qué Funcionó Bien

- [ ] Detección rápida del problema
- [ ] Rollback procedure funcionó
- [ ] Equipo respondió rápidamente
- [ ] Backups estaban disponibles

## Qué se Puede Mejorar

- [ ] Tests automatizados para este caso
- [ ] Feature flags para rollout gradual
- [ ] Mejor monitoreo de [métrica]
- [ ] Documentación del runbook

## Action Items

| ID  | Acción   | Tipo       | Responsable | Deadline | Estado      |
| --- | -------- | ---------- | ----------- | -------- | ----------- |
| 1   | [Acción] | Preventive | @user       | date     | Done        |
| 2   | [Acción] | Detective  | @user       | date     | In Progress |
| 3   | [Acción] | Corrective | @user       | date     | Pending     |

## Lecciones Aprendidas

1. [Lección 1]
2. [Lección 2]
3. [Lección 3]

## Métricas

- **MTTD** (Mean Time to Detect): X minutos
- **MTTR** (Mean Time to Recover): X minutos
- **MTBF** (Mean Time Between Failures): X días

## Anexos

- [ ] Logs relevantes
- [ ] Screenshots de dashboards
- [ ] Grafana links
- [ ] Related PRs/commits
```

---

## Apéndice A: Comandos Rápidos de Rollback

```bash
# Rollback de aplicación
./scripts/rollback.sh v1.2.3 "Razón del rollback"

# Rollback de base de datos
./scripts/rollback-db.sh ./backups/pg_YYYYMMDD_HHMMSS.dump.gz

# Ver versiones disponibles
git tag --sort=-creatordate | head -10

# Ver backups disponibles
ls -lht ./backups/pg_*.dump.gz | head -10

# Health check post-rollback
./scripts/health-check.sh

# Ver logs recientes
docker logs --tail 100 sistema-reservas-backend

# Verificar datos
docker exec sistema-reservas-db psql -U postgres -d sistema_reservas -c "SELECT COUNT(*) FROM users"
```

## Apéndice B: Contactos de Emergencia

```markdown
## Equipo de Guardia

- On-call: oncall@email.com | +1-XXX-XXX-XXXX
- DevOps: devops@email.com
- Backend: backend@email.com

## Escalamiento

- Nivel 1: On-call (0-15 min)
- Nivel 2: DevOps Lead (15-30 min)
- Nivel 3: CTO (30+ min)

## Canales

- Slack: #incidentes
- Email: incidentes@empresa.com
- Status Page: status.tudominio.com
```

---

**Última actualización**: Marzo 2026
**Versión**: 1.0.0
