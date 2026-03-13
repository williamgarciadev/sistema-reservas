# Sistema de Reservas de Citas de Servicios

Sistema full-stack de reservas de citas para negocios de servicios (peluquería, spa, consultorios médicos).

## Stack Tecnológico

### Frontend

- **Next.js 14** - App Router, Server Components
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Componentes UI
- **FullCalendar** - Calendario interactivo
- **Zustand** - State management

### Backend

- **Node.js 20** - Runtime
- **Express** - Framework HTTP
- **Prisma** - ORM
- **PostgreSQL** - Database
- **Redis** - Cache
- **JWT** - Autenticación

### Servicios Externos

- **Stripe** - Pagos
- **Resend** - Email transaccional
- **Twilio** - SMS (v1)
- **Cloudflare R2** - File storage

## Estructura del Proyecto

```
sistema-reservas/
├── apps/
│   ├── frontend/     # Next.js 14
│   └── backend/      # Express + Prisma
├── packages/
│   └── shared/       # Tipos compartidos
├── openspec/
│   └── changes/
│       └── sistema-reservas/
│           └── artifacts/  # Documentación SDD
└── turbo.json
```

## Desarrollo

### Prerrequisitos

- Node.js >= 20
- PostgreSQL 15+
- Redis 7+

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de ambiente
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Migrar base de datos
npm run db:migrate

# Seed inicial
npm run db:seed

# Iniciar desarrollo
npm run dev
```

## Fases del Proyecto

### MVP (Fase 1) - 4-6 semanas

- ✅ Auth JWT (registro, login, refresh tokens, roles)
- ✅ CRUD Citas (crear, leer, actualizar, cancelar)
- ✅ Calendario (vista semanal/mensual)
- ✅ Email Notifications (confirmación, recordatorio)
- ✅ Gestión Servicios
- ✅ Disponibilidad Básica

### v1 (Fase 2) - 3-4 semanas

- 🔲 Pagos Stripe
- 🔲 Panel Admin
- 🔲 SMS Notifications
- 🔲 Lista de Espera
- 🔲 Política Cancelación

### v2 (Fase 3) - 3-4 semanas

- 🔲 Reseñas y Calificaciones
- 🔲 Analytics Avanzados
- 🔲 Multi-empleado
- 🔲 Promociones

## Documentación

### SDD Artifacts

La documentación del proyecto está en `openspec/changes/sistema-reservas/artifacts/`:

- `explore.md` - Exploración técnica inicial
- `proposal.md` - Propuesta formal del proyecto
- `spec.md` - Especificaciones técnicas detalladas
- `design.md` - Diseño técnico y arquitectura
- `tasks.md` - Breakdown de tareas por fase

### Deployment & Operaciones

- [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md) - Guía completa de deployment en VPS
- [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md) - Procedimientos de backup y restore
- [`docs/ROLLBACK.md`](docs/ROLLBACK.md) - Procedimientos de rollback

## Deployment en VPS

### Quick Start

```bash
# 1. Configurar VPS (Ubuntu 22.04+)
ssh root@<vps-ip>

# 2. Clonar repositorio
sudo -iu deploy
git clone https://github.com/williamgarciadev/sistema-reservas ~/sistema-reservas
cd ~/sistema-reservas

# 3. Configurar variables de entorno
cp .env.production.example .env
nano .env  # Editar con tus valores

# 4. Deploy con Docker
docker network create web 2>/dev/null || true
docker network create internal 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d

# 5. Verificar
./scripts/health-check.sh
```

### Despliegue para reserva.wgsoft.com.co

La aplicación está configurada para desplegarse en el dominio `reserva.wgsoft.com.co` con los siguientes subdominios:

- **Frontend**: https://reserva.wgsoft.com.co
- **Backend/API**: https://api.reserva.wgsoft.com.co
- **Dashboard Traefik**: https://traefik.reserva.wgsoft.com.co (si está habilitado)

Asegúrate de que los siguientes registros DNS apunten a la IP de tu VPS:

```
A    reserva.wgsoft.com.co          -> TU_IP_VPS
A    api.reserva.wgsoft.com.co      -> TU_IP_VPS
A    traefik.reserva.wgsoft.com.co  -> TU_IP_VPS (opcional)
```

```

### Estado del Deployment

| Componente            | Estado   | Versión |
| --------------------- | -------- | ------- |
| Frontend (Next.js)    | ✅ Ready | v14     |
| Backend (Express)     | ✅ Ready | v1.0    |
| Database (PostgreSQL) | ✅ Ready | v16     |
| Cache (Redis)         | ✅ Ready | v7      |
| Proxy (Traefik)       | ✅ Ready | v2.10   |

### Badges

[![Deploy Status](https://img.shields.io/badge/deploy-ready-success)](docs/DEPLOY_VPS.md)
[![Uptime](https://img.shields.io/badge/uptime-99.9%25-success)](scripts/health-check.sh)
[![Last Backup](https://img.shields.io/badge/backup-daily-success)](docs/BACKUP_RESTORE.md)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Licencia

MIT
```
