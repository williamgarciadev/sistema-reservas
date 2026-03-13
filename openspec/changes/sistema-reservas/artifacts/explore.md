# 📋 EXPLORACIÓN TÉCNICA: Sistema de Reservas de Citas de Servicios

**Change**: sistema-reservas  
**Phase**: Exploration  
**Status**: ✅ Completed  
**Date**: 2025-03-11  
**Mode**: hybrid (Engram + OpenSpec)

---

## Executive Summary

Exploración técnica completa para el **Sistema de Reservas de Citas de Servicios** (peluquería, spa, médico, etc.). Este documento establece las bases arquitectónicas, modelo de datos, endpoints de API, tecnologías recomendadas y consideraciones de producción.

**Próximo paso**: Fase de Propuesta (`/sdd-propose`)

---

## 1. Arquitectura Recomendada

### 1.1 Estructura de Carpetas

```
sistema-reservas/
├── frontend/                 # Next.js 14+ (App Router)
│   ├── app/
│   │   ├── (auth)/          # Routes de autenticación
│   │   ├── (dashboard)/     # Routes protegidas
│   │   │   ├── admin/       # Panel administración
│   │   │   ├── customer/    # Panel cliente
│   │   │   └── employee/    # Panel empleado
│   │   ├── booking/         # Flujo de reserva
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/              # Componentes base (shadcn/ui)
│   │   ├── calendar/        # Componentes de calendario
│   │   └── booking/         # Componentes de reservas
│   ├── lib/
│   │   ├── api/             # Clientes de API
│   │   └── auth/            # Utilidades de autenticación
│   └── stores/              # State management (Zustand)
│
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── controllers/     # Lógica de endpoints
│   │   ├── services/        # Lógica de negocio
│   │   ├── repositories/    # Acceso a datos
│   │   ├── models/          # Definición de modelos
│   │   ├── middleware/      # Auth, validación, rate limiting
│   │   └── routes/          # Definición de rutas
│   └── prisma/              # Schema y migraciones
│
└── shared/                   # Código compartido
    └── types/               # Tipos TypeScript compartidos
```

### 1.2 Patrones de Diseño

| Patrón | Aplicación |
|--------|-----------|
| Repository | Abstracción de acceso a datos |
| Service Layer | Lógica de negocio pura |
| DTO | Transferencia de datos entre capas |
| Factory | Creación de notificaciones |
| Strategy | Diferentes pasarelas de pago |
| Observer | Eventos post-reserva |

---

## 2. Modelo de Datos

### 2.1 Entidades Principales

```
Usuario (1) ──< Cita (N) >── Servicio (1)
   │              │
   │              └── Empleado (1)
   │
   └── Empleado (1:1 opcional)

Cita (1) ── (1) Pago
Cita (1) ── (1) Reseña
Empleado (1) ──< Disponibilidad (N)
```

### 2.2 Schema Prisma (Resumen)

```prisma
model Usuario {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  nombre    String
  telefono  String?
  rol       Rol      @default(CLIENTE)
  citas     Cita[]
  empleado  Empleado?
}

enum Rol { CLIENTE, EMPLEADO, ADMIN }

model Servicio {
  id          String   @id @default(uuid())
  nombre      String
  duracion    Int      // minutos
  precio      Decimal
  activo      Boolean  @default(true)
  citas       Cita[]
}

model Empleado {
  id           String        @id @default(uuid())
  usuarioId    String        @unique
  especialidades String[]
  citas        Cita[]
  disponibilidad Disponibilidad[]
}

model Cita {
  id          String      @id @default(uuid())
  clienteId   String
  empleadoId  String
  servicioId  String
  fechaInicio DateTime
  fechaFin    DateTime
  timezone    String      @default("America/Mexico_City")
  estado      EstadoCita  @default(PENDIENTE)
  pago        Pago?
  reseña      Reseña?
}

enum EstadoCita {
  PENDIENTE, CONFIRMADA, EN_PROGRESO,
  COMPLETADA, CANCELADA, NO_SHOW
}

model Pago {
  id        String      @id @default(uuid())
  citaId    String      @unique
  monto     Decimal
  estado    EstadoPago  @default(PENDIENTE)
  stripeId  String?
}

model Reseña {
  id           String   @id @default(uuid())
  citaId       String   @unique
  calificacion Int
  comentario   String?
  visible      Boolean  @default(true)
}

model Disponibilidad {
  id         String   @id @default(uuid())
  empleadoId String
  fecha      DateTime
  horaInicio String
  horaFin    String
  tipo       TipoDisponibilidad @default(REGULAR)
}
```

---

## 3. API Endpoints

### 3.1 Autenticación (8 endpoints)

| Método | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/auth/register` | ❌ |
| POST | `/api/auth/login` | ❌ |
| POST | `/api/auth/refresh` | ✅ (refresh) |
| GET | `/api/auth/me` | ✅ |
| PUT | `/api/auth/profile` | ✅ |

### 3.2 Citas (8 endpoints)

| Método | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/appointments` | ✅ |
| POST | `/api/appointments` | ✅ |
| PUT | `/api/appointments/:id` | ✅ |
| DELETE | `/api/appointments/:id` | ✅ |
| GET | `/api/appointments/available-slots` | ✅ |

### 3.3 Servicios (5 endpoints)

| Método | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/services` | ❌ |
| POST | `/api/services` | ✅ (admin) |
| PUT | `/api/services/:id` | ✅ (admin) |

### 3.4 Administración (8 endpoints)

- `/api/admin/users` - Listar usuarios
- `/api/admin/employees` - Gestionar empleados
- `/api/admin/analytics/*` - Reportes y métricas

### 3.5 Pagos (4 endpoints)

- `/api/payments/create-intent` - Crear PaymentIntent Stripe
- `/api/payments/webhook` - Webhook Stripe
- `/api/payments/:id/refund` - Reembolsos

---

## 4. Tecnologías Recomendadas

| Categoría | Selección | Alternativa |
|-----------|-----------|-------------|
| **Frontend** | Next.js 14 + App Router | Vite + React |
| **Styling** | Tailwind CSS + shadcn/ui | Material UI |
| **Calendar** | FullCalendar v6 | React Big Calendar |
| **State** | Zustand | Redux Toolkit |
| **Forms** | React Hook Form + Zod | Formik |
| **Backend** | Express | Fastify, NestJS |
| **ORM** | Prisma | Drizzle, TypeORM |
| **Database** | PostgreSQL 15+ | MySQL, MongoDB |
| **Cache** | Redis | Memcached |
| **Auth** | jsonwebtoken + bcrypt | Passport.js |
| **Email** | Resend | SendGrid, Nodemailer |
| **SMS** | Twilio | MessageBird |
| **Pagos** | Stripe | PayPal, MercadoPago |
| **Testing** | Vitest + Playwright | Jest + Cypress |
| **Deploy** | Vercel + Railway | AWS, Render |

---

## 5. Consideraciones de Producción

### 5.1 Seguridad

```typescript
// Middlewares requeridos:
- helmet() - Security headers
- cors() - CORS whitelist
- rateLimit() - 100 req/15min
- express-validator / Zod - Validación de inputs
- JWT middleware - Autenticación
```

### 5.2 Escalabilidad

```
Frontend (Vercel CDN) → Backend (Railway auto-scale) → PostgreSQL (RDS)
                              ↓
                          Redis (Cache)
```

### 5.3 Deploy

| Componente | Plataforma | Costo |
|------------|-----------|-------|
| Frontend | Vercel | Gratis → $20/mes |
| Backend | Railway | $5-20/mes |
| Database | Railway PostgreSQL | $5-30/mes |
| Email | Resend | Gratis → $30/mes |
| SMS | Twilio | Pay-per-use |

---

## 6. Riesgos y Mitigación

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| **Timezones** | 🔴 Alto | Siempre UTC en DB, convertir en frontend |
| **Double Booking** | 🔴 Alto | Unique constraints + transacciones |
| **Webhooks** | 🟡 Medio | Idempotencia + retry queue |
| **Performance** | 🟡 Medio | Virtualización + paginación |
| **Security** | 🔴 Alto | Middlewares + audits periódicos |

---

## Priorización de Features

| Fase | Features | Tiempo |
|------|----------|--------|
| **MVP** | Auth, CRUD Citas, Calendario, Email | 4-6 semanas |
| **v1** | Pagos Stripe, Panel Admin, SMS | 3-4 semanas |
| **v2** | Reseñas, Analytics, Multi-empleado | 3-4 semanas |
| **v3** | App móvil, API pública | 6-8 semanas |

---

**Next Phase**: `/sdd-propose`  
**Artifact Mode**: hybrid
