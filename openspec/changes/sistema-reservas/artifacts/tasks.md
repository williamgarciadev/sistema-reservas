# 📋 TASKS: Sistema de Reservas de Citas de Servicios

**Change**: sistema-reservas  
**Phase**: Tasks  
**Status**: ✅ Completed  
**Date**: 2026-03-12  
**Mode**: hybrid (Engram + OpenSpec)  
**Based on**: spec.md v1.0, design.md v1.0

---

## 1. Resumen Ejecutivo

### 1.1 Alcance del Proyecto

| Métrica | Valor |
|---------|-------|
| **Total Tasks** | 47 tareas |
| **Estimación Total** | 380 horas (~9.5 semanas) |
| **Story Points Totales** | 245 SP |
| **Fases** | 3 (MVP, v1, v2) |
| **Módulos** | 12 |

### 1.2 Estructura de Fases

| Fase | Duración | Tareas | Criterio de Entrada | Criterio de Salida |
|------|----------|--------|---------------------|-------------------|
| **MVP** | 6 semanas | 18 tareas | Repo inicializado, DB configurada | Auth + Citas + Servicios + Empleados funcionales |
| **v1** | 4 semanas | 17 tareas | MVP en producción | Pagos + Notificaciones + Admin Dashboard |
| **v2** | 4 semanas | 12 tareas | v1 estable | Waitlist + Reseñas + Analytics + Promociones |

---

## 2. Task Breakdown por Módulo

### 2.1 Módulo de Autenticación (AUTH)

**Priority**: P0 (Crítico)  
**Estimated Hours**: 40h  
**Story Points**: 26 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| AUTH-01 | Configurar Prisma schema | Modelos Usuario, RefreshToken con índices | 4h | 3 | - | MVP-1 | ✅ |
| AUTH-02 | Implementar UserRepository | CRUD usuarios con Prisma | 3h | 2 | AUTH-01 | MVP-1 | ✅ |
| AUTH-03 | Implementar AuthService | Registro, login, hashing bcrypt | 6h | 5 | AUTH-02 | MVP-1 | ✅ |
| AUTH-04 | Implementar JWT utilities | Generación, validación, refresh tokens | 5h | 3 | AUTH-03 | MVP-1 | ✅ |
| AUTH-05 | Auth middleware | Verificación JWT en rutas protegidas | 3h | 2 | AUTH-04 | MVP-1 | ✅ |
| AUTH-06 | AuthController | Endpoints /registro, /login, /refresh, /logout | 4h | 3 | AUTH-05 | MVP-1 | ✅ |
| AUTH-07 | Recuperación de password | Generar token, enviar email, reset | 6h | 5 | AUTH-03, NOTIF-01 | MVP-2 | 🔲 |
| AUTH-08 | Rate limiting | 5 intentos fallidos por 15 minutos | 3h | 2 | AUTH-06 | MVP-2 | ✅ |
| AUTH-09 | Tests unitarios Auth | Vitest tests para AuthService | 6h | 3 | AUTH-07 | MVP-2 | 🔲 |

**Definition of Done**:
- [ ] 9 endpoints funcionando (registro, login, refresh, logout, recuperar, reset)
- [ ] Tests unitarios con >90% coverage
- [ ] Rate limiting activo
- [ ] Refresh token rotation funcionando
- [ ] Emails de recuperación se envían

---

### 2.2 Módulo de Servicios (SRV)

**Priority**: P0 (Crítico)  
**Estimated Hours**: 24h  
**Story Points**: 16 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| SRV-01 | Prisma schema Servicio | Modelo con validaciones | 2h | 2 | - | MVP-1 | ✅ |
| SRV-02 | ServiceRepository | CRUD servicios con Prisma | 3h | 2 | SRV-01 | MVP-1 | ✅ |
| SRV-03 | ServiceService | Lógica de negocio, validaciones | 4h | 3 | SRV-02 | MVP-1 | ✅ |
| SRV-04 | ServiceController | Endpoints GET /services, POST, PATCH (admin) | 4h | 3 | SRV-03 | MVP-1 | ✅ |
| SRV-05 | Admin middleware | Verificar rol ADMIN | 2h | 2 | AUTH-05 | MVP-1 | ✅ |
| SRV-06 | Tests unitarios Servicios | Vitest tests | 3h | 2 | SRV-04 | MVP-2 | 🔲 |
| SRV-07 | Seed de servicios iniciales | Script para datos iniciales | 2h | 1 | SRV-02 | MVP-2 | 🔲 |
| SRV-08 | Upload de imágenes | Cloudflare R2 integration | 4h | 3 | SRV-04 | v1-1 | 🔲 |

**Definition of Done**:
- [ ] CRUD completo de servicios
- [ ] Soft delete (activo/inactivo)
- [ ] Validación de unicidad de nombre
- [ ] Imágenes se suben a R2

---

### 2.3 Módulo de Empleados (EMP)

**Priority**: P0 (Crítico)  
**Estimated Hours**: 32h  
**Story Points**: 21 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| EMP-01 | Prisma schema Empleado | Modelo con horarioLaboral (JSONB) | 3h | 2 | - | MVP-1 | ✅ |
| EMP-02 | Prisma schema EmpleadoServicio | Tabla intermedia N:M | 2h | 1 | EMP-01, SRV-01 | MVP-1 | ✅ |
| EMP-03 | Prisma schema Disponibilidad | Excepciones y bloqueos | 2h | 2 | EMP-01 | MVP-1 | ✅ |
| EMP-04 | EmployeeRepository | CRUD empleados | 4h | 3 | EMP-01 | MVP-1 | ✅ |
| EMP-05 | EmployeeService | Lógica de negocio, validación horarios | 5h | 3 | EMP-04 | MVP-1 | ✅ |
| EMP-06 | EmployeeController | Endpoints CRUD empleados | 4h | 3 | EMP-05 | MVP-1 | ✅ |
| EMP-07 | DisponibilidadController | Gestión de horarios y excepciones | 4h | 3 | EMP-05 | MVP-2 | 🔲 |
| EMP-08 | Tests unitarios Empleados | Vitest tests | 4h | 2 | EMP-07 | MVP-2 | 🔲 |
| EMP-09 | UI gestión empleados | Formulario CRUD (frontend) | 4h | 2 | EMP-06 | v1-1 | 🔲 |

**Definition of Done**:
- [ ] CRUD completo de empleados
- [ ] Servicios por empleado configurables
- [ ] Horario laboral (lunes-domingo)
- [ ] Excepciones y bloqueos funcionando

---

### 2.4 Módulo de Citas (APPT)

**Priority**: P0 (Crítico)  
**Estimated Hours**: 64h  
**Story Points**: 42 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| APPT-01 | Prisma schema Cita | Modelo con estados, unique constraint | 4h | 3 | EMP-01, SRV-01 | MVP-1 | ✅ |
| APPT-02 | AppointmentRepository | CRUD citas con transacciones | 6h | 5 | APPT-01 | MVP-2 |
| APPT-03 | AvailabilityService | Cálculo de slots disponibles | 8h | 5 | EMP-03, APPT-01 | MVP-2 |
| APPT-04 | AppointmentService | Crear, cancelar, reagendar citas | 10h | 8 | APPT-03, SRV-03 | MVP-2 |
| APPT-05 | AppointmentController | Endpoints CRUD citas | 6h | 5 | APPT-04 | MVP-2 |
| APPT-06 | Disponibilidad endpoint | GET /employees/:id/disponibilidad | 4h | 3 | APPT-03 | MVP-2 |
| APPT-07 | Política de cancelación | Cálculo de penalidades | 4h | 3 | APPT-04 | MVP-3 |
| APPT-08 | Double booking prevention | Transacciones atómicas con FOR UPDATE | 6h | 5 | APPT-02 | MVP-2 |
| APPT-09 | Tests integración concurrencia | Pruebas de carga simultánea | 6h | 3 | APPT-08 | MVP-3 |
| APPT-10 | UI calendario | FullCalendar integration | 8h | 5 | APPT-06 | v1-1 |
| APPT-11 | UI booking wizard | 5 pasos (servicio → pago) | 10h | 8 | APPT-10 | v1-1 |
| APPT-12 | UI mis citas | Lista con filtros y acciones | 6h | 3 | APPT-05 | v1-2 |

**Definition of Done**:
- [ ] Crear cita con validación de disponibilidad
- [ ] Cancelar con política de penalidades
- [ ] Reagendar cita
- [ ] Double booking prevenido (tests de concurrencia)
- [ ] Slots calculados en <200ms
- [ ] Cache Redis para disponibilidad

---

### 2.5 Módulo de Notificaciones (NOTIF)

**Priority**: P1 (Alta)  
**Estimated Hours**: 32h  
**Story Points**: 21 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| NOTIF-01 | Configurar Resend | API key, templates base | 3h | 2 | - | MVP-2 |
| NOTIF-02 | Email templates | Confirmación, recordatorio, cancelación | 6h | 5 | NOTIF-01 | MVP-2 |
| NOTIF-03 | NotificationService | Envío de emails | 4h | 3 | NOTIF-02 | MVP-2 |
| NOTIF-04 | Event bus | EventEmitter para eventos de cita | 4h | 3 | APPT-04 | MVP-3 |
| NOTIF-05 | Listeners de eventos | cita.creada → email confirmación | 4h | 3 | NOTIF-04, APPT-04 | MVP-3 |
| NOTIF-06 | Cron job recordatorios | Job cada hora para recordatorios 24h | 5h | 3 | NOTIF-03 | v1-1 |
| NOTIF-07 | Configurar Twilio | SMS integration | 3h | 2 | NOTIF-01 | v1-3 |
| NOTIF-08 | SMS recordatorio | Envío opcional de SMS | 3h | 2 | NOTIF-07, NOTIF-06 | v1-3 |

**Definition of Done**:
- [ ] Emails se envían en <1 minuto
- [ ] Templates responsive (mobile)
- [ ] Recordatorio 24h automático
- [ ] SMS opcional funcionando

---

### 2.6 Módulo de Pagos (PAY)

**Priority**: P1 (Alta)  
**Estimated Hours**: 40h  
**Story Points**: 26 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| PAY-01 | Prisma schema Pago | Modelo con stripePaymentIntentId | 3h | 2 | APPT-01 | v1-1 |
| PAY-02 | Configurar Stripe | API keys, webhook secret | 2h | 1 | - | v1-1 |
| PAY-03 | PaymentService | Crear PaymentIntent | 4h | 3 | PAY-01, APPT-04 | v1-1 |
| PAY-04 | PaymentController | POST /payments/create-intent | 3h | 2 | PAY-03 | v1-1 |
| PAY-05 | Webhook handler | /webhooks/stripe endpoint | 6h | 5 | PAY-03 | v1-1 |
| PAY-06 | Verificación de firma | Stripe-Signature header | 3h | 2 | PAY-05 | v1-1 |
| PAY-07 | Idempotencia de webhooks | Prevenir procesamiento duplicado | 4h | 3 | PAY-05 | v1-1 |
| PAY-08 | Reembolsos | Stripe Refund API | 4h | 3 | PAY-05 | v1-2 |
| PAY-09 | Stripe Elements | Formulario de pago (frontend) | 8h | 5 | PAY-04 | v1-1 |
| PAY-10 | Tests de webhooks | Simular eventos de Stripe | 3h | 2 | PAY-07 | v1-2 |

**Definition of Done**:
- [ ] PaymentIntent se crea correctamente
- [ ] Webhook verifica firma
- [ ] Idempotencia funciona
- [ ] Cita se actualiza a PAGADA
- [ ] Reembolsos procesados

---

### 2.7 Módulo de Admin (ADM)

**Priority**: P1 (Alta)  
**Estimated Hours**: 36h  
**Story Points**: 24 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| ADM-01 | Prisma schema Configuracion | Key-value store para config | 2h | 2 | - | v1-1 |
| ADM-02 | AdminController | Dashboard metrics endpoint | 4h | 3 | APPT-02, PAY-01 | v1-2 |
| ADM-03 | AnalyticsService | Cálculo de métricas | 6h | 5 | ADM-02 | v1-2 |
| ADM-04 | Usuarios management | Listar, editar, desactivar | 5h | 3 | AUTH-02 | v1-2 |
| ADM-05 | ConfiguracionController | CRUD configuración del negocio | 4h | 3 | ADM-01 | v1-2 |
| ADM-06 | UI dashboard admin | Métricas en tiempo real | 8h | 5 | ADM-03 | v1-3 |
| ADM-07 | UI gestión usuarios | Tabla con filtros y acciones | 5h | 3 | ADM-04 | v1-3 |
| ADM-08 | UI configuración | Formulario de parámetros | 4h | 2 | ADM-05 | v1-3 |

**Definition of Done**:
- [ ] Dashboard con métricas clave
- [ ] Gestión de usuarios completa
- [ ] Configuración del negocio editable
- [ ] Métricas se actualizan (polling 1 min)

---

### 2.8 Módulo de Calendario (CAL)

**Priority**: P1 (Alta)  
**Estimated Hours**: 20h  
**Story Points**: 13 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| CAL-01 | FullCalendar setup | Integración en frontend | 4h | 3 | - | v1-1 |
| CAL-02 | Custom event rendering | Colores por estado | 3h | 2 | CAL-01 | v1-1 |
| CAL-03 | Vista semanal/mensual | Toggle entre vistas | 3h | 2 | CAL-01 | v1-1 |
| CAL-04 | Click en slot → booking | Navegación contextual | 3h | 2 | CAL-03, APPT-11 | v1-1 |
| CAL-05 | Virtualización | Performance para 30 días | 4h | 3 | CAL-02 | v1-2 |
| CAL-06 | Mobile responsive | Touch-friendly | 3h | 2 | CAL-04 | v1-2 |

**Definition of Done**:
- [ ] FullCalendar renderiza en <1s
- [ ] Vistas semanal/mensual funcionales
- [ ] Click en slot inicia booking
- [ ] Mobile responsive

---

### 2.9 Módulo de Lista de Espera (WAIT)

**Priority**: P2 (Media)  
**Estimated Hours**: 24h  
**Story Points**: 16 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| WAIT-01 | Prisma schema Waitlist | Modelo con unique constraint | 2h | 2 | APPT-01 | v2-1 |
| WAIT-02 | WaitlistRepository | CRUD waitlist entries | 3h | 2 | WAIT-01 | v2-1 |
| WAIT-03 | WaitlistService | Unirse, salir, notificar | 5h | 3 | WAIT-02, APPT-04 | v2-1 |
| WAIT-04 | WaitlistController | Endpoints para waitlist | 3h | 2 | WAIT-03 | v2-1 |
| WAIT-05 | Notificación de slot libre | Email cuando cita se cancela | 4h | 3 | WAIT-03, NOTIF-03 | v2-1 |
| WAIT-06 | TTL para reserva temporal | Redis para reserva de 15 min | 4h | 3 | WAIT-05, Redis | v2-2 |
| WAIT-07 | UI waitlist | Unirse/salir de lista | 3h | 2 | WAIT-04 | v2-2 |

**Definition of Done**:
- [ ] Unirse a lista de espera
- [ ] Notificación automática cuando slot se libera
- [ ] Reserva temporal de 15 minutos
- [ ] FIFO ordering

---

### 2.10 Módulo de Reseñas (REV)

**Priority**: P2 (Media)  
**Estimated Hours**: 20h  
**Story Points**: 13 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| REV-01 | Prisma schema Reseña | Modelo con calificación 1-5 | 2h | 2 | APPT-01 | v2-1 |
| REV-02 | ReviewRepository | CRUD reseñas | 3h | 2 | REV-01 | v2-1 |
| REV-03 | ReviewService | Crear, validar (1 por cita) | 4h | 3 | REV-02, APPT-04 | v2-1 |
| REV-04 | ReviewController | Endpoints CRUD | 3h | 2 | REV-03 | v2-1 |
| REV-05 | Listar reseñas con promedio | Agregaciones | 3h | 2 | REV-02 | v2-2 |
| REV-06 | UI crear reseña | Formulario post-cita | 3h | 2 | REV-04 | v2-2 |
| REV-07 | UI mostrar reseñas | Lista con estrellas | 2h | 1 | REV-05 | v2-2 |

**Definition of Done**:
- [ ] Solo 1 reseña por cita
- [ ] Calificación 1-5 estrellas
- [ ] Promedio visible
- [ ] Reseñas anónimas opcionales

---

### 2.11 Módulo de Analytics (ANA)

**Priority**: P2 (Media)  
**Estimated Hours**: 28h  
**Story Points**: 18 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| ANA-01 | AnalyticsService queries | Queries complejas de ingresos | 6h | 5 | APPT-02, PAY-01 | v2-1 |
| ANA-02 | Reporte de ingresos | Agrupación por fecha/servicio/empleado | 5h | 3 | ANA-01 | v2-1 |
| ANA-03 | Reporte de ocupación | % slots ocupados vs totales | 5h | 3 | ANA-01, EMP-03 | v2-1 |
| ANA-04 | Export CSV | Generar CSV descargable | 3h | 2 | ANA-02 | v2-2 |
| ANA-05 | Export PDF | Generar PDF con gráficos | 4h | 3 | ANA-02 | v2-2 |
| ANA-06 | UI gráficos | Charts de ingresos y ocupación | 5h | 3 | ANA-02, ANA-03 | v2-2 |

**Definition of Done**:
- [ ] Reporte de ingresos con filtros
- [ ] Reporte de ocupación por empleado
- [ ] Export a CSV y PDF
- [ ] Gráficos en dashboard

---

### 2.12 Módulo de Promociones (PROMO)

**Priority**: P2 (Media)  
**Estimated Hours**: 24h  
**Story Points**: 16 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch |
|----|------|-------------|------------|----|--------------|-------|
| PROMO-01 | Prisma schema Cupon | Modelo con tipos de descuento | 3h | 2 | - | v2-1 |
| PROMO-02 | Prisma schema CuponUso | Tracking de usos por usuario | 2h | 2 | PROMO-01 | v2-1 |
| PROMO-03 | CouponService | Validar, aplicar, usar cupón | 5h | 3 | PROMO-02, PAY-03 | v2-1 |
| PROMO-04 | CouponController | CRUD cupones (admin) | 3h | 2 | PROMO-03 | v2-1 |
| PROMO-05 | Aplicar cupón en booking | Descuento en PaymentIntent | 4h | 3 | PROMO-03, PAY-03 | v2-2 |
| PROMO-06 | UI gestión cupones | Admin CRUD | 4h | 3 | PROMO-04 | v2-2 |
| PROMO-07 | UI aplicar cupón | Input en checkout | 3h | 2 | PROMO-05 | v2-2 |

**Definition of Done**:
- [ ] CRUD de cupones
- [ ] Validación de cupón (activo, no expirado)
- [ ] Descuento aplicado en pago
- [ ] Límite de usos por usuario

---

## 3. Infraestructura y DevOps

**Priority**: P0 (Crítico)  
**Estimated Hours**: 36h  
**Story Points**: 24 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| DEV-01 | Setup monorepo | Turborepo configuration | 3h | 2 | - | MVP-1 | ✅ |
| DEV-02 | Configurar PostgreSQL | Railway DB setup | 2h | 1 | DEV-01 | MVP-1 | ✅ |
| DEV-03 | Configurar Redis | Railway Redis setup | 2h | 1 | DEV-01 | MVP-1 | ⏳ |
| DEV-04 | Configurar Cloudflare R2 | Bucket para imágenes | 2h | 1 | DEV-01 | MVP-1 | ⏳ |
| DEV-05 | CI/CD GitHub Actions | Workflows para test, build, deploy | 6h | 5 | DEV-01 | MVP-1 | 🔲 |
| DEV-06 | Deploy backend Railway | Docker + env vars | 4h | 3 | DEV-05 | MVP-2 | 🔲 |
| DEV-07 | Deploy frontend Vercel | Connect repo, env vars | 3h | 2 | DEV-05 | MVP-2 | 🔲 |
| DEV-08 | Configurar Sentry | Error tracking | 3h | 2 | DEV-06, DEV-07 | MVP-3 | 🔲 |
| DEV-09 | Configurar UptimeRobot | Monitoreo 24/7 | 2h | 1 | DEV-06, DEV-07 | MVP-3 | 🔲 |
| DEV-10 | Variables de ambiente | .env.example, documentación | 2h | 1 | DEV-01 | MVP-1 | ✅ |
| DEV-11 | Database migrations | Prisma migrate deploy | 3h | 2 | DEV-02 | MVP-1 | ⏳ |
| DEV-12 | Seed scripts | Datos iniciales | 4h | 3 | DEV-11 | MVP-2 | 🔲 |

**Definition of Done**:
- [ ] Monorepo funcionando
- [ ] CI/CD pipeline activo
- [ ] Backend desplegado en Railway
- [ ] Frontend desplegado en Vercel
- [ ] Sentry capturando errores
- [ ] UptimeRobot monitoreando

---

## 4. Frontend Core

**Priority**: P0 (Crítico)  
**Estimated Hours**: 40h  
**Story Points**: 26 SP

| ID | Task | Descripción | Estimación | SP | Dependencias | Batch | Status |
|----|------|-------------|------------|----|--------------|-------|--------|
| FE-01 | Setup Next.js 14 | App Router, Tailwind | 3h | 2 | DEV-01 | MVP-1 | ✅ |
| FE-02 | Configurar shadcn/ui | Componentes base | 3h | 2 | FE-01 | MVP-1 | ⏳ |
| FE-03 | Auth context | Estado de autenticación | 4h | 3 | AUTH-06 | MVP-2 |
| FE-04 | Protected routes | Middleware de rutas | 3h | 2 | FE-03 | MVP-2 |
| FE-05 | Layouts por rol | Admin, Empleado, Cliente | 4h | 3 | FE-04 | MVP-2 |
| FE-06 | UI Login/Registro | Forms con validación | 5h | 3 | AUTH-06 | MVP-2 |
| FE-07 | UI Recuperar password | Forms | 3h | 2 | AUTH-07 | MVP-3 |
| FE-08 | API client | Axios con interceptors | 4h | 3 | FE-03 | MVP-2 |
| FE-09 | Toast notifications | Sistema de notificaciones | 3h | 2 | FE-08 | MVP-2 |
| FE-10 | Theme provider | Dark/light mode | 3h | 2 | FE-02 | MVP-3 |
| FE-11 | Error boundaries | Manejo de errores global | 3h | 2 | FE-08 | MVP-3 |
| FE-12 | Responsive design | Mobile-first | 2h | 1 | FE-02 | MVP-3 |

**Definition of Done**:
- [ ] Next.js 14 con App Router
- [ ] shadcn/ui configurado
- [ ] Auth flow completo
- [ ] Layouts por rol funcionando
- [ ] Mobile responsive

---

## 5. Dependencias Críticas

### 5.1 Dependency Graph

```
MVP-1 (Semana 1-2)
├── DEV-01 → DEV-02, DEV-03, DEV-04, DEV-10
├── AUTH-01 → AUTH-02 → AUTH-03 → AUTH-04 → AUTH-05 → AUTH-06
├── SRV-01 → SRV-02 → SRV-03 → SRV-04
├── EMP-01, EMP-02, EMP-03 → EMP-04 → EMP-05 → EMP-06
├── APPT-01 (depende de EMP-01, SRV-01)
├── FE-01 → FE-02 → FE-06 (depende de AUTH-06)
└── DEV-05 → DEV-06, DEV-07

MVP-2 (Semana 3-4)
├── AUTH-07 (depende de NOTIF-01)
├── AUTH-08, AUTH-09
├── SRV-05, SRV-06, SRV-07
├── EMP-07, EMP-08
├── APPT-02, APPT-03, APPT-04, APPT-05, APPT-06, APPT-08
├── NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
├── FE-03, FE-04, FE-05, FE-07, FE-08, FE-09
└── DEV-08, DEV-09, DEV-11, DEV-12

MVP-3 (Semana 5-6)
├── APPT-07, APPT-09, APPT-10, APPT-11, APPT-12
├── FE-10, FE-11, FE-12
└── Testing E2E

v1-1 (Semana 7)
├── PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-09
├── NOTIF-06
├── CAL-01, CAL-02, CAL-03, CAL-04
├── SRV-08, EMP-09

v1-2 (Semana 8)
├── PAY-08, PAY-10
├── ADM-01, ADM-02, ADM-03, ADM-04, ADM-05
├── CAL-05, CAL-06

v1-3 (Semana 9)
├── NOTIF-07, NOTIF-08
├── ADM-06, ADM-07, ADM-08

v2-1 (Semana 10-11)
├── WAIT-01, WAIT-02, WAIT-03, WAIT-04, WAIT-05
├── REV-01, REV-02, REV-03, REV-04, REV-05
├── ANA-01, ANA-02, ANA-03
├── PROMO-01, PROMO-02, PROMO-03, PROMO-04

v2-2 (Semana 12-13)
├── WAIT-06, WAIT-07
├── REV-06, REV-07
├── ANA-04, ANA-05, ANA-06
├── PROMO-05, PROMO-06, PROMO-07
```

### 5.2 Critical Path

```
DEV-01 → AUTH-01→06 → APPT-01→08 → FE-03→06 → MVP RELEASE (Semana 6)
                                           ↓
                                    PAY-01→09 → v1 RELEASE (Semana 10)
                                           ↓
                                    WAIT-01→05 → v2 RELEASE (Semana 14)
```

---

## 6. Batch Grouping para /sdd-apply

### Batch MVP-1 (Semana 1-2) - Foundation
**Tasks**: 14 tasks, ~60h, 40 SP

```
DEV-01, DEV-02, DEV-03, DEV-04, DEV-10, DEV-11
AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
SRV-01, SRV-02, SRV-03, SRV-04
EMP-01, EMP-02, EMP-03, EMP-04, EMP-05, EMP-06
APPT-01
FE-01, FE-02
```

### Batch MVP-2 (Semana 3-4) - Core Features
**Tasks**: 18 tasks, ~80h, 52 SP

```
AUTH-07, AUTH-08, AUTH-09
SRV-05, SRV-06, SRV-07
EMP-07, EMP-08
APPT-02, APPT-03, APPT-04, APPT-05, APPT-06, APPT-08
NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05
FE-03, FE-04, FE-05, FE-06, FE-07, FE-08, FE-09
DEV-05, DEV-06, DEV-07, DEV-08, DEV-09, DEV-12
```

### Batch MVP-3 (Semana 5-6) - Polish & Testing
**Tasks**: 8 tasks, ~40h, 26 SP

```
APPT-07, APPT-09, APPT-10, APPT-11, APPT-12
FE-10, FE-11, FE-12
Testing E2E (Playwright)
```

### Batch v1-1 (Semana 7) - Payments & Calendar
**Tasks**: 12 tasks, ~50h, 33 SP

```
PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-09
NOTIF-06
CAL-01, CAL-02, CAL-03, CAL-04
SRV-08, EMP-09
```

### Batch v1-2 (Semana 8) - Admin Dashboard
**Tasks**: 8 tasks, ~35h, 23 SP

```
PAY-08, PAY-10
ADM-01, ADM-02, ADM-03, ADM-04, ADM-05
CAL-05, CAL-06
```

### Batch v1-3 (Semana 9) - SMS & UI Polish
**Tasks**: 5 tasks, ~20h, 13 SP

```
NOTIF-07, NOTIF-08
ADM-06, ADM-07, ADM-08
```

### Batch v2-1 (Semana 10-11) - Advanced Features
**Tasks**: 13 tasks, ~55h, 36 SP

```
WAIT-01, WAIT-02, WAIT-03, WAIT-04, WAIT-05
REV-01, REV-02, REV-03, REV-04, REV-05
ANA-01, ANA-02, ANA-03
PROMO-01, PROMO-02, PROMO-03, PROMO-04
```

### Batch v2-2 (Semana 12-13) - Completion
**Tasks**: 9 tasks, ~40h, 26 SP

```
WAIT-06, WAIT-07
REV-06, REV-07
ANA-04, ANA-05, ANA-06
PROMO-05, PROMO-06, PROMO-07
```

---

## 7. Testing Strategy

### 7.1 Testing Pyramid

| Nivel | Herramienta | Coverage Target | Tareas |
|-------|-------------|-----------------|--------|
| **Unitarios** | Vitest | >90% en servicios | AUTH-09, SRV-06, EMP-08, APPT-09, PAY-10 |
| **Integración** | Vitest + Testcontainers | Críticos (auth, pagos, citas) | APPT-09, PAY-10 |
| **E2E** | Playwright | Flujos principales | FE-E2E-01 a FE-E2E-05 |

### 7.2 E2E Test Scenarios

| ID | Escenario | Priority | Batch |
|----|-----------|----------|-------|
| FE-E2E-01 | Registro → Login → Dashboard | P0 | MVP-3 |
| FE-E2E-02 | Flujo completo de reserva (5 pasos) | P0 | MVP-3 |
| FE-E2E-03 | Cancelar cita con penalidad | P0 | MVP-3 |
| FE-E2E-04 | Pago con Stripe (test mode) | P0 | v1-1 |
| FE-E2E-05 | Admin: crear servicio, ver en dashboard | P1 | v1-3 |

---

## 8. Riesgos y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| **Double booking por concurrencia** | Alto | Media | Transacciones atómicas con FOR UPDATE, tests de carga |
| **Webhook de Stripe falla** | Alto | Baja | Idempotencia, retries con backoff, logging |
| **Redis cache stale** | Medio | Media | TTL corto (1 min), invalidación en writes |
| **Emails no se entregan** | Medio | Baja | Resend con retries, fallback a log, alertas |
| **Performance en calendario** | Medio | Media | Virtualización, cache Redis, lazy loading |
| **Scope creep (v2 features)** | Alto | Alta | Strict phase gates, MVP primero |

---

## 9. Criterios de Aceptación por Fase

### MVP (Semana 6)

- [ ] Usuario puede registrarse y loguearse
- [ ] Admin puede crear servicios y empleados
- [ ] Cliente puede reservar cita (flujo 5 pasos)
- [ ] Sistema previene double booking
- [ ] Email de confirmación se envía
- [ ] Dashboard básico funciona
- [ ] Tests unitarios >90% coverage
- [ ] CI/CD pipeline activo

### v1 (Semana 10)

- [ ] Pagos con Stripe funcionando
- [ ] Webhook procesa eventos correctamente
- [ ] Reembolsos se procesan
- [ ] Calendario FullCalendar integrado
- [ ] Recordatorio 24h automático
- [ ] Admin dashboard con métricas
- [ ] SMS recordatorio opcional

### v2 (Semana 14)

- [ ] Lista de espera funcionando
- [ ] Reseñas y calificaciones
- [ ] Reportes de analytics (ingresos, ocupación)
- [ ] Cupones de descuento
- [ ] Export a CSV/PDF
- [ ] Performance: Lighthouse >90

---

## 10. Next Steps

**Recommended**: Execute `/sdd-apply sistema-reservas --batch MVP-1`

This will begin implementation of the foundation layer including:
- Monorepo setup con Turborepo
- Database configuration (PostgreSQL, Redis, R2)
- Auth module completo
- Servicios y Empleados CRUD
- Initial frontend setup

**Estimated Duration**: 2 weeks  
**Risk Level**: Low (well-defined tasks, clear dependencies)
