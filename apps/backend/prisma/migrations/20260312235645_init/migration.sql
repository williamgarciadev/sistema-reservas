-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'EMPLEADO', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoDisponibilidad" AS ENUM ('LABORAL', 'VACACIONES', 'FERIADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('CONFIRMADA', 'PAGADA', 'COMPLETADA', 'CANCELADA', 'REEMBOLSADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'EXITOSO', 'FALLIDO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'FIJO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CITA_CONFIRMADA', 'CITA_RECORDATORIO', 'CITA_CANCELADA', 'CITA_REAGENDADA', 'PROMO', 'SISTEMA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracion" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "categoria" TEXT,
    "imagenUrl" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "horarioLaboral" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpleadoServicio" (
    "empleadoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpleadoServicio_pkey" PRIMARY KEY ("empleadoId","servicioId")
);

-- CreateTable
CREATE TABLE "Disponibilidad" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoDisponibilidad" NOT NULL,
    "inicio" TEXT,
    "fin" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'CONFIRMADA',
    "notas" TEXT,
    "paymentIntent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'usd',
    "estado" "EstadoPago" NOT NULL,
    "stripeWebhookData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resena" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "calificacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "anonimo" BOOLEAN NOT NULL DEFAULT false,
    "aprobado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "notificado" BOOLEAN NOT NULL DEFAULT false,
    "expiraAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cupon" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoDescuento" "TipoDescuento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "usosMaximos" INTEGER,
    "usosActuales" INTEGER NOT NULL DEFAULT 0,
    "usosPorUsuario" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuponUso" (
    "id" TEXT NOT NULL,
    "cuponId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "citaId" TEXT,
    "usadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CuponUso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "smsEnviado" BOOLEAN NOT NULL DEFAULT false,
    "citaId" TEXT,
    "metadata" JSONB,
    "enviadoAt" TIMESTAMP(3),
    "leidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_email_idx" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_activo_idx" ON "Usuario"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_nombre_key" ON "Servicio"("nombre");

-- CreateIndex
CREATE INDEX "Servicio_activo_idx" ON "Servicio"("activo");

-- CreateIndex
CREATE INDEX "Servicio_categoria_idx" ON "Servicio"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_usuarioId_key" ON "Empleado"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_email_key" ON "Empleado"("email");

-- CreateIndex
CREATE INDEX "Empleado_activo_idx" ON "Empleado"("activo");

-- CreateIndex
CREATE INDEX "Empleado_email_idx" ON "Empleado"("email");

-- CreateIndex
CREATE INDEX "EmpleadoServicio_empleadoId_idx" ON "EmpleadoServicio"("empleadoId");

-- CreateIndex
CREATE INDEX "EmpleadoServicio_servicioId_idx" ON "EmpleadoServicio"("servicioId");

-- CreateIndex
CREATE INDEX "Disponibilidad_empleadoId_fecha_idx" ON "Disponibilidad"("empleadoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_paymentIntent_key" ON "Cita"("paymentIntent");

-- CreateIndex
CREATE INDEX "Cita_clienteId_idx" ON "Cita"("clienteId");

-- CreateIndex
CREATE INDEX "Cita_empleadoId_idx" ON "Cita"("empleadoId");

-- CreateIndex
CREATE INDEX "Cita_fechaInicio_idx" ON "Cita"("fechaInicio");

-- CreateIndex
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cita_empleadoId_fechaInicio_key" ON "Cita"("empleadoId", "fechaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_citaId_key" ON "Pago"("citaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_stripePaymentIntentId_key" ON "Pago"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Pago_stripePaymentIntentId_idx" ON "Pago"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Resena_citaId_key" ON "Resena"("citaId");

-- CreateIndex
CREATE INDEX "Resena_empleadoId_idx" ON "Resena"("empleadoId");

-- CreateIndex
CREATE INDEX "Resena_calificacion_idx" ON "Resena"("calificacion");

-- CreateIndex
CREATE INDEX "Waitlist_citaId_idx" ON "Waitlist"("citaId");

-- CreateIndex
CREATE INDEX "Waitlist_clienteId_idx" ON "Waitlist"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_citaId_clienteId_key" ON "Waitlist"("citaId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Cupon_codigo_key" ON "Cupon"("codigo");

-- CreateIndex
CREATE INDEX "Cupon_codigo_idx" ON "Cupon"("codigo");

-- CreateIndex
CREATE INDEX "Cupon_activo_idx" ON "Cupon"("activo");

-- CreateIndex
CREATE INDEX "CuponUso_cuponId_idx" ON "CuponUso"("cuponId");

-- CreateIndex
CREATE INDEX "CuponUso_clienteId_idx" ON "CuponUso"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "CuponUso_cuponId_clienteId_key" ON "CuponUso"("cuponId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "Configuracion"("clave");

-- CreateIndex
CREATE INDEX "Configuracion_clave_idx" ON "Configuracion"("clave");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_idx" ON "Notificacion"("usuarioId");

-- CreateIndex
CREATE INDEX "Notificacion_leido_idx" ON "Notificacion"("leido");

-- CreateIndex
CREATE INDEX "Notificacion_createdAt_idx" ON "Notificacion"("createdAt");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leido_idx" ON "Notificacion"("usuarioId", "leido");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoServicio" ADD CONSTRAINT "EmpleadoServicio_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpleadoServicio" ADD CONSTRAINT "EmpleadoServicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disponibilidad" ADD CONSTRAINT "Disponibilidad_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resena" ADD CONSTRAINT "Resena_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_cuponId_fkey" FOREIGN KEY ("cuponId") REFERENCES "Cupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuponUso" ADD CONSTRAINT "CuponUso_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
