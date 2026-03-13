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

La documentación completa del proyecto está en `openspec/changes/sistema-reservas/artifacts/`:

- `explore.md` - Exploración técnica inicial
- `proposal.md` - Propuesta formal del proyecto
- `spec.md` - Especificaciones técnicas detalladas
- `design.md` - Diseño técnico y arquitectura
- `tasks.md` - Breakdown de tareas por fase

## Licencia

MIT
