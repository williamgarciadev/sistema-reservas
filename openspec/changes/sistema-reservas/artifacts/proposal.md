# 📋 PROPUESTA FORMAL: Sistema de Reservas de Citas de Servicios

**Change**: sistema-reservas  
**Phase**: Proposal  
**Status**: ✅ Completed  
**Date**: 2025-03-11  
**Mode**: hybrid (Engram + OpenSpec)

---

## 1. Executive Summary

Sistema full-stack de reservas de citas para negocios de servicios (peluquería, spa, consultorios médicos) que permite a los clientes agendar, gestionar y pagar citas en línea, mientras los empleados y administradores gestionan disponibilidad, horarios y reportes.

**Valor entregado**: Automatización completa del proceso de reservas, reducción de no-shows mediante recordatorios automáticos, y centralización de la gestión operativa del negocio.

**Timeline total estimado**: 10-14 semanas (MVP + v1 + v2)

---

## 2. Alcance del Proyecto

### 2.1 MVP (Fase 1) - 4-6 semanas

| Feature | Descripción | Prioridad |
|---------|-------------|-----------|
| **Auth JWT** | Registro, login, refresh tokens, roles (cliente/empleado/admin) | 🔴 Critical |
| **CRUD Citas** | Crear, leer, actualizar, cancelar citas | 🔴 Critical |
| **Calendario** | Vista semanal/mensual con FullCalendar, disponibilidad en tiempo real | 🔴 Critical |
| **Email Notifications** | Confirmación, recordatorio 24h, cancelación (Resend) | 🟡 High |
| **Gestión Servicios** | Catálogo de servicios con duración y precio | 🟡 High |
| **Disponibilidad Básica** | Horarios regulares por empleado | 🟡 High |

**MVP Definition of Done**: Usuario puede registrarse, ver servicios disponibles, seleccionar empleado, elegir horario, reservar cita y recibir confirmación por email.

---

### 2.2 v1 (Fase 2) - 3-4 semanas

| Feature | Descripción | Prioridad |
|---------|-------------|-----------|
| **Pagos Stripe** | PaymentIntents, webhook de confirmación, reembolsos | 🔴 Critical |
| **Panel Admin** | Dashboard métricas, gestión usuarios, configuración negocio | 🟡 High |
| **SMS Notifications** | Recordatorio vía Twilio (opcional para cliente) | 🟡 High |
| **Lista de Espera** | Notificar cuando se libera slot cancelado | 🟢 Medium |
| **Política Cancelación** | Reglas configurables (ej: 24h antes) | 🟢 Medium |

**v1 Definition of Done**: Sistema capaz de procesar pagos, administrar negocio desde panel, y notificar por múltiples canales.

---

### 2.3 v2 (Fase 3) - 3-4 semanas

| Feature | Descripción | Prioridad |
|---------|-------------|-----------|
| **Reseñas y Calificaciones** | Clientes califican servicio post-cita | 🟡 High |
| **Analytics Avanzados** | Reportes ingresos, tasa ocupación, retención | 🟡 High |
| **Multi-empleado** | Asignación automática por especialidad/disponibilidad | 🟡 High |
| **Promociones** | Cupones descuento, paquetes de servicios | 🟢 Medium |
| **Historial Cliente** | Timeline completo de citas y preferencias | 🟢 Medium |

**v2 Definition of Done**: Sistema maduro con feedback de clientes, insights de negocio, y gestión eficiente de múltiples empleados.

---

### 2.4 Out of Scope (Explícitamente Excluidas)

| Feature | Razón de exclusión |
|---------|-------------------|
| **App móvil nativa** | Fuera del scope inicial; PWA como alternativa |
| **API pública para terceros** | Requiere infraestructura adicional de seguridad |
| **Multi-tenant (SaaS)** | Complejidad arquitectónica significativa |
| **Chat en vivo** | Integración de terceros; no core del negocio |
| **Gestión inventario productos** | Feature separada; no esencial para reservas |
| **Integración con redes sociales** | Nice-to-have; no blocking para lanzamiento |

---

## 3. Arquitectura Confirmada

### 3.1 Stack Tecnológico Final

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Frontend Framework** | Next.js | 14.x | SSR, App Router, optimizado Vercel |
| **Frontend Language** | TypeScript | 5.x | Type safety, DX mejorado |
| **Styling** | Tailwind CSS | 3.x | Utility-first, rápido desarrollo |
| **UI Components** | shadcn/ui | latest | Accesible, personalizable, sin vendor lock-in |
| **Calendar** | FullCalendar | 6.x | Feature-complete, buena documentación |
| **State Management** | Zustand | 4.x | Minimalista, sin boilerplate |
| **Forms** | React Hook Form + Zod | 7.x + 3.x | Validación performante |
| **Backend Runtime** | Node.js | 20.x LTS | Estabilidad, ecosistema |
| **Backend Framework** | Express | 4.x | Maduro, flexible, ampliamente adoptado |
| **ORM** | Prisma | 5.x | Type-safe, migraciones, DX excelente |
| **Database** | PostgreSQL | 15+ | Robusto, ACID, soporte JSONB |
| **Cache** | Redis | 7.x | Sesiones, rate limiting, cache consultas |
| **Auth** | jsonwebtoken + bcrypt | - | JWT stateless, hashing seguro |
| **Email** | Resend | - | API moderna, deliverability alto |
| **SMS** | Twilio | - | Líder industria, cobertura global |
| **Pagos** | Stripe | - | DX mejor, documentación excelente |
| **Testing** | Vitest + Playwright | - | Rápido, E2E confiable |

### 3.2 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Browser   │  │   Mobile     │  │   PWA (futuro)       │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                │                      │               │
│         └────────────────┴──────────────────────┘               │
│                          │                                       │
│                    HTTPS / REST                                  │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                      FRONTEND (Vercel)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js 14 App Router                                    │   │
│  │  ├── (auth) → Login, Register, Recovery                  │   │
│  │  ├── (dashboard) → Admin, Employee, Customer panels      │   │
│  │  ├── booking → Flujo de reserva                          │   │
│  │  └── API Routes → BFF (Backend for Frontend)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Componentes Clave                                        │   │
│  │  ├── Calendar (FullCalendar)                             │   │
│  │  ├── BookingWizard (React Hook Form + Zod)               │   │
│  │  ├── PaymentForm (Stripe Elements)                       │   │
│  │  └── Notifications (Toast + Email/SMS)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
│                    HTTPS / REST                                  │
┌──────────────────────────▼───────────────────────────────────────┐
│                      BACKEND (Railway)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Express Server                                           │   │
│  │  ├── Middleware Stack                                     │   │
│  │  │   ├── helmet (security headers)                        │   │
│  │  │   ├── cors (whitelist)                                 │   │
│  │  │   ├── rateLimit (100 req/15min)                        │   │
│  │  │   ├── express-validator / Zod                          │   │
│  │  │   └── JWT auth                                         │   │
│  │  └── Routes                                                │   │
│  │      ├── /api/auth/*                                       │   │
│  │      ├── /api/appointments/*                               │   │
│  │      ├── /api/services/*                                   │   │
│  │      ├── /api/employees/*                                  │   │
│  │      ├── /api/payments/*                                   │   │
│  │      └── /api/admin/*                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Capa de Negocio                                          │   │
│  │  ├── Controllers → HTTP handling                          │   │
│  │  ├── Services → Business logic pura                       │   │
│  │  ├── Repositories → Acceso a datos (Prisma)               │   │
│  │  └── Events → EventEmitter (notificaciones post-cita)     │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                    DATA LAYER                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  PostgreSQL │  │    Redis     │  │   File Storage       │    │
│  │  (Railway)  │  │  (Cache)     │  │   (S3-compatible)    │    │
│  │             │  │              │  │                      │    │
│  │  - Users    │  │  - Sessions  │  │  - Photos            │    │
│  │  - Citas    │  │  - Rate Lim. │  │  - Documentos        │    │
│  │  - Servicios│  │  - Cache Q.  │  │                      │    │
│  │  - Pagos    │  │              │  │                      │    │
│  └─────────────┘  └──────────────┘  └──────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                 SERVICIOS EXTERNOS                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │   Stripe    │  │   Resend     │  │     Twilio           │     │
│  │  (Pagos)    │  │   (Email)    │  │     (SMS)            │     │
│  └─────────────┘  └──────────────┘  └──────────────────────┘     │
└───────────────────────────────────────────────────────────────────┘
```

### 3.3 Decisiones Arquitectónicas Clave

| Decisión | Opción Seleccionada | Alternativa Considerada | Justificación |
|----------|-------------------|------------------------|---------------|
| **Monorepo vs Polirepo** | Monorepo (Turborepo) | Polirepo | Compartir tipos, scripts unificados |
| **App Router vs Pages** | App Router | Pages Router | Futuro de Next.js, server components |
| **Server Actions vs API** | API REST tradicional | Server Actions | Mayor control, testing más fácil |
| **JWT vs Sesiones** | JWT stateless | Express-session | Escalabilidad horizontal |
| **Prisma vs Drizzle** | Prisma | Drizzle ORM | Madurez, migraciones, tooling |
| **PostgreSQL vs MySQL** | PostgreSQL | MySQL 8 | JSONB, tipos avanzados, ACID |
| **Zustand vs Redux** | Zustand | Redux Toolkit | Menos boilerplate, suficiente para scope |
| **Resend vs SendGrid** | Resend | SendGrid | API moderna, mejor DX, pricing |

---

## 4. Cronograma Estimado

### 4.1 Timeline por Fases

```
Semana 1-2:  [████████] MVP - Auth + Schema + CRUD básico
Semana 3-4:  [████████] MVP - Calendario + Disponibilidad + Email
Semana 5-6:  [████████] MVP - Testing + Bug fixing + Deploy inicial
              └────────┘
              MVP DONE (semana 6)

Semana 7-8:  [████████] v1 - Stripe + Webhooks + Panel Admin
Semana 9-10: [████████] v1 - SMS + Lista espera + Políticas
              └────────┘
              v1 DONE (semana 10)

Semana 11-12:[████████] v2 - Reseñas + Analytics + Multi-empleado
Semana 13-14:[████████] v2 - Promociones + Historial + Optimización
              └────────┘
              v2 DONE (semana 14)
```

### 4.2 Hitos Principales

| Hito | Semana | Entregable | Criterio de Aceptación |
|------|--------|-----------|----------------------|
| **M0: Setup** | 1 | Repo, CI/CD, dev environment | Todo el equipo puede correr el proyecto local |
| **M1: Auth** | 2 | Login, registro, roles funcionales | Usuario puede crear cuenta y loguearse |
| **M2: Core** | 4 | CRUD citas + calendario funcional | Reserva completa en < 3 minutos |
| **M3: MVP** | 6 | MVP deployado en staging | End-to-end test pasado |
| **M4: Pagos** | 8 | Stripe integrado + webhooks | Transacción exitosa en test mode |
| **M5: v1** | 10 | Panel admin + notificaciones | Admin puede gestionar todo el sistema |
| **M6: v2** | 12 | Reseñas + analytics | Reportes generados correctamente |
| **M7: Launch** | 14 | Producción + monitoreo | 0 bugs críticos, uptime > 99% |

### 4.3 Dependencias Críticas

```
Auth (sem 1-2)
  └─> CRUD Citas (sem 2-3)
       └─> Calendario (sem 3-4)
            └─> Email Notifications (sem 4)
                 └─> MVP Testing (sem 5-6)
                      └─> Stripe (sem 7-8)
                           └─> Panel Admin (sem 8-9)
                                └─> v1 Testing (sem 10)
                                     └─> Reseñas (sem 11-12)
                                          └─> Analytics (sem 12-13)
                                               └─> v2 Testing (sem 14)
```

**Bloqueantes**:
- Auth bloquea todo lo demás (sin usuario no hay citas)
- CRUD Citas bloquea calendario (sin datos no hay vista)
- Stripe requiere citas funcionales (no tiene sentido pagar algo que no existe)

---

## 5. Criterios de Aceptación

### 5.1 MVP Done (Semana 6)

| Criterio | Métrica | Validación |
|----------|---------|-----------|
| **Registro/Login** | < 2 minutos completar | E2E test automatizado |
| **Reserva de cita** | < 3 minutos, 5 clicks máx | User testing (5 usuarios) |
| **Disponibilidad** | 100% precisa en tiempo real | Test de concurrencia (100 requests simultáneos) |
| **Email confirmación** | < 1 minuto delivery | Logging + Resend dashboard |
| **Cancelación** | < 30 segundos, sin errores | Test manual + automatizado |
| **Performance** | Lighthouse > 90 | Audit automatizado en CI |
| **Mobile responsive** | Funcional en 320px-768px | Test en Chrome DevTools + devices reales |

**MVP Exit Criteria**: Usuario nuevo puede registrarse, reservar una cita, recibir confirmación por email, y cancelar sin asistencia.

---

### 5.2 v1 Done (Semana 10)

| Criterio | Métrica | Validación |
|----------|---------|-----------|
| **Pagos Stripe** | 99% transacciones exitosas | Test mode + sandbox |
| **Webhook reliability** | 100% eventos procesados | Logging + retry mechanism |
| **Panel Admin** | Todas las entidades gestionables | Checklist de features |
| **SMS notifications** | 95% delivery rate | Twilio dashboard |
| **Lista de espera** | Notificación < 5 minutos | Test de liberación de slot |
| **Política cancelación** | Reglas aplicadas correctamente | Test de casos borde |

**v1 Exit Criteria**: Sistema puede procesar pagos reales, administrar negocio desde panel, y notificar por email + SMS.

---

### 5.3 v2 Done (Semana 14)

| Criterio | Métrica | Validación |
|----------|---------|-----------|
| **Reseñas** | 80% clientes califican | Analytics post-cita |
| **Analytics** | Reportes < 5 segundos | Query performance testing |
| **Multi-empleado** | Asignación automática funcional | Test de escenarios complejos |
| **Promociones** | Cupones aplicados correctamente | Test de validación |
| **Uptime** | > 99% (excluyendo mantenimiento) | Uptime monitoring |
| **Error rate** | < 0.1% requests | Error tracking (Sentry) |

**v2 Exit Criteria**: Sistema maduro con feedback de clientes, insights de negocio accionables, y gestión eficiente de múltiples empleados.

---

### 5.4 Métricas de Éxito (KPIs)

| KPI | Target MVP | Target v1 | Target v2 |
|-----|------------|-----------|-----------|
| **Tiempo reserva** | < 3 min | < 2 min | < 2 min |
| **No-show rate** | < 20% | < 15% | < 10% |
| **Email open rate** | > 60% | > 70% | > 75% |
| **Pago exitoso** | N/A | > 95% | > 98% |
| **NPS** | N/A | > 40 | > 60 |
| **Retención 30 días** | N/A | > 50% | > 70% |

---

## 6. Riesgos y Mitigación

### 6.1 Riesgos Técnicos Confirmados

| Riesgo | Severidad | Probabilidad | Impacto | Mitigación |
|--------|-----------|--------------|---------|------------|
| **Timezones mal manejados** | 🔴 Alto | 🔴 Alta | Double booking, citas en horario incorrecto | **Estandar UTC en DB** + timezone por usuario en frontend. Usar `date-fns-tz` para conversiones. Tests específicos de timezone. |
| **Double booking** | 🔴 Alto | 🟡 Media | Pérdida de confianza, conflicto operacional | **Unique constraints** en DB (`empleadoId + fechaInicio`). Transacciones atómicas para creación. Locking optimista con versionado. |
| **Webhooks fallidos (Stripe)** | 🔴 Alto | 🟡 Media | Pagos no confirmados, inconsistencia datos | **Idempotencia** (stripeIdempotencyKey). Retry queue con backoff exponencial. Dashboard de monitoreo de webhooks fallidos. |
| **Performance calendario** | 🟡 Medio | 🟡 Media | UX pobre, timeout en carga | **Virtualización** (render solo slots visibles). Paginación de meses. Cache Redis de disponibilidades. Lazy loading de componentes. |
| **Security vulnerabilities** | 🔴 Alto | 🟠 Baja | Brecha datos, multas legales | **Middlewares de seguridad** (helmet, rateLimit, XSS protection). Audits SAST/DAST trimestrales. Secrets en variables de ambiente (nunca en código). |
| **Pérdida de datos** | 🔴 Alto | 🟠 Baja | Irreversible, daño reputacional | **Backups automáticos** diarios (Railway). Point-in-time recovery habilitado. Script de restore testeado mensualmente. |
| **Rate limiting de APIs** | 🟡 Medio | 🟡 Media | Emails/SMS no enviados | **Queue de notificaciones** (BullMQ). Retry con backoff. Fallback a email si SMS falla. Monitoreo de cuotas. |

### 6.2 Riesgos de Negocio

| Riesgo | Severidad | Probabilidad | Mitigación |
|--------|-----------|--------------|------------|
| **Scope creep** | 🟡 Medio | 🔴 Alta | Documentar scope explícito. Change request formal para features fuera de scope. Priorizar con MoSCoW. |
| **Dependencies externas** | 🟡 Medio | 🟡 Media | Stripe/Resend/Twilio cambian APIs o pricing | Abstracción con interfaces. Tests de integración que alerten breaking changes. Budget para aumentos de pricing. |
| **Adopción baja** | 🟡 Medio | 🟡 Media | Usuarios no adoptan sistema | Onboarding guiado (tutorial interactivo). Soporte responsive (chat/email). Feedback loops tempranos (beta testers). |

### 6.3 Plan de Contingencia

```
Escenario: Double booking ocurre en producción
  1. Detectar vía monitoring (error log + user report)
  2. Notificar a ambos clientes inmediatamente (email + SMS)
  3. Ofrecer compensación (descuento próxima cita)
  4. Hotfix: reforzar locking en creación de citas
  5. Post-mortem: identificar root cause, actualizar tests

Escenario: Stripe webhook falla por > 1 hora
  1. Alerta automática vía monitoring (webhook failures > threshold)
  2. Revisar logs de Stripe Dashboard
  3. Reprocesar eventos fallidos manualmente
  4. Si persiste: fallback a polling temporal (cada 5 min)
  5. Contactar soporte Stripe si es issue de su lado
```

---

## 7. Recursos Necesarios

### 7.1 Servicios Externos Requeridos

| Servicio | Propósito | Plan | Costo Mensual Estimado |
|----------|-----------|------|----------------------|
| **Vercel** | Hosting Frontend + CDN | Pro (si escala) | $0 → $20/mes |
| **Railway** | Hosting Backend + PostgreSQL + Redis | Pay per use | $5-30/mes |
| **Stripe** | Procesamiento pagos | Standard (2.9% + $0.30) | Variable por transacción |
| **Resend** | Email transaccional | Growth (si escala) | $0 → $30/mes (hasta 30k emails) |
| **Twilio** | SMS notifications | Pay per use | ~$0.0075/SMS (USA) |
| **Sentry** | Error tracking (opcional) | Team | $0 → $26/mes |
| **UptimeRobot** | Monitoreo uptime | Free | $0 (50 checks, 5 min) |

### 7.2 Cuentas a Crear (Setup Inicial)

| Servicio | Prioridad | Cuándo | Responsable |
|----------|-----------|--------|-------------|
| **Vercel** | 🔴 Critical | Día 1 | Dev Lead |
| **Railway** | 🔴 Critical | Día 1 | Dev Lead |
| **GitHub** | 🔴 Critical | Día 1 | Todos |
| **Stripe (test mode)** | 🔴 Critical | Semana 7 | Dev Lead |
| **Resend** | 🟡 High | Semana 3 | Dev |
| **Twilio** | 🟡 High | Semana 8 | Dev |
| **Sentry** | 🟢 Medium | Semana 5 | Dev |

### 7.3 Costos Totales Estimados

| Fase | Infraestructura | Servicios | Total Mensual |
|------|----------------|-----------|---------------|
| **Desarrollo (sem 1-6)** | $10 (Railway) | $0 (test modes) | **$10/mes** |
| **MVP (sem 7-10)** | $20 (Railway + Vercel) | $0 (test modes) | **$20/mes** |
| **v1 Launch** | $40 (escalado) | $30 (Resend) + Stripe fees | **$70 + Stripe/mes** |
| **v2 Scale** | $60 (multi-instance) | $50 (Resend + Twilio) + Stripe | **$110 + Stripe/mes** |

**Nota**: Stripe fees = 2.9% + $0.30 por transacción. Ej: $10k en ventas → ~$320/mes en fees.

---

## 8. Recomendación de Implementación

### 8.1 Orden Recomendado de Features

```
FASE 1: FUNDACIÓN (Semana 1-2)
  1. Setup del repo (monorepo, CI/CD, linting, testing)
  2. Schema Prisma + migraciones iniciales
  3. Auth (registro, login, refresh tokens, roles)
  4. Middleware de seguridad (helmet, cors, rateLimit)
  → Hito: Auth funcional + DB corriendo local

FASE 2: CORE DEL NEGOCIO (Semana 2-4)
  5. CRUD Servicios (admin puede crear/editar)
  6. CRUD Citas (cliente puede reservar)
  7. Disponibilidad de empleados (horarios base)
  8. Validación de conflictos (double booking prevention)
  → Hito: Reserva completa funcional (sin email)

FASE 3: UX Y NOTIFICACIONES (Semana 4-6)
  9. Calendario FullCalendar (vista semanal/mensual)
  10. Email notifications (Resend)
  11. Dashboard cliente (ver sus citas)
  12. Testing E2E + bug fixing
  → Hito: MVP listo para demo

FASE 4: MONETIZACIÓN (Semana 7-8)
  13. Stripe PaymentIntents
  14. Webhook handler (confirmación pagos)
  15. Reembolsos (parciales/totales)
  16. Panel Admin (métricas básicas)
  → Hito: Sistema puede cobrar

FASE 5: MADUREZ (Semana 9-10)
  17. SMS notifications (Twilio)
  18. Lista de espera (waitlist)
  19. Políticas de cancelación configurables
  20. Testing carga + optimización
  → Hito: v1 lista para producción

FASE 6: ESCALABILIDAD (Semana 11-14)
  21. Reseñas y calificaciones
  22. Analytics avanzados (reportes)
  23. Multi-empleado (asignación automática)
  24. Promociones y cupones
  → Hito: v2 completa
```

### 8.2 Qué Construir Primero (Prioridad Máxima)

1. **Auth + Schema** → Sin usuarios no hay nada más
2. **CRUD Citas** → Core del negocio
3. **Validación conflictos** → Prevenir double booking DESDE EL DÍA 1
4. **Calendario** → UX crítica para reservas
5. **Email** → Confirmación básica (reduce no-shows)

### 8.3 Qué Dejar para Después (Puede Esperar)

1. **Reseñas** → Necesita volumen de citas primero
2. **Analytics avanzados** → MVP con métricas básicas es suficiente
3. **Promociones** → Validar producto antes de marketing
4. **App móvil** → PWA responsive es suficiente para validar
5. **Multi-tenant** → Enfocarse en un solo negocio primero

### 8.4 Principios Guía

| Principio | Aplicación |
|-----------|-----------|
| **YAGNI** | No construir features "por si acaso" |
| **KISS** | Solución más simple que funcione |
| **Fail Fast** | Testear temprano, iterar rápido |
| **Security First** | Auth y validación desde día 1 |
| **Observability** | Logging y monitoreo desde el inicio |

---

## 9. Aprobación y Siguientes Pasos

### 9.1 Aprobación Requerida

Esta propuesta debe ser revisada y aprobada antes de proceder a la fase de **Specs**.

**Aprobadores**:
- [ ] Product Owner / Stakeholder
- [ ] Tech Lead
- [ ] Dev Team

### 9.2 Siguiente Fase: Specs

Una vez aprobada esta propuesta, el siguiente paso es la **Fase de Especificaciones Detalladas** (`/sdd-spec`).

**Entregables de Specs**:
- User stories detalladas con criterios de aceptación
- Especificación de cada endpoint (request/response)
- Diagramas de flujo (reserva, pago, cancelación)
- Casos de prueba (unit tests, integration tests, E2E)
- Definición de errores y códigos de respuesta

**Timeline**: 1-2 semanas

### 9.3 Cambios a Esta Propuesta

Cualquier cambio al scope, timeline, o arquitectura debe ser:
1. Documentado en este archivo (historial de cambios)
2. Aprobado por stakeholders
3. Reflejado en el `state.yaml`

---

## Historial de Cambios

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2025-03-11 | AI Assistant | Propuesta inicial basada en exploración técnica |

---

**Status**: ✅ Completed  
**Next Phase**: `/sdd-spec`  
**Artifact Mode**: hybrid (Engram + OpenSpec)
