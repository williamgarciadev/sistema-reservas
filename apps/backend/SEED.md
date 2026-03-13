# 🌱 Database Seed Scripts

Documentación para inicializar la base de datos con datos de prueba para el Sistema de Reservas.

## 📋 Tabla de Contenidos

- [Requisitos](#requisitos)
- [Configuración](#configuración)
- [Ejecutar Seed](#ejecutar-seed)
- [Datos Creados](#datos-creados)
- [Credenciales de Prueba](#credenciales-de-prueba)
- [Personalización](#personalización)
- [Troubleshooting](#troubleshooting)

---

## Requisitos

Antes de ejecutar el seed, asegúrate de tener:

1. **Base de datos configurada** - PostgreSQL conectado y migraciones aplicadas
2. **Node.js** - Versión 18+ recomendada
3. **Prisma CLI** - Instalado como dev dependency

```bash
# Verificar que Prisma está instalado
npx prisma --version

# Generar Prisma Client (si no está generado)
npm run db:generate
```

---

## Configuración

### Variables de Entorno

Asegúrate de tener configuradas las siguientes variables en tu `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sistema_reservas?schema=public"
```

### Estructura del Seed

El seed principal se encuentra en:

```
apps/backend/prisma/seed.ts
```

Este archivo es ejecutado por el script `db:seed` definido en `apps/backend/package.json`.

---

## Ejecutar Seed

### Opción 1: Seed Completo (Recomendado)

```bash
# Desde el root del proyecto
npm run db:seed
```

### Opción 2: Seed desde Backend

```bash
# Desde apps/backend
cd apps/backend
npm run db:seed
```

### Opción 3: Usando Prisma Directamente

```bash
# Desde apps/backend
npx prisma db seed
```

### Opción 4: Seed con Limpieza Previa

Si necesitas limpiar la base de datos antes del seed, edita `prisma/seed.ts` y descomenta la sección de CLEANUP:

```typescript
// En prisma/seed.ts, descomentar:
// console.log('🧹 Cleaning up existing data...');
// await prisma.cita.deleteMany();
// await prisma.empleadoServicio.deleteMany();
// await prisma.disponibilidad.deleteMany();
// await prisma.empleado.deleteMany();
// await prisma.servicio.deleteMany();
// await prisma.usuario.deleteMany();
```

Luego ejecuta:

```bash
npm run db:seed
```

---

## Datos Creados

El seed crea los siguientes datos de prueba:

### 👥 Usuarios (4 total)

| Rol | Email | Password | Descripción |
|-----|-------|----------|-------------|
| ADMIN | admin@sistema.com | Admin123! | Administrador del sistema |
| EMPLEADO | juan.perez@sistema.com | Employee123! | Empleado - Especialista en Corte y Barba |
| EMPLEADO | maria.gomez@sistema.com | Employee123! | Empleado - Especialista en Tinte y Peinado |
| CLIENTE | cliente1@test.com | Client123! | Cliente de prueba |
| CLIENTE | cliente2@test.com | Client123! | Cliente de prueba |

### 💈 Servicios (7 total)

| Servicio | Duración | Precio | Categoría |
|----------|----------|--------|-----------|
| Corte de Cabello | 30 min | $15.00 | Peluquería |
| Barba | 20 min | $10.00 | Peluquería |
| Corte + Barba | 50 min | $22.00 | Peluquería |
| Tinte | 60 min | $35.00 | Color |
| Peinado | 45 min | $25.00 | Estilismo |
| Manicure | 40 min | $18.00 | Uñas |
| Pedicure | 50 min | $22.00 | Uñas |

### 👨‍🔧 Empleados (2 total)

#### Juan Pérez
- **Email**: juan.perez@sistema.com
- **Especialidades**: Corte de Cabello, Barba, Corte + Barba
- **Horario**: Lunes a Viernes 9:00-18:00, Sábado 9:00-14:00

#### María Gómez
- **Email**: maria.gomez@sistema.com
- **Especialidades**: Tinte, Peinado, Manicure, Pedicure
- **Horario**: Lunes a Viernes 9:00-18:00, Sábado 9:00-14:00

### 📆 Citas de Prueba (3 total)

1. **Carlos Rodríguez** con **Juan Pérez** - Corte de Cabello
   - Fecha: Mañana a las 10:00
   - Estado: CONFIRMADA

2. **Ana Martínez** con **María Gómez** - Tinte
   - Fecha: Mañana a las 11:00
   - Estado: CONFIRMADA

3. **Carlos Rodríguez** con **Juan Pérez** - Barba
   - Fecha: Próxima semana a las 15:00
   - Estado: CONFIRMADA

### ⚙️ Configuración (2 total)

1. **política_cancelacion**
   - Horas mínimas: 24
   - Penalidad: 50%

2. **configuracion_general**
   - Nombre: Belleza Total
   - Anticipación mínima: 2 horas
   - Duración de slots: 15 minutos

### 📅 Disponibilidad

- Disponibilidad creada para los próximos 7 días para ambos empleados
- Horario laboral: Lunes a Viernes 9:00-18:00, Sábado 9:00-14:00

---

## Credenciales de Prueba

### Admin Dashboard

```
Email: admin@sistema.com
Password: Admin123!
```

Acceso a:
- Dashboard de métricas
- Gestión de usuarios
- Gestión de servicios
- Gestión de empleados
- Configuración del negocio

### Employee Portal

```
Email: juan.perez@sistema.com
Password: Employee123!

Email: maria.gomez@sistema.com
Password: Employee123!
```

Acceso a:
- Calendario de citas
- Gestión de disponibilidad
- Vista de citas asignadas

### Client Portal

```
Email: cliente1@test.com
Password: Client123!

Email: cliente2@test.com
Password: Client123!
```

Acceso a:
- Reservar citas
- Ver mis citas
- Perfil de usuario

---

## Personalización

### Agregar Más Datos

Para agregar más datos de prueba, edita `prisma/seed.ts` y agrega nuevas entradas en las secciones correspondientes:

```typescript
// Ejemplo: Agregar más servicios
const moreServices = [
  {
    nombre: 'Nuevo Servicio',
    descripcion: 'Descripción del servicio',
    duracion: 30,
    precio: 20.00,
    categoria: 'Categoría',
  },
];

for (const service of moreServices) {
  await prisma.servicio.upsert({
    where: { nombre: service.nombre },
    update: {},
    create: service,
  });
}
```

### Cambiar Contraseñas

Modifica las contraseñas por defecto en las constantes:

```typescript
const adminPassword = await hashPassword('TuNuevaPassword123!');
const employeePassword = await hashPassword('TuNuevaPassword123!');
const clientPassword = await hashPassword('TuNuevaPassword123!');
```

### Cambiar Horarios

Modifica el horario laboral por defecto:

```typescript
const defaultSchedule = {
  lunes: { inicio: '09:00', fin: '18:00' },
  martes: { inicio: '09:00', fin: '18:00' },
  // ... etc
};
```

---

## Troubleshooting

### Error: "Can't reach database server"

**Solución**: Verifica que PostgreSQL esté corriendo y la URL de conexión sea correcta.

```bash
# Verificar conexión
psql -h localhost -U tu_usuario -d sistema_reservas
```

### Error: "Prisma Client is not generated"

**Solución**: Genera el Prisma Client antes de ejecutar el seed.

```bash
npm run db:generate
```

### Error: "Unique constraint failed"

**Solución**: Los datos ya existen. El seed usa `upsert` para evitar duplicados, pero si necesitas un seed limpio:

1. Descomenta la sección de CLEANUP en `prisma/seed.ts`
2. O ejecuta: `npx prisma migrate reset` (⚠️ esto borra toda la data)

### Error: "Module not found: @prisma/client"

**Solución**: Instala las dependencias del backend.

```bash
cd apps/backend
npm install
```

### El seed corre pero no veo datos

**Solución**: Verifica que las migraciones se aplicaron correctamente.

```bash
# Aplicar migraciones
npm run db:migrate:deploy

# O en desarrollo
npm run db:migrate
```

---

## Scripts Disponibles

Desde `apps/backend/package.json`:

```json
{
  "scripts": {
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:generate": "prisma generate"
  }
}
```

### Prisma Studio

Para visualizar los datos creados:

```bash
npm run db:studio
```

Esto abrirá una interfaz web en `http://localhost:5555` donde puedes ver y editar los datos de la base de datos.

---

## Flujo Recomendado para Desarrollo

1. **Primera vez**:
   ```bash
   # Configurar DB
   npm run db:migrate
   
   # Ejecutar seed
   npm run db:seed
   
   # Ver datos
   npm run db:studio
   ```

2. **Reset completo**:
   ```bash
   # Resetear DB y seed
   npx prisma migrate reset
   npm run db:seed
   ```

3. **Daily development**:
   ```bash
   # Solo seed si necesitas datos frescos
   npm run db:seed
   ```

---

## Notas Importantes

- ⚠️ **El seed es idempotente**: Usa `upsert` para evitar duplicados
- ⚠️ **No usar en producción**: Este seed es solo para desarrollo y testing
- ⚠️ **Las contraseñas son hasheadas**: Usa bcrypt con 10 rounds
- ✅ **Las fechas son dinámicas**: Las citas se crean relativas a "hoy"
- ✅ **Los empleados tienen horarios**: Incluye disponibilidad para los próximos 7 días

---

## Soporte

Si encuentras problemas con el seed:

1. Revisa los logs de error en la consola
2. Verifica que la DB esté accesible
3. Asegúrate de que las migraciones estén aplicadas
4. Consulta la documentación de Prisma: https://www.prisma.io/docs/guides/database/seed-database
