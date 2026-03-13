# 📝 ESPECIFICACIONES TÉCNICAS: Sistema de Reservas de Citas de Servicios

**Change**: sistema-reservas  
**Phase**: Spec  
**Status**: ✅ Completed  
**Date**: 2026-03-11  
**Mode**: hybrid (Engram + OpenSpec)  
**Based on**: proposal.md v1.0

---

## 1. Visión General del Documento

Este documento especifica los requisitos detallados, criterios de aceptación, escenarios de prueba, y especificaciones técnicas para el Sistema de Reservas de Citas de Servicios.

### 1.1 Relación con Otros Artefactos

| Artefacto | Estado | Ubicación |
|-----------|--------|-----------|
| Exploration | ✅ Completed | `openspec/changes/sistema-reservas/artifacts/explore.md` |
| Proposal | ✅ Completed | `openspec/changes/sistema-reservas/artifacts/proposal.md` |
| **Spec** | ✅ Completed | `openspec/changes/sistema-reservas/artifacts/spec.md` |
| Design | 🔲 Pending | `openspec/changes/sistema-reservas/artifacts/design.md` |
| Tasks | 🔲 Pending | `openspec/changes/sistema-reservas/artifacts/tasks.md` |

---

## 2. Requisitos Funcionales Detallados

### 2.1 Módulo de Autenticación (AUTH)

#### AUTH-001: Registro de Usuario

**Descripción**: Un usuario nuevo puede crear una cuenta en el sistema.

**Actores**: Cliente potencial

**Precondiciones**:
- Usuario no tiene cuenta registrada
- Usuario tiene email válido

**Flujo Principal**:
1. Usuario navega a `/registro`
2. Usuario completa formulario (nombre, email, password, confirmar password)
3. Sistema valida datos en frontend (Zod)
4. Usuario envía formulario
5. Sistema valida unicidad de email en backend
6. Sistema hashea password (bcrypt, 10 rounds)
7. Sistema crea usuario en DB con rol `CLIENTE`
8. Sistema genera JWT token + refresh token
9. Sistema envía email de bienvenida (Resend)
10. Usuario es redirigido a `/dashboard`

**Postcondiciones**:
- Usuario está autenticado
- Email de confirmación enviado

**Criterios de Aceptación**:
- [ ] Email debe ser único (case-insensitive)
- [ ] Password mínimo 8 caracteres, 1 mayúscula, 1 número
- [ ] Token expira en 15 minutos
- [ ] Refresh token expira en 7 días
- [ ] Email de bienvenida se envía en < 30 segundos

**Escenarios de Prueba**:

| ID | Escenario | Datos | Resultado Esperado |
|----|-----------|-------|-------------------|
| AUTH-001-T01 | Registro exitoso | nombre: "Juan", email: "juan@test.com", password: "Test1234" | Usuario creado, redirect a dashboard |
| AUTH-001-T02 | Email duplicado | email: "existing@test.com" | Error 409: "Email ya registrado" |
| AUTH-001-T03 | Password débil | password: "123" | Error frontend: "Password muy corto" |
| AUTH-001-T04 | Email inválido | email: "invalid" | Error frontend: "Email inválido" |
| AUTH-001-T05 | Campos vacíos | todos vacíos | Error frontend: "Campo requerido" |

---

#### AUTH-002: Login de Usuario

**Descripción**: Usuario registrado puede iniciar sesión.

**Actores**: Usuario registrado

**Precondiciones**:
- Usuario tiene cuenta activa

**Flujo Principal**:
1. Usuario navega a `/login`
2. Usuario ingresa email y password
3. Sistema valida credenciales
4. Sistema genera JWT + refresh token
5. Sistema actualiza `lastLoginAt`
6. Usuario es redirigido a dashboard según rol

**Criterios de Aceptación**:
- [ ] Login exitoso retorna tokens en < 500ms
- [ ] Password incorrecto retorna error genérico (seguridad)
- [ ] Rate limiting: 5 intentos fallidos por 15 minutos
- [ ] Refresh token se rota en cada uso

**Escenarios de Prueba**:

| ID | Escenario | Datos | Resultado Esperado |
|----|-----------|-------|-------------------|
| AUTH-002-T01 | Login exitoso | email: "juan@test.com", password: "Test1234" | Tokens retornados, redirect |
| AUTH-002-T02 | Password incorrecto | password: "Wrong123" | Error 401: "Credenciales inválidas" |
| AUTH-002-T03 | Usuario no existe | email: "nobody@test.com" | Error 401: "Credenciales inválidas" |
| AUTH-002-T04 | Rate limit excedido | 6 intentos en 15 min | Error 429: "Demasiados intentos" |

---

#### AUTH-003: Refresh Token

**Descripción**: Sistema renueva access token usando refresh token.

**Actores**: Usuario autenticado con token próximo a expirar

**Precondiciones**:
- Usuario tiene refresh token válido

**Flujo Principal**:
1. Frontend detecta token próximo a expirar (o expirado)
2. Frontend llama a `POST /api/auth/refresh` con refresh token
3. Sistema valida refresh token (firma + expiración + no revocado)
4. Sistema invalida refresh token anterior (rotación)
5. Sistema genera nuevo par de tokens
6. Frontend almacena nuevos tokens

**Criterios de Aceptación**:
- [ ] Refresh token se rota en cada uso
- [ ] Refresh token revocado retorna 401
- [ ] Nuevo token tiene expiry de 15 minutos

**Escenarios de Prueba**:

| ID | Escenario | Resultado Esperado |
|----|-----------|-------------------|
| AUTH-003-T01 | Refresh exitoso | Nuevos tokens retornados |
| AUTH-003-T02 | Token ya usado | Error 401: "Token revocado" |
| AUTH-003-T03 | Token expirado | Error 401: "Token expirado" |
| AUTH-003-T04 | Token inválido | Error 401: "Token inválido" |

---

#### AUTH-004: Logout

**Descripción**: Usuario cierra sesión activamente.

**Flujo**:
1. Usuario hace click en "Cerrar sesión"
2. Frontend invalida tokens localmente
3. Frontend llama a `POST /api/auth/logout` (opcional, para revocar refresh token en backend)
4. Usuario es redirigido a `/login`

**Criterios de Aceptación**:
- [ ] Tokens eliminados de localStorage/cookies
- [ ] Usuario no puede acceder a rutas protegidas
- [ ] Refresh token revocado en backend

---

#### AUTH-005: Recuperación de Password

**Descripción**: Usuario puede resetear password olvidado.

**Flujo Principal**:
1. Usuario navega a `/recuperar-password`
2. Usuario ingresa email
3. Sistema genera token único (expiry: 1 hora)
4. Sistema envía email con link de reset (`/reset-password?token=xxx`)
5. Usuario hace click en link
6. Usuario ingresa nuevo password (2 veces)
7. Sistema valida token
8. Sistema actualiza password (hashea)
9. Sistema invalida todos los refresh tokens del usuario

**Criterios de Aceptación**:
- [ ] Token expira en 1 hora
- [ ] Token solo puede usarse una vez
- [ ] Email no existe → mensaje genérico (seguridad)
- [ ] Todos los tokens activos del usuario son revocados

---

### 2.2 Módulo de Citas (APPT)

#### APPT-001: Crear Cita

**Descripción**: Cliente puede reservar una cita para un servicio.

**Actores**: Cliente autenticado

**Precondiciones**:
- Usuario está autenticado con rol CLIENTE
- Servicio existe y está activo
- Empleado existe y está activo
- Slot de tiempo está disponible

**Flujo Principal**:
1. Usuario selecciona servicio
2. Usuario selecciona empleado (opcional, puede ser "cualquiera")
3. Sistema muestra slots disponibles (próximos 30 días)
4. Usuario selecciona fecha y hora
5. Sistema valida disponibilidad (última verificación)
6. Usuario confirma reserva
7. Sistema crea cita en estado `CONFIRMADA` (o `PAGADA` si requiere pago)
8. Sistema envía email de confirmación
9. Usuario ve resumen de cita

**Criterios de Aceptación**:
- [ ] Validación de disponibilidad es atómica (previene double booking)
- [ ] Email de confirmación se envía en < 1 minuto
- [ ] Cita creada retorna ID y detalles completos
- [ ] Slot se marca como no disponible inmediatamente

**Reglas de Negocio**:
- RN-001: Cita no puede ser en el pasado
- RN-002: Cita debe respetar duración del servicio
- RN-003: Cita debe estar dentro del horario laboral del empleado
- RN-004: Cita no puede superponerse con otra cita del mismo empleado
- RN-005: Cita requiere mínimo 2 horas de anticipación (configurable)

**Escenarios de Prueba**:

| ID | Escenario | Resultado Esperado |
|----|-----------|-------------------|
| APPT-001-T01 | Reserva exitosa | Cita creada, email enviado |
| APPT-001-T02 | Slot ya reservado | Error 409: "Horario no disponible" |
| APPT-001-T03 | Hora en el pasado | Error 400: "Fecha inválida" |
| APPT-001-T04 | Fuera de horario laboral | Error 400: "Horario no disponible" |
| APPT-001-T05 | Sin anticipación mínima | Error 400: "Reserva con poca anticipación" |

---

#### APPT-002: Cancelar Cita

**Descripción**: Cliente o empleado puede cancelar una cita.

**Actores**: Cliente (propietario), Empleado, Admin

**Precondiciones**:
- Cita existe en estado `CONFIRMADA` o `PAGADA`
- Cancelación respeta política de cancelación (ej: 24h antes)

**Flujo Principal**:
1. Usuario navega a detalle de cita
2. Usuario hace click en "Cancelar cita"
3. Sistema muestra confirmación + política de cancelación
4. Usuario confirma cancelación
5. Sistema valida política de cancelación
6. Sistema actualiza estado a `CANCELADA`
7. Sistema libera slot de disponibilidad
8. Sistema envía email de cancelación
9. Si aplica, sistema inicia reembolso

**Criterios de Aceptación**:
- [ ] Cancelación < 24h → aplica penalidad (configurable)
- [ ] Slot se libera inmediatamente
- [ ] Email de cancelación se envía en < 1 minuto
- [ ] Reembolso se procesa en < 24 horas (si aplica)

**Reglas de Negocio**:
- RN-006: Cancelación < 24h → 50% de penalidad (configurable)
- RN-007: Cancelación < 2h → 100% de penalidad (no reembolsa)
- RN-008: Solo propietario, empleado asignado, o admin puede cancelar

---

#### APPT-003: Reagendar Cita

**Descripción**: Cliente puede cambiar fecha/hora de cita existente.

**Actores**: Cliente (propietario), Admin

**Precondiciones**:
- Cita existe en estado `CONFIRMADA` o `PAGADA`
- Nuevo slot está disponible

**Flujo Principal**:
1. Usuario navega a detalle de cita
2. Usuario hace click en "Reagendar"
3. Sistema muestra calendario con slots disponibles
4. Usuario selecciona nueva fecha/hora
5. Sistema valida disponibilidad
6. Sistema actualiza cita
7. Sistema envía email de confirmación con nuevos datos

**Criterios de Aceptación**:
- [ ] Reagendamiento respeta política de cancelación (si cambia < 24h)
- [ ] Slot anterior se libera, nuevo slot se reserva
- [ ] Email de actualización se envía

---

#### APPT-004: Listar Citas (Cliente)

**Descripción**: Cliente puede ver historial de sus citas.

**Actores**: Cliente autenticado

**Flujo**:
1. Usuario navega a `/mis-citas`
2. Sistema retorna citas del usuario (próximas + históricas)
3. Sistema muestra citas ordenadas por fecha (descendente)
4. Usuario puede filtrar por estado (próximas, completadas, canceladas)

**Criterios de Aceptación**:
- [ ] Pagination: 20 citas por página
- [ ] Filtros funcionales por estado
- [ ] Performance: < 500ms para carga inicial

---

#### APPT-005: Listar Citas (Empleado/Admin)

**Descripción**: Empleado o Admin puede ver citas asignadas o de todo el negocio.

**Actores**: Empleado, Admin

**Criterios de Aceptación**:
- [ ] Empleado ve solo sus citas asignadas
- [ ] Admin ve todas las citas del negocio
- [ ] Filtros por empleado, fecha, estado
- [ ] Vista de calendario (semanal/mensual)

---

### 2.3 Módulo de Servicios (SRV)

#### SRV-001: CRUD Servicios (Admin)

**Descripción**: Admin puede crear, editar, eliminar servicios.

**Actores**: Admin

**Campos de Servicio**:
- `nombre` (string, único, 3-100 caracteres)
- `descripcion` (string, opcional, máx 500 caracteres)
- `duracion` (integer, minutos, 15-480)
- `precio` (decimal, 0-10000, 2 decimales)
- `activo` (boolean, default true)
- `categoria` (string, opcional)
- `imagenUrl` (string, URL válida, opcional)

**Criterios de Aceptación**:
- [ ] Nombre único (case-insensitive)
- [ ] Duración múltiplo de 15 minutos
- [ ] Servicio no se elimina, se marca como inactivo (soft delete)
- [ ] Servicio inactivo no aparece en booking

---

#### SRV-002: Listar Servicios (Público)

**Descripción**: Cualquier usuario puede ver lista de servicios activos.

**Actores**: Usuario autenticado o anónimo (según configuración)

**Criterios de Aceptación**:
- [ ] Solo servicios activos se muestran
- [ ] Incluye duración y precio
- [ ] Ordenados por categoría + nombre

---

### 2.4 Módulo de Empleados (EMP)

#### EMP-001: Gestión de Empleados (Admin)

**Descripción**: Admin puede crear, editar, eliminar empleados.

**Campos de Empleado**:
- `nombre` (string, 3-100 caracteres)
- `email` (string, único, válido)
- `telefono` (string, opcional)
- `rol` (enum: EMPLEADO, ADMIN)
- `activo` (boolean, default true)
- `servicios` (array de IDs de servicio)
- `horarioLaboral` (objeto: lunes a domingo, inicio, fin)

**Criterios de Aceptación**:
- [ ] Email único
- [ ] Empleado no se elimina, se marca inactivo
- [ ] Empleado inactivo no aparece en booking

---

#### EMP-002: Gestión de Disponibilidad

**Descripción**: Empleado/Admin puede gestionar horarios laborales y excepciones.

**Tipos de Disponibilidad**:
1. **Horario Regular**: Lunes a Viernes 9:00-18:00
2. **Excepciones**: Días festivos, vacaciones (no disponible)
3. **Bloqueos**: Bloquear slot específico (cita personal, reunión)

**Criterios de Aceptación**:
- [ ] Horario regular se repite semanalmente
- [ ] Excepciones tienen prioridad sobre horario regular
- [ ] Bloqueos crean citas internas (no reservables)

---

### 2.5 Módulo de Calendario (CAL)

#### CAL-001: Vista de Calendario

**Descripción**: Usuario ve disponibilidad en calendario interactivo.

**Actores**: Cliente, Empleado, Admin

**Requisitos**:
- Vista semanal (default)
- Vista mensual (toggle)
- Slots de 15 minutos (configurable)
- Colores por estado (disponible, ocupado, bloqueado)
- Click en slot → inicia booking

**Criterios de Aceptación**:
- [ ] FullCalendar integrado correctamente
- [ ] Slots deshabilitados visualmente (pasados, no disponibles)
- [ ] Performance: render < 1 segundo para 30 días
- [ ] Mobile responsive (touch-friendly)

---

#### CAL-002: Cálculo de Disponibilidad

**Descripción**: Sistema calcula slots disponibles en tiempo real.

**Algoritmo**:
```
1. Obtener horario laboral del empleado para el día
2. Obtener todas las citas confirmadas para el día
3. Obtener bloqueos/excepciones
4. Calcular slots libres (horario - citas - bloqueos)
5. Filtrar slots < 2 horas (anticipación mínima)
6. Retornar slots en incrementos de 15 minutos
```

**Criterios de Aceptación**:
- [ ] Cálculo es preciso (sin double booking)
- [ ] Performance: < 200ms para 1 día
- [ ] Cache Redis para consultas repetidas (TTL: 1 minuto)

---

### 2.6 Módulo de Notificaciones (NOTIF)

#### NOTIF-001: Email de Confirmación de Cita

**Descripción**: Sistema envía email cuando se crea una cita.

**Trigger**: Cita creada (estado `CONFIRMADA`)

**Contenido del Email**:
- Asunto: "Confirmación de cita - {fecha} {hora}"
- Nombre del cliente
- Servicio contratado
- Empleado asignado
- Fecha y hora
- Duración
- Ubicación (si aplica)
- Botón: "Ver cita" → link a `/citas/{id}`
- Botón: "Cancelar cita" → link a `/citas/{id}/cancelar`

**Criterios de Aceptación**:
- [ ] Email se envía en < 1 minuto
- [ ] Email es responsive (mobile-friendly)
- [ ] Links son únicos y seguros (tokenizado)

---

#### NOTIF-002: Recordatorio de Cita (24h antes)

**Descripción**: Sistema envía recordatorio 24 horas antes de la cita.

**Trigger**: Job programado (cron) ejecuta cada hora

**Algoritmo**:
```
1. Query: citas donde (fechaInicio - 24 horas) está en la próxima hora
2. Para cada cita:
   - Verificar estado es CONFIRMADA o PAGADA
   - Verificar cliente no ha cancelado
   - Enviar email de recordatorio
   - Loguear envío
```

**Contenido del Email**:
- Asunto: "Recordatorio: Tu cita es mañana"
- Detalles de la cita
- Botón: "Reagendar" o "Cancelar"

**Criterios de Aceptación**:
- [ ] Email se envía exactamente 24h antes (±1 hora)
- [ ] No se reenvía si ya se envió
- [ ] Job es idempotente

---

#### NOTIF-003: Email de Cancelación

**Descripción**: Sistema envía email cuando una cita es cancelada.

**Trigger**: Cita actualizada a estado `CANCELADA`

**Contenido**:
- Asunto: "Cancelación de cita"
- Detalles de la cita cancelada
- Información de reembolso (si aplica)
- Botón: "Reservar nueva cita"

---

#### NOTIF-004: SMS de Recordatorio (v1)

**Descripción**: Sistema envía SMS opcional 24h antes.

**Trigger**: Mismo que NOTIF-002, si cliente optó por SMS

**Contenido SMS**:
```
{Negocio}: Recordatorio de cita mañana {fecha} a las {hora}. 
Servicio: {servicio}. Responder C para cancelar o R para reagendar.
```

**Criterios de Aceptación**:
- [ ] SMS se envía solo si cliente dio consentimiento
- [ ] Longitud < 160 caracteres (1 SMS)
- [ ] Opt-out funcional (responder STOP)

---

### 2.7 Módulo de Pagos (PAY) - v1

#### PAY-001: Crear PaymentIntent (Stripe)

**Descripción**: Sistema crea PaymentIntent para cobrar cita.

**Trigger**: Usuario procede a pagar en flujo de booking

**Flujo**:
1. Frontend llama a `POST /api/payments/create-intent`
2. Backend calcula monto (precio del servicio)
3. Backend crea PaymentIntent en Stripe
4. Backend retorna `clientSecret`
5. Frontend muestra Stripe Elements form
6. Usuario ingresa datos de tarjeta
7. Frontend confirma pago con `clientSecret`
8. Stripe procesa pago
9. Stripe envía webhook de confirmación
10. Backend actualiza cita a `PAGADA`

**Criterios de Aceptación**:
- [ ] PaymentIntent se crea con monto correcto
- [ ] `clientSecret` se retorna seguro (no se loguea)
- [ ] Cita no se confirma hasta webhook recibido

---

#### PAY-002: Webhook de Stripe

**Descripción**: Sistema procesa eventos de Stripe vía webhook.

**Eventos a procesar**:
- `payment_intent.succeeded` → Cita a `PAGADA`
- `payment_intent.payment_failed` → Cita a `CANCELADA`, notificar cliente
- `charge.refunded` → Cita a `REEMBOLSADA`

**Flujo**:
1. Stripe envía POST a `/api/webhooks/stripe`
2. Sistema verifica firma (Stripe-Signature header)
3. Sistema verifica idempotencia (stripeIdempotencyKey)
4. Sistema procesa evento según tipo
5. Sistema actualiza DB
6. Sistema retorna 200 OK

**Criterios de Aceptación**:
- [ ] Firma verificada (previene spoofing)
- [ ] Idempotencia: evento duplicado no se procesa 2 veces
- [ ] Webhook responde en < 2 segundos
- [ ] Eventos fallidos se loguean y reintentan

**Manejo de Errores**:
- Error de firma → 400 Bad Request
- Error de procesamiento → 500 Internal (Stripe reintentará)
- Evento desconocido → 200 OK (ignorar)

---

#### PAY-003: Reembolso

**Descripción**: Admin puede procesar reembolso total o parcial.

**Actores**: Admin

**Flujo**:
1. Admin navega a detalle de cita pagada
2. Admin hace click en "Reembolsar"
3. Admin selecciona monto (total o parcial)
4. Admin confirma
5. Sistema llama a Stripe Refund API
6. Stripe procesa reembolso
7. Sistema actualiza cita a `REEMBOLSADA`
8. Sistema envía email de confirmación

**Criterios de Aceptación**:
- [ ] Reembolso parcial ≤ monto original
- [ ] Reembolso total marca cita como `REEMBOLSADA`
- [ ] Email de reembolso se envía

---

### 2.8 Módulo de Admin (ADM) - v1

#### ADM-001: Dashboard de Métricas

**Descripción**: Admin ve métricas clave del negocio.

**Métricas**:
- Citas hoy, esta semana, este mes
- Ingresos (día, semana, mes)
- Tasa de ocupación (% slots ocupados)
- Citas canceladas (count + %)
- Próximas citas (lista)

**Criterios de Aceptación**:
- [ ] Métricas se actualizan en tiempo real (polling 1 minuto)
- [ ] Gráficos de ingresos (últimos 30 días)
- [ ] Performance: carga inicial < 2 segundos

---

#### ADM-002: Gestión de Usuarios

**Descripción**: Admin puede ver, editar, eliminar usuarios.

**Acciones**:
- Listar todos los usuarios (con filtros)
- Ver detalle de usuario
- Editar perfil de usuario
- Cambiar rol de usuario
- Desactivar usuario

**Criterios de Aceptación**:
- [ ] Pagination (20 usuarios por página)
- [ ] Filtros por rol, estado
- [ ] Admin no puede desactivarse a sí mismo

---

#### ADM-003: Configuración del Negocio

**Descripción**: Admin puede configurar parámetros del negocio.

**Configuraciones**:
- Nombre del negocio
- Logo
- Dirección
- Teléfono de contacto
- Horario laboral default
- Política de cancelación (horas mínimas, penalidades)
- Anticipación mínima para reservas
- Duración de slots (15, 30, 60 min)

**Criterios de Aceptación**:
- [ ] Configuraciones se guardan en DB
- [ ] Configuraciones aplican inmediatamente
- [ ] Logo se sube a S3-compatible storage

---

### 2.9 Módulo de Lista de Espera (WAIT) - v1

#### WAIT-001: Unirse a Lista de Espera

**Descripción**: Cliente puede unirse a lista de espera para slot ocupado.

**Flujo**:
1. Usuario ve slot ocupado en calendario
2. Usuario hace click en "Unirse a lista de espera"
3. Sistema registra usuario en lista de espera para ese slot
4. Sistema confirma registro

**Criterios de Aceptación**:
- [ ] Usuario puede estar en múltiples listas
- [ ] Usuario puede salir de lista en cualquier momento
- [ ] Orden es FIFO (primero en unirse, primero en ser notificado)

---

#### WAIT-002: Notificación de Slot Disponible

**Descripción**: Sistema notifica cuando slot se libera.

**Trigger**: Cita es cancelada → slot se libera

**Flujo**:
1. Sistema identifica lista de espera para ese slot
2. Sistema toma primer usuario de la lista
3. Sistema envía email: "Slot disponible, reserva en 15 minutos"
4. Sistema reserva slot temporalmente (15 minutos)
5. Si usuario no reserva en 15 minutos → notifica al siguiente

**Criterios de Aceptación**:
- [ ] Email se envía en < 5 minutos
- [ ] Slot se reserva temporalmente (TTL: 15 minutos)
- [ ] Si expira → notifica al siguiente usuario

---

### 2.10 Módulo de Reseñas (REV) - v2

#### REV-001: Crear Reseña

**Descripción**: Cliente puede calificar servicio post-cita.

**Precondiciones**:
- Cita está en estado `COMPLETADA`
- Cita fue hace ≤ 7 días
- Cliente no ha reseñado esa cita antes

**Campos**:
- `citaId` (FK)
- `calificacion` (integer, 1-5 estrellas)
- `comentario` (string, opcional, máx 500 caracteres)
- `anonimo` (boolean, default false)

**Criterios de Aceptación**:
- [ ] Solo 1 reseña por cita
- [ ] Calificación es obligatoria
- [ ] Comentario es opcional
- [ ] Reseña se publica inmediatamente (o requiere aprobación, configurable)

---

#### REV-002: Listar Reseñas

**Descripción**: Usuarios pueden ver reseñas de un servicio o empleado.

**Criterios de Aceptación**:
- [ ] Promedio de calificación visible
- [ ] Reseñas ordenadas por fecha (recientes primero)
- [ ] Filtro por calificación (1-5 estrellas)
- [ ] Reseñas anónimas no muestran nombre completo

---

### 2.11 Módulo de Analytics (ANA) - v2

#### ANA-001: Reporte de Ingresos

**Descripción**: Admin puede ver reporte detallado de ingresos.

**Filtros**:
- Rango de fechas (desde, hasta)
- Por servicio
- Por empleado
- Por estado (pagadas, reembolsadas)

**Métricas**:
- Ingreso total
- Ingreso promedio por día
- Ingreso por servicio
- Ingreso por empleado
- Tasa de crecimiento (vs período anterior)

**Formatos de Exportación**:
- Vista en dashboard (gráficos)
- CSV download
- PDF download

---

#### ANA-002: Reporte de Ocupación

**Descripción**: Admin puede ver tasa de ocupación de empleados.

**Métricas**:
- % slots ocupados vs totales
- Horas facturables vs horas laborales
- Ocupación por empleado
- Ocupación por día de semana
- Horas pico (más ocupadas)

---

### 2.12 Módulo de Promociones (PROMO) - v2

#### PROMO-001: Crear Cupón de Descuento

**Descripción**: Admin puede crear cupones de descuento.

**Campos**:
- `codigo` (string, único, 5-20 caracteres)
- `descripcion` (string, opcional)
- `tipoDescuento` (enum: PORCENTAJE, FIJO)
- `valor` (decimal: 0-100 para porcentaje, 0-10000 para fijo)
- `fechaInicio` (datetime)
- `fechaFin` (datetime)
- `usosMaximos` (integer, opcional, null = ilimitado)
- `usosPorUsuario` (integer, default 1)
- `serviciosAplicables` (array de IDs, null = todos)
- `activo` (boolean)

**Criterios de Aceptación**:
- [ ] Código único (case-insensitive)
- [ ] Cupón expira en fechaFin
- [ ] Cupón se desactiva al alcanzar usosMaximos
- [ ] Cupón solo aplica a servicios configurados

---

#### PROMO-002: Aplicar Cupón en Booking

**Descripción**: Cliente puede aplicar cupón en flujo de pago.

**Flujo**:
1. Usuario ingresa código de cupón
2. Sistema valida cupón (activo, no expirado, usos disponibles)
3. Sistema valida servicio aplica para cupón
4. Sistema calcula descuento
5. Sistema actualiza monto a pagar
6. Usuario procede a pagar

**Criterios de Aceptación**:
- [ ] Validación es inmediata (< 200ms)
- [ ] Descuento se muestra claramente
- [ ] Cupón se marca como usado al confirmar pago

---

## 3. Especificación de API REST

### 3.1 Convenciones Generales

- **Base URL**: `/api`
- **Formato**: JSON (`Content-Type: application/json`)
- **Autenticación**: JWT en header `Authorization: Bearer <token>`
- **Paginación**: Query params `?page=1&limit=20`
- **Filtros**: Query params `?estado=CONFIRMADA&empleadoId=123`
- **Ordenamiento**: `?sort=fechaInicio&order=desc`

### 3.2 Endpoints de Autenticación

#### POST /api/auth/registro

**Request**:
```json
{
  "nombre": "Juan Pérez",
  "email": "juan@test.com",
  "password": "Test1234",
  "telefono": "+1234567890"
}
```

**Response 201 Created**:
```json
{
  "data": {
    "usuario": {
      "id": "usr_123",
      "nombre": "Juan Pérez",
      "email": "juan@test.com",
      "rol": "CLIENTE"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

**Response 409 Conflict** (email duplicado):
```json
{
  "error": {
    "code": "EMAIL_DUPLICADO",
    "message": "Email ya registrado"
  }
}
```

---

#### POST /api/auth/login

**Request**:
```json
{
  "email": "juan@test.com",
  "password": "Test1234"
}
```

**Response 200 OK**:
```json
{
  "data": {
    "usuario": {
      "id": "usr_123",
      "nombre": "Juan Pérez",
      "email": "juan@test.com",
      "rol": "CLIENTE"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

**Response 401 Unauthorized**:
```json
{
  "error": {
    "code": "CREDENCIALES_INVALIDAS",
    "message": "Email o password incorrectos"
  }
}
```

---

#### POST /api/auth/refresh

**Request**:
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response 200 OK**:
```json
{
  "data": {
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

**Response 401 Unauthorized** (token revocado):
```json
{
  "error": {
    "code": "TOKEN_REVOCADO",
    "message": "Token ya fue usado"
  }
}
```

---

#### POST /api/auth/logout

**Request**: (opcional, body vacío)

**Response 200 OK**:
```json
{
  "data": {
    "message": "Sesión cerrada exitosamente"
  }
}
```

---

#### POST /api/auth/recuperar-password

**Request**:
```json
{
  "email": "juan@test.com"
}
```

**Response 200 OK** (siempre 200, por seguridad):
```json
{
  "data": {
    "message": "Si el email existe, se envió un link de recuperación"
  }
}
```

---

#### POST /api/auth/reset-password

**Request**:
```json
{
  "token": "reset_token_abc123",
  "password": "NewPass1234"
}
```

**Response 200 OK**:
```json
{
  "data": {
    "message": "Password actualizado exitosamente"
  }
}
```

**Response 400 Bad Request** (token inválido/expirado):
```json
{
  "error": {
    "code": "TOKEN_INVALIDO",
    "message": "Token inválido o expirado"
  }
}
```

---

### 3.3 Endpoints de Citas

#### GET /api/appointments

**Query Params**: `?page=1&limit=20&estado=CONFIRMADA&desde=2025-01-01&hasta=2025-12-31`

**Response 200 OK**:
```json
{
  "data": {
    "citas": [
      {
        "id": "appt_123",
        "servicio": {
          "id": "srv_1",
          "nombre": "Corte de Pelo",
          "duracion": 30,
          "precio": 25.00
        },
        "empleado": {
          "id": "emp_1",
          "nombre": "María González"
        },
        "cliente": {
          "id": "usr_123",
          "nombre": "Juan Pérez"
        },
        "fechaInicio": "2025-03-15T10:00:00Z",
        "fechaFin": "2025-03-15T10:30:00Z",
        "estado": "CONFIRMADA",
        "notas": "Primera vez"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

#### GET /api/appointments/:id

**Response 200 OK**:
```json
{
  "data": {
    "cita": {
      "id": "appt_123",
      "servicio": {...},
      "empleado": {...},
      "cliente": {...},
      "fechaInicio": "2025-03-15T10:00:00Z",
      "fechaFin": "2025-03-15T10:30:00Z",
      "estado": "CONFIRMADA",
      "notas": "Primera vez",
      "createdAt": "2025-03-10T08:00:00Z",
      "updatedAt": "2025-03-10T08:00:00Z"
    }
  }
}
```

**Response 404 Not Found**:
```json
{
  "error": {
    "code": "CITA_NO_ENCONTRADA",
    "message": "La cita solicitada no existe"
  }
}
```

---

#### POST /api/appointments

**Request**:
```json
{
  "servicioId": "srv_1",
  "empleadoId": "emp_1",
  "fechaInicio": "2025-03-15T10:00:00Z",
  "notas": "Primera vez"
}
```

**Response 201 Created**:
```json
{
  "data": {
    "cita": {
      "id": "appt_123",
      "servicio": {...},
      "empleado": {...},
      "cliente": {...},
      "fechaInicio": "2025-03-15T10:00:00Z",
      "fechaFin": "2025-03-15T10:30:00Z",
      "estado": "CONFIRMADA"
    }
  }
}
```

**Response 409 Conflict** (double booking):
```json
{
  "error": {
    "code": "HORARIO_NO_DISPONIBLE",
    "message": "El horario seleccionado ya no está disponible"
  }
}
```

---

#### PATCH /api/appointments/:id/cancelar

**Request**: (body vacío, o motivo opcional)
```json
{
  "motivo": "Cambio de planes"
}
```

**Response 200 OK**:
```json
{
  "data": {
    "cita": {
      "id": "appt_123",
      "estado": "CANCELADA"
    },
    "reembolso": {
      "aplica": true,
      "monto": 25.00,
      "porcentaje": 100
    }
  }
}
```

---

#### PATCH /api/appointments/:id/reagendar

**Request**:
```json
{
  "nuevaFechaInicio": "2025-03-16T11:00:00Z"
}
```

**Response 200 OK**:
```json
{
  "data": {
    "cita": {
      "id": "appt_123",
      "fechaInicio": "2025-03-16T11:00:00Z",
      "fechaFin": "2025-03-16T11:30:00Z"
    }
  }
}
```

---

### 3.4 Endpoints de Servicios

#### GET /api/services

**Response 200 OK**:
```json
{
  "data": {
    "servicios": [
      {
        "id": "srv_1",
        "nombre": "Corte de Pelo",
        "descripcion": "Corte unisex",
        "duracion": 30,
        "precio": 25.00,
        "activo": true,
        "categoria": "Peluquería"
      }
    ]
  }
}
```

---

#### POST /api/services (Admin)

**Request**:
```json
{
  "nombre": "Corte de Pelo",
  "descripcion": "Corte unisex",
  "duracion": 30,
  "precio": 25.00,
  "categoria": "Peluquería"
}
```

**Response 201 Created**:
```json
{
  "data": {
    "servicio": {
      "id": "srv_1",
      "nombre": "Corte de Pelo",
      "activo": true
    }
  }
}
```

---

#### PATCH /api/services/:id (Admin)

**Request**:
```json
{
  "nombre": "Corte de Pelo Premium",
  "precio": 35.00
}
```

**Response 200 OK**:
```json
{
  "data": {
    "servicio": {
      "id": "srv_1",
      "nombre": "Corte de Pelo Premium",
      "precio": 35.00
    }
  }
}
```

---

### 3.5 Endpoints de Empleados

#### GET /api/employees

**Response 200 OK**:
```json
{
  "data": {
    "empleados": [
      {
        "id": "emp_1",
        "nombre": "María González",
        "email": "maria@negocio.com",
        "activo": true,
        "servicios": [
          {
            "id": "srv_1",
            "nombre": "Corte de Pelo"
          }
        ],
        "horarioLaboral": {
          "lunes": { "inicio": "09:00", "fin": "18:00" },
          "martes": { "inicio": "09:00", "fin": "18:00" },
          ...
        }
      }
    ]
  }
}
```

---

#### GET /api/employees/:id/disponibilidad

**Query Params**: `?fecha=2025-03-15`

**Response 200 OK**:
```json
{
  "data": {
    "empleadoId": "emp_1",
    "fecha": "2025-03-15",
    "slotsDisponibles": [
      "09:00",
      "09:15",
      "09:30",
      "10:00",
      ...
    ],
    "slotsOcupados": [
      "11:00",
      "11:15"
    ],
    "horarioLaboral": {
      "inicio": "09:00",
      "fin": "18:00"
    }
  }
}
```

---

### 3.6 Endpoints de Pagos (v1)

#### POST /api/payments/create-intent

**Request**:
```json
{
  "citaId": "appt_123"
}
```

**Response 200 OK**:
```json
{
  "data": {
    "paymentIntent": {
      "id": "pi_abc123",
      "clientSecret": "pi_abc123_secret_xyz",
      "amount": 2500,
      "currency": "usd"
    }
  }
}
```

---

#### POST /api/webhooks/stripe

**Headers**:
- `Stripe-Signature: t=1234567890,v1=abc123...`

**Body**: (Stripe event JSON)

**Response 200 OK**:
```json
{
  "received": true
}
```

---

### 3.7 Endpoints de Admin (v1)

#### GET /api/admin/dashboard

**Response 200 OK**:
```json
{
  "data": {
    "metricas": {
      "citasHoy": 12,
      "citasSemana": 45,
      "citasMes": 180,
      "ingresosHoy": 450.00,
      "ingresosSemana": 1800.00,
      "ingresosMes": 7200.00,
      "tasaOcupacion": 75.5,
      "citasCanceladas": 5,
      "proximasCitas": [...]
    }
  }
}
```

---

#### GET /api/admin/usuarios

**Query Params**: `?page=1&limit=20&rol=CLIENTE&activo=true`

**Response 200 OK**: (similar a GET /api/appointments con pagination)

---

#### PATCH /api/admin/configuracion

**Request**:
```json
{
  "nombreNegocio": "Belleza Total",
  "politicaCancelacion": {
    "horasMinimas": 24,
    "penalidadPorcentaje": 50
  },
  "anticipacionMinima": 2
}
```

**Response 200 OK**:
```json
{
  "data": {
    "configuracion": {
      "nombreNegocio": "Belleza Total",
      "politicaCancelacion": {...},
      ...
    }
  }
}
```

---

## 4. Modelo de Datos (Prisma Schema)

```prisma
// Usuario
model Usuario {
  id            String    @id @default("usr_" + uuid())
  nombre        String
  email         String    @unique
  passwordHash  String
  telefono      String?
  rol           Rol       @default(CLIENTE)
  activo        Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  citasCliente      Cita[]      @relation("ClienteCitas")
  citasEmpleado     Cita[]      @relation("EmpleadoCitas")
  refreshTokens     RefreshToken[]
  reseñas           Reseña[]
  cuponesUsados     CuponUso[]
  
  @@index([email])
  @@index([rol])
}

enum Rol {
  CLIENTE
  EMPLEADO
  ADMIN
}

// Refresh Token
model RefreshToken {
  id        String   @id @default("rt_" + uuid())
  token     String   @unique
  usuarioId String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
  
  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  
  @@index([token])
  @@index([usuarioId])
}

// Servicio
model Servicio {
  id          String   @id @default("srv_" + uuid())
  nombre      String   @unique
  descripcion String?
  duracion    Int      // minutos
  precio      Decimal  @db.Decimal(10, 2)
  categoria   String?
  imagenUrl   String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  citas         Cita[]
  empleados     EmpleadoServicio[]
  cupones       Cupon[]
  
  @@index([activo])
  @@index([categoria])
}

// Empleado
model Empleado {
  id            String   @id @default("emp_" + uuid())
  usuarioId     String   @unique
  nombre        String
  email         String   @unique
  telefono      String?
  activo        Boolean  @default(true)
  horarioLaboral Json    // { lunes: { inicio: "09:00", fin: "18:00" }, ... }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  usuario       Usuario              @relation(fields: [usuarioId], references: [id])
  servicios     EmpleadoServicio[]
  citas         Cita[]
  disponibilidad Disponibilidad[]
  reseñas       Reseña[]
  
  @@index([activo])
}

model EmpleadoServicio {
  empleadoId  String
  servicioId  String
  createdAt   DateTime @default(now())
  
  empleado Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade)
  servicio Servicio @relation(fields: [servicioId], references: [id], onDelete: Cascade)
  
  @@id([empleadoId, servicioId])
}

// Disponibilidad (excepciones)
model Disponibilidad {
  id          String   @id @default("disp_" + uuid())
  empleadoId  String
  fecha       DateTime @db.Date
  tipo        TipoDisponibilidad
  inicio      String?  // "09:00"
  fin         String?  // "18:00"
  motivo      String?
  createdAt   DateTime @default(now())
  
  empleado Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade)
  
  @@index([empleadoId, fecha])
}

enum TipoDisponibilidad {
  LABORAL
  VACACIONES
  FERIADO
  BLOQUEADO
}

// Cita
model Cita {
  id            String      @id @default("appt_" + uuid())
  clienteId     String
  empleadoId    String
  servicioId    String
  fechaInicio   DateTime
  fechaFin      DateTime
  estado        EstadoCita  @default(CONFIRMADA)
  notas         String?
  paymentIntent String?     @unique
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  cliente    Usuario   @relation("ClienteCitas", fields: [clienteId], references: [id])
  empleado   Empleado  @relation("EmpleadoCitas", fields: [empleadoId], references: [id])
  servicio   Servicio  @relation(fields: [servicioId], references: [id])
  pago       Pago?
  reseña     Reseña?
  waitlist   Waitlist[]
  
  @@index([clienteId])
  @@index([empleadoId])
  @@index([fechaInicio])
  @@index([estado])
  @@unique([empleadoId, fechaInicio]) // Previene double booking
}

enum EstadoCita {
  CONFIRMADA
  PAGADA
  COMPLETADA
  CANCELADA
  REEMBOLSADA
  NO_SHOW
}

// Pago
model Pago {
  id              String   @id @default("pay_" + uuid())
  citaId          String   @unique
  stripePaymentIntentId String @unique
  monto           Decimal  @db.Decimal(10, 2)
  moneda          String   @default("usd")
  estado          EstadoPago
  stripeWebhookData Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  cita Cita @relation(fields: [citaId], references: [id])
  
  @@index([stripePaymentIntentId])
  @@index([estado])
}

enum EstadoPago {
  PENDIENTE
  EXITOSO
  FALLIDO
  REEMBOLSADO
}

// Reseña
model Reseña {
  id          String   @id @default("rev_" + uuid())
  citaId      String   @unique
  clienteId   String
  empleadoId  String?
  calificacion Int     // 1-5
  comentario  String?
  anonimo     Boolean  @default(false)
  aprobado    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  cita     Cita    @relation(fields: [citaId], references: [id])
  cliente  Usuario @relation(fields: [clienteId], references: [id])
  empleado Empleado? @relation(fields: [empleadoId], references: [id])
  
  @@index([empleadoId])
  @@index([calificacion])
}

// Waitlist
model Waitlist {
  id         String   @id @default("wait_" + uuid())
  citaId     String
  clienteId  String
  notificado Boolean  @default(false)
  expiraAt   DateTime?
  createdAt  DateTime @default(now())
  
  cita    Cita    @relation(fields: [citaId], references: [id], onDelete: Cascade)
  cliente Usuario @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  
  @@index([citaId])
  @@index([clienteId])
  @@unique([citaId, clienteId])
}

// Cupón
model Cupon {
  id              String   @id @default("cup_" + uuid())
  codigo          String   @unique
  descripcion     String?
  tipoDescuento   TipoDescuento
  valor           Decimal  @db.Decimal(10, 2)
  fechaInicio     DateTime
  fechaFin        DateTime
  usosMaximos     Int?
  usosActuales    Int      @default(0)
  usosPorUsuario  Int      @default(1)
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  usos CuponUso[]
  
  @@index([codigo])
  @@index([activo])
}

enum TipoDescuento {
  PORCENTAJE
  FIJO
}

model CuponUso {
  id        String   @id @default("cupu_" + uuid())
  cuponId   String
  clienteId String
  citaId    String?
  usadoAt   DateTime @default(now())
  
  cupon   Cupon   @relation(fields: [cuponId], references: [id])
  cliente Usuario @relation(fields: [clienteId], references: [id])
  cita    Cita?   @relation(fields: [citaId], references: [id])
  
  @@index([cuponId])
  @@index([clienteId])
  @@unique([cuponId, clienteId]) // Respects usosPorUsuario
}

// Configuración del Negocio
model Configuracion {
  id                String   @id @default("cfg_" + uuid())
  clave             String   @unique
  valor             Json
  descripcion       String?
  updatedAt         DateTime @updatedAt
  
  @@index([clave])
}
```

---

## 5. Casos de Prueba

### 5.1 Pruebas Unitarias (Vitest)

#### Auth Tests

```typescript
// auth.service.test.ts
describe('AuthService', () => {
  describe('registro', () => {
    it('debe crear usuario con rol CLIENTE', async () => {
      // Arrange
      const datos = { nombre: 'Test', email: 'test@test.com', password: 'Test1234' }
      
      // Act
      const resultado = await authService.registro(datos)
      
      // Assert
      expect(resultado.usuario.email).toBe('test@test.com')
      expect(resultado.usuario.rol).toBe('CLIENTE')
      expect(resultado.tokens.accessToken).toBeDefined()
    })
    
    it('debe fallar si email ya existe', async () => {
      // Arrange
      await authService.registro({ nombre: 'Existing', email: 'test@test.com', password: 'Test1234' })
      
      // Act & Assert
      await expect(
        authService.registro({ nombre: 'Duplicate', email: 'test@test.com', password: 'Test1234' })
      ).rejects.toThrow('EMAIL_DUPLICADO')
    })
  })
  
  describe('login', () => {
    it('debe retornar tokens con credenciales válidas', async () => {
      // Arrange
      await authService.registro({ nombre: 'Test', email: 'test@test.com', password: 'Test1234' })
      
      // Act
      const resultado = await authService.login({ email: 'test@test.com', password: 'Test1234' })
      
      // Assert
      expect(resultado.tokens.accessToken).toBeDefined()
      expect(resultado.tokens.refreshToken).toBeDefined()
    })
    
    it('debe fallar con password incorrecto', async () => {
      // Arrange
      await authService.registro({ nombre: 'Test', email: 'test@test.com', password: 'Test1234' })
      
      // Act & Assert
      await expect(
        authService.login({ email: 'test@test.com', password: 'Wrong123' })
      ).rejects.toThrow('CREDENCIALES_INVALIDAS')
    })
  })
})
```

#### Appointment Tests

```typescript
// appointment.service.test.ts
describe('AppointmentService', () => {
  describe('crearCita', () => {
    it('debe crear cita con estado CONFIRMADA', async () => {
      // Arrange
      const datos = {
        servicioId: 'srv_1',
        empleadoId: 'emp_1',
        fechaInicio: '2025-03-15T10:00:00Z'
      }
      
      // Act
      const cita = await appointmentService.crearCita(datos)
      
      // Assert
      expect(cita.estado).toBe('CONFIRMADA')
      expect(cita.fechaInicio).toBe(datos.fechaInicio)
    })
    
    it('debe fallar si slot ya está ocupado', async () => {
      // Arrange
      await appointmentService.crearCita({
        servicioId: 'srv_1',
        empleadoId: 'emp_1',
        fechaInicio: '2025-03-15T10:00:00Z'
      })
      
      // Act & Assert
      await expect(
        appointmentService.crearCita({
          servicioId: 'srv_1',
          empleadoId: 'emp_1',
          fechaInicio: '2025-03-15T10:00:00Z'
        })
      ).rejects.toThrow('HORARIO_NO_DISPONIBLE')
    })
    
    it('debe fallar si fecha está en el pasado', async () => {
      // Arrange
      const datos = {
        servicioId: 'srv_1',
        empleadoId: 'emp_1',
        fechaInicio: '2020-01-01T10:00:00Z'
      }
      
      // Act & Assert
      await expect(appointmentService.crearCita(datos))
        .rejects.toThrow('FECHA_INVALIDA')
    })
  })
  
  describe('cancelarCita', () => {
    it('debe cambiar estado a CANCELADA', async () => {
      // Arrange
      const cita = await crearCitaDePrueba()
      
      // Act
      const resultado = await appointmentService.cancelarCita(cita.id)
      
      // Assert
      expect(resultado.estado).toBe('CANCELADA')
    })
    
    it('debe aplicar penalidad si cancela < 24h', async () => {
      // Arrange
      const cita = await crearCitaParaManana()
      
      // Act
      const resultado = await appointmentService.cancelarCita(cita.id)
      
      // Assert
      expect(resultado.reembolso.porcentaje).toBe(50) // 50% penalidad
    })
  })
})
```

### 5.2 Pruebas de Integración

#### Test de Double Booking Prevention

```typescript
// appointment.integration.test.ts
describe('Appointment Integration', () => {
  it('debe prevenir double booking con concurrencia', async () => {
    // Arrange
    const slot = '2025-03-15T10:00:00Z'
    const promises = []
    
    // Act: 10 requests simultáneos para el mismo slot
    for (let i = 0; i < 10; i++) {
      promises.push(
        fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            servicioId: 'srv_1',
            empleadoId: 'emp_1',
            fechaInicio: slot
          })
        })
      )
    }
    
    const resultados = await Promise.all(promises)
    const exitosos = resultados.filter(r => r.status === 201)
    const fallidos = resultados.filter(r => r.status === 409)
    
    // Assert
    expect(exitosos.length).toBe(1) // Solo 1 debe tener éxito
    expect(fallidos.length).toBe(9) // 9 deben fallar
  })
})
```

### 5.3 Pruebas E2E (Playwright)

```typescript
// booking.e2e.spec.ts
import { test, expect } from '@playwright/test'

test('flujo completo de reserva', async ({ page }) => {
  // 1. Registro
  await page.goto('/registro')
  await page.fill('[name="nombre"]', 'Test User')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'Test1234')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
  
  // 2. Navegar a booking
  await page.click('text=Reservar Cita')
  await expect(page).toHaveURL('/booking')
  
  // 3. Seleccionar servicio
  await page.click('[data-service-id="srv_1"]')
  
  // 4. Seleccionar empleado
  await page.click('[data-employee-id="emp_1"]')
  
  // 5. Seleccionar fecha y hora
  await page.click('[data-date="2025-03-15"]')
  await page.click('[data-time="10:00"]')
  
  // 6. Confirmar reserva
  await page.click('button:has-text("Confirmar Reserva")')
  
  // 7. Verificar confirmación
  await expect(page.locator('[data-testid="confirmation-message"]')).toBeVisible()
  await expect(page).toHaveURL('/citas/*/confirmacion')
})
```

---

## 6. Definición de Errores

### 6.1 Códigos de Error Estándar

| Código HTTP | Códigos de Error | Descripción |
|-------------|------------------|-------------|
| 400 Bad Request | `VALIDACION_FALLIDO`, `FECHA_INVALIDA`, `CAMPO_REQUERIDO` | Error de validación de datos |
| 401 Unauthorized | `CREDENCIALES_INVALIDAS`, `TOKEN_EXPIRADO`, `TOKEN_INVALIDO`, `TOKEN_REVOCADO` | Error de autenticación |
| 403 Forbidden | `PERMISO_DENEGADO`, `ROL_NO_AUTORIZADO` | Usuario no tiene permisos |
| 404 Not Found | `RECURSO_NO_ENCONTRADO`, `CITA_NO_ENCONTRADA`, `USUARIO_NO_ENCONTRADO` | Recurso no existe |
| 409 Conflict | `EMAIL_DUPLICADO`, `HORARIO_NO_DISPONIBLE`, `CONFLICTO_CONCURRENCIA` | Conflicto de estado |
| 429 Too Many Requests | `RATE_LIMIT_EXCEDIDO` | Demasiadas requests |
| 500 Internal Server Error | `ERROR_INTERNO`, `ERROR_DB`, `ERROR_SERVICIO_EXTERNO` | Error del servidor |

### 6.2 Formato de Respuesta de Error

```json
{
  "error": {
    "code": "HORARIO_NO_DISPONIBLE",
    "message": "El horario seleccionado ya no está disponible",
    "details": {
      "campo": "fechaInicio",
      "valor": "2025-03-15T10:00:00Z"
    },
    "timestamp": "2025-03-11T14:30:00Z",
    "path": "/api/appointments"
  }
}
```

---

## 7. Requisitos No Funcionales

### 7.1 Performance

| Métrica | Target | Medición |
|---------|--------|----------|
| **Tiempo de carga inicial** | < 2 segundos | Lighthouse |
| **Time to Interactive** | < 3.5 segundos | Lighthouse |
| **API response time (p95)** | < 500ms | Monitoring |
| **API response time (p99)** | < 1 segundo | Monitoring |
| **Lighthouse score** | > 90 | CI/CD |

### 7.2 Seguridad

| Requisito | Implementación |
|-----------|---------------|
| **HTTPS everywhere** | Forzar HTTPS en producción |
| **Password hashing** | bcrypt con 10 rounds |
| **JWT secure flags** | httpOnly, secure, sameSite=strict |
| **Rate limiting** | 100 requests / 15 minutos por IP |
| **SQL injection prevention** | Prisma ORM (parameterized queries) |
| **XSS prevention** | Sanitización de inputs, CSP headers |
| **CSRF prevention** | CSRF tokens en forms |
| **Security headers** | helmet middleware |

### 7.3 Disponibilidad

| Requisito | Target |
|-----------|--------|
| **Uptime** | > 99% (excluyendo mantenimiento) |
| **Backup frequency** | Diario automático |
| **Recovery Time Objective (RTO)** | < 4 horas |
| **Recovery Point Objective (RPO)** | < 1 hora |

### 7.4 Escalabilidad

| Requisito | Implementación |
|-----------|---------------|
| **Horizontal scaling** | Backend stateless (JWT) |
| **Database scaling** | PostgreSQL con read replicas (futuro) |
| **Cache** | Redis para consultas frecuentes |
| **CDN** | Vercel Edge Network para static assets |

---

## 8. Criterios de Aceptación por Fase

### 8.1 MVP (Semana 6)

| ID | Criterio | Estado | Validación |
|----|----------|--------|-----------|
| MVP-001 | Usuario puede registrarse en < 2 minutos | 🔲 | E2E test |
| MVP-002 | Usuario puede reservar cita en < 3 minutos | 🔲 | E2E test + user testing |
| MVP-003 | Disponibilidad es 100% precisa | 🔲 | Test de concurrencia |
| MVP-004 | Email de confirmación llega en < 1 minuto | 🔲 | Logging + Resend dashboard |
| MVP-005 | Cancelación funciona en < 30 segundos | 🔲 | Test manual + automatizado |
| MVP-006 | Lighthouse score > 90 | 🔲 | Audit en CI |
| MVP-007 | Mobile responsive (320px-768px) | 🔲 | Test en DevTools + devices reales |

**MVP Exit Criteria**: ✅ Todos los criterios anteriores deben estar aprobados.

---

### 8.2 v1 (Semana 10)

| ID | Criterio | Estado | Validación |
|----|----------|--------|-----------|
| V1-001 | Pagos Stripe: 99% transacciones exitosas | 🔲 | Test mode + sandbox |
| V1-002 | Webhooks: 100% eventos procesados | 🔲 | Logging + retry mechanism |
| V1-003 | Panel Admin: todas las entidades gestionables | 🔲 | Checklist de features |
| V1-004 | SMS: 95% delivery rate | 🔲 | Twilio dashboard |
| V1-005 | Lista de espera: notificación en < 5 minutos | 🔲 | Test de liberación de slot |
| V1-006 | Política de cancelación aplicada correctamente | 🔲 | Test de casos borde |

**v1 Exit Criteria**: ✅ Todos los criterios anteriores deben estar aprobados.

---

### 8.3 v2 (Semana 14)

| ID | Criterio | Estado | Validación |
|----|----------|--------|-----------|
| V2-001 | Reseñas: 80% clientes califican post-cita | 🔲 | Analytics |
| V2-002 | Analytics: reportes en < 5 segundos | 🔲 | Query performance testing |
| V2-003 | Multi-empleado: asignación automática funcional | 🔲 | Test de escenarios complejos |
| V2-004 | Promociones: cupones aplicados correctamente | 🔲 | Test de validación |
| V2-005 | Uptime: > 99% | 🔲 | Uptime monitoring |
| V2-006 | Error rate: < 0.1% requests | 🔲 | Sentry dashboard |

**v2 Exit Criteria**: ✅ Todos los criterios anteriores deben estar aprobados.

---

## 9. Glosario

| Término | Definición |
|---------|-----------|
| **Cita** | Reserva de un servicio en un slot de tiempo específico |
| **Slot** | Intervalo de tiempo disponible (ej: 15, 30, 60 minutos) |
| **Double Booking** | Error donde dos citas ocupan el mismo slot |
| **PaymentIntent** | Objeto de Stripe que representa un intento de pago |
| **Webhook** | Callback HTTP asíncrono de servicios externos |
| **JWT** | JSON Web Token, estándar para autenticación stateless |
| **Refresh Token** | Token de larga duración para obtener nuevos access tokens |
| **Idempotencia** | Propiedad donde una operación puede ejecutarse múltiples veces sin cambiar el resultado |
| **Rate Limiting** | Mecanismo para limitar requests por unidad de tiempo |
| **Soft Delete** | Patrón donde registros se marcan como inactivos en lugar de eliminarse |

---

## 10. Historial de Cambios

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | 2026-03-11 | AI Assistant | Especificaciones iniciales basadas en proposal v1.0 |

---

**Status**: ✅ Completed  
**Next Phase**: `/sdd-design`  
**Artifact Mode**: hybrid (Engram + OpenSpec)
