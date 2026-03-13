# 📋 TASK BREAKDOWN: VPS Deploy - Sistema de Reservas

**Change**: sistema-reservas-vps-deploy  
**Phase**: Tasks  
**Status**: ✅ Completed  
**Date**: 2026-03-13  
**Based on**: spec.md v1.0, design.md v1.0  
**Total Estimated Time**: 10-13 horas

---

## Tabla de Tareas

| ID                                           | Task                                 | Descripción                                                         | Estimación | Dependencias    | Archivos                           | Criterio Aceptación                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- | ---------- | --------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FASE 1: PREPARACIÓN VPS (2-3 horas)**      |
| VPS-01                                       | Configurar VPS Ubuntu 22.04          | Provisionar VPS, actualizar sistema, crear usuario no-root con sudo | 30 min     | -               | -                                  | ✅ VPS con Ubuntu 22.04 LTS<br>✅ Updates aplicados<br>✅ Usuario `deploy` creado<br>✅ SSH key configurada<br>✅ Root login deshabilitado                                         |
| VPS-02                                       | Instalar Docker + Docker Compose     | Instalar Docker Engine y Docker Compose v2                          | 30 min     | VPS-01          | -                                  | ✅ Docker v24+ instalado<br>✅ Docker Compose v2+ instalado<br>✅ Usuario `deploy` en grupo docker<br>✅ Docker service habilitado                                                 |
| VPS-03                                       | Configurar firewall UFW              | Configurar reglas de firewall (SSH, HTTP, HTTPS)                    | 20 min     | VPS-02          | -                                  | ✅ UFW activo<br>✅ Puerto 22 (SSH) abierto<br>✅ Puertos 80/443 abiertos<br>✅ Resto de puertos bloqueados                                                                        |
| VPS-04                                       | Configurar fail2ban                  | Instalar y configurar fail2ban para proteger SSH                    | 25 min     | VPS-03          | `/etc/fail2ban/jail.local`         | ✅ fail2ban instalado<br>✅ SSH jail activo<br>✅ 5 intentos fallidos → ban 1 hora<br>✅ Email de notificación configurado                                                         |
| VPS-05                                       | Hardening SSH                        | Configurar SSH con mejores prácticas de seguridad                   | 25 min     | VPS-01          | `/etc/ssh/sshd_config`             | ✅ Root login deshabilitado<br>✅ Password auth deshabilitado<br>✅ Solo SSH keys permitidas<br>✅ Puerto 22 cambiado (opcional)<br>✅ MaxAuthTries=3                              |
| **FASE 2: DOCKER & TRAEFIK (3-4 horas)**     |
| VPS-06                                       | Crear docker-compose.prod.yml        | Configurar servicios: PostgreSQL, Redis, Backend, Frontend, Traefik | 45 min     | VPS-02          | `docker-compose.prod.yml`          | ✅ Todos los servicios definidos<br>✅ Networks configurados<br>✅ Volumes persistentes<br>✅ Health checks configurados<br>✅ Restart policies                                    |
| VPS-07                                       | Crear configuración Traefik estática | Configurar Traefik (providers, entrypoints, certificates)           | 30 min     | VPS-06          | `traefik/traefik.yml`              | ✅ Providers Docker habilitado<br>✅ Entrypoints web (80) y websecure (443)<br>✅ Let's Encrypt configurado<br>✅ Dashboard habilitado (interno)                                   |
| VPS-08                                       | Crear configuración Traefik dinámica | Configurar routers, middlewares, services para backend/frontend     | 30 min     | VPS-07          | `traefik/dynamic/`                 | ✅ Router backend configurado<br>✅ Router frontend configurado<br>✅ Middleware HTTPS redirect<br>✅ Middleware security headers<br>✅ Rate limiting configurado                  |
| VPS-09                                       | Crear Dockerfile backend             | Dockerfile multi-stage para backend Express.js                      | 30 min     | VPS-06          | `backend/Dockerfile`               | ✅ Multi-stage build (build + runtime)<br>✅ Node.js 20-alpine<br>✅ Non-root user<br>✅ Health check endpoint<br>✅ Optimized layers                                              |
| VPS-10                                       | Crear Dockerfile frontend            | Dockerfile multi-stage para frontend Next.js                        | 30 min     | VPS-06          | `frontend/Dockerfile`              | ✅ Multi-stage build (build + runner)<br>✅ Node.js 20-alpine<br>✅ Next.js standalone mode<br>✅ Non-root user<br>✅ Health check endpoint                                        |
| VPS-11                                       | Testear configuración localmente     | Validar docker-compose y Traefik en entorno local                   | 45 min     | VPS-06 a VPS-10 | -                                  | ✅ `docker-compose up` sin errores<br>✅ Todos los servicios health=healthy<br>✅ Traefik dashboard accesible<br>✅ Backend responde en /health<br>✅ Frontend responde en /       |
| **FASE 3: CI/CD GITHUB ACTIONS (2-3 horas)** |
| VPS-12                                       | Crear workflow ci.yml                | CI pipeline: lint, test, build para backend y frontend              | 40 min     | -               | `.github/workflows/ci.yml`         | ✅ Trigger en push/PR a main<br>✅ Lint backend y frontend<br>✅ Test backend (Vitest)<br>✅ Test frontend (Playwright)<br>✅ Build backend y frontend<br>✅ Cache de dependencias |
| VPS-13                                       | Crear workflow deploy-vps.yml        | CD pipeline: build, push, deploy a VPS                              | 45 min     | VPS-12          | `.github/workflows/deploy-vps.yml` | ✅ Trigger en push a main<br>✅ Build Docker images<br>✅ Push a Docker Registry (GHCR)<br>✅ SSH a VPS<br>✅ Pull images + docker-compose up -d<br>✅ Health check post-deploy    |
| VPS-14                                       | Configurar GitHub Secrets            | Configurar secrets para CI/CD                                       | 20 min     | VPS-13          | -                                  | ✅ DOCKER_REGISTRY_URL<br>✅ DOCKER_USERNAME<br>✅ DOCKER_PASSWORD<br>✅ VPS_HOST<br>✅ VPS_USERNAME<br>✅ VPS_SSH_KEY<br>✅ DATABASE_URL<br>✅ REDIS_URL<br>✅ JWT_SECRET         |
| VPS-15                                       | Testear pipeline completo            | Ejecutar CI/CD end-to-end                                           | 35 min     | VPS-12 a VPS-14 | -                                  | ✅ CI pasa en PR<br>✅ CD deploya automáticamente<br>✅ Imágenes en GHCR<br>✅ Servicios en VPS running<br>✅ Health checks passing                                                |
| **FASE 4: SCRIPTS DE OPERACIÓN (2 horas)**   |
| VPS-16                                       | Crear backup-db.sh                   | Script para backup automático de PostgreSQL                         | 30 min     | VPS-06          | `scripts/backup-db.sh`             | ✅ Backup a archivo con timestamp<br>✅ Compresión gzip<br>✅ Retención: 7 días<br>✅ Log de backups<br>✅ Exit codes correctos                                                    |
| VPS-17                                       | Crear restore-db.sh                  | Script para restaurar backup de PostgreSQL                          | 30 min     | VPS-16          | `scripts/restore-db.sh`            | ✅ Restaurar desde archivo<br>✅ Validar archivo existe<br>✅ Drop + create database<br>✅ Log de restauración<br>✅ Exit codes correctos                                          |
| VPS-18                                       | Crear deploy-manual.sh               | Script para deploy manual en VPS                                    | 25 min     | VPS-06          | `scripts/deploy-manual.sh`         | ✅ Pull imágenes<br>✅ Stop servicios<br>✅ Start servicios<br>✅ Health check<br>✅ Rollback automático si falla                                                                  |
| VPS-19                                       | Configurar cron para backups         | Programar backups automáticos diarios                               | 15 min     | VPS-16          | `crontab -e`                       | ✅ Cron job configurado (2 AM diario)<br>✅ Backup se ejecuta automáticamente<br>✅ Email de cron configurado<br>✅ Backups en `/var/backups/postgres/`                            |
| **FASE 5: DOCUMENTACIÓN (1 hora)**           |
| VPS-20                                       | Crear DEPLOY_VPS.md                  | Documentación completa de deployment en VPS                         | 20 min     | -               | `docs/DEPLOY_VPS.md`               | ✅ Requisitos previos<br>✅ Paso a paso de deployment<br>✅ Configuración de variables<br>✅ Troubleshooting común<br>✅ Comandos útiles                                           |
| VPS-21                                       | Crear BACKUP_RESTORE.md              | Documentación de procedimientos de backup y restore                 | 15 min     | VPS-16, VPS-17  | `docs/BACKUP_RESTORE.md`           | ✅ Cómo hacer backup manual<br>✅ Cómo restaurar backup<br>✅ Cómo verificar integridad<br>✅ Frecuencia recomendada                                                               |
| VPS-22                                       | Crear ROLLBACK.md                    | Documentación de procedimiento de rollback                          | 15 min     | VPS-18          | `docs/ROLLBACK.md`                 | ✅ Cuándo hacer rollback<br>✅ Rollback automático (script)<br>✅ Rollback manual (paso a paso)<br>✅ Verificar rollback exitoso                                                   |
| VPS-23                                       | Actualizar README.md                 | Actualizar README con información de deployment                     | 10 min     | VPS-20 a VPS-22 | `README.md`                        | ✅ Link a DEPLOY_VPS.md<br>✅ Link a BACKUP_RESTORE.md<br>✅ Link a ROLLBACK.md<br>✅ Badges de CI/CD<br>✅ Estado del deployment                                                  |

---

## Resumen de Estimación

| Fase                         | Tareas          | Tiempo Total  |
| ---------------------------- | --------------- | ------------- |
| Fase 1: Preparación VPS      | VPS-01 a VPS-05 | 2h 10min      |
| Fase 2: Docker & Traefik     | VPS-06 a VPS-11 | 3h 30min      |
| Fase 3: CI/CD GitHub Actions | VPS-12 a VPS-15 | 2h 20min      |
| Fase 4: Scripts de Operación | VPS-16 a VPS-19 | 1h 40min      |
| Fase 5: Documentación        | VPS-20 a VPS-23 | 1h 00min      |
| **TOTAL**                    | **23 tareas**   | **10h 40min** |

---

## Dependencias Críticas

```
VPS-01 → VPS-02 → VPS-03 → VPS-04
   ↓                        ↓
VPS-05                    VPS-06 → VPS-07 → VPS-08
                           ↓         ↓
                        VPS-09    VPS-10
                           ↓         ↓
                           └────┬────┘
                                ↓
                            VPS-11
                                ↓
VPS-12 → VPS-13 → VPS-14 → VPS-15
                           ↓
VPS-16 → VPS-17           VPS-18 → VPS-19
   ↓         ↓               ↓
VPS-20 ← VPS-21 ← VPS-22 ← VPS-23
```

---

## Prerrequisitos

- VPS con Ubuntu 22.04 LTS (2 GB RAM, 1 vCPU, 25 GB SSD mínimo)
- Dominio configurado con DNS apuntando al VPS
- GitHub account con acceso al repositorio
- Email para notificaciones (Resend, SendGrid, o SMTP)

---

## Riesgos y Mitigación

| Riesgo                           | Impacto | Probabilidad | Mitigación                                                                   |
| -------------------------------- | ------- | ------------ | ---------------------------------------------------------------------------- |
| Downtime durante deployment      | Alto    | Media        | Usar blue-green deployment, health checks antes de switch                    |
| Pérdida de datos en DB           | Crítico | Baja         | Backups automáticos diarios + backup pre-deploy                              |
| SSL certificates expirados       | Alto    | Baja         | Configurar auto-renewal con Let's Encrypt, monitoreo                         |
| SSH lockout después de hardening | Alto    | Media        | Mantener sesión SSH abierta hasta verificar acceso, tener consola de rescate |
| Rate limiting de Let's Encrypt   | Medio   | Baja         | Usar staging environment primero, no reintentar masivamente                  |

---

## Definición de Done

- ✅ Todas las 23 tareas completadas
- ✅ CI/CD pipeline funcionando (verde en main)
- ✅ Servicios deployados en VPS con health checks passing
- ✅ Backups automáticos configurados y verificados
- ✅ Documentación completa y actualizada
- ✅ Rollback probado en staging

---

## Próximos Pasos

1. Revisar y aprobar task breakdown
2. Ejecutar `/sdd-apply sistema-reservas-vps-deploy` para comenzar implementación
3. Seguir tareas en orden de dependencias
4. Reportar progreso por fase completada
