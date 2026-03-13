import { appointmentsRepository, CreateCitaDTO, UpdateCitaDTO } from '../repositories/appointments.repository.js';
import { servicesService } from '../services/services.service.js';
import { employeesService } from '../services/employees.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { EstadoCita } from '@prisma/client';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';
import { prisma } from '../lib/prisma.js';

export interface CreateCitaRequest {
  servicioId: string;
  empleadoId: string;
  fechaInicio: string; // ISO string
  notas?: string;
}

export interface UpdateCitaRequest {
  fechaInicio?: string;
  notas?: string;
}

export interface CancelCitaResult {
  cita: any;
  reembolso?: {
    aplica: boolean;
    monto: number;
    porcentaje: number;
  };
}

export class AppointmentsService {
  private readonly ANTERIOR_MINIMA_HORAS = 2;
  private readonly CANCELACION_24H_PENALIDAD = 50; // 50% penalty
  private readonly CANCELACION_2H_PENALIDAD = 100; // 100% penalty
  private notificationsService: NotificationsService;

  constructor() {
    const notificationsRepo = new NotificationsRepository(prisma);
    const usuarioRepo = new UsuarioRepository(prisma);
    this.notificationsService = new NotificationsService(notificationsRepo, usuarioRepo, this);
  }

  async createCita(
    data: CreateCitaRequest,
    clienteId: string
  ) {
    const fechaInicio = new Date(data.fechaInicio);

    // Validate fecha is not in the past
    const now = new Date();
    if (fechaInicio <= now) {
      throw new AppError(
        'FECHA_INVALIDA',
        'La fecha no puede ser en el pasado',
        400
      );
    }

    // Validate minimum anticipation (2 hours)
    const hoursUntilAppointment = (fechaInicio.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilAppointment < this.ANTERIOR_MINIMA_HORAS) {
      throw new AppError(
        'ANTICIPACION_INSUFICIENTE',
        `Debe reservar con al menos ${this.ANTERIOR_MINIMA_HORAS} horas de anticipación`,
        400
      );
    }

    // Validate service exists and is active
    const servicio = await servicesService.getById(data.servicioId);
    if (!servicio.activo) {
      throw new AppError(
        'SERVICIO_NO_DISPONIBLE',
        'El servicio no está disponible',
        400
      );
    }

    // Validate employee exists and is active
    const empleado = await employeesService.getById(data.empleadoId);
    if (!empleado.activo) {
      throw new AppError(
        'EMPLEADO_NO_DISPONIBLE',
        'El empleado no está disponible',
        400
      );
    }

    // Validate employee provides this service
    const empleadoConServicios = await employeesService.getByIdWithServicios(data.empleadoId);
    const tieneServicio = empleadoConServicios.servicios?.some(
      s => s.id === data.servicioId
    );
    if (!tieneServicio) {
      throw new AppError(
        'EMPLEADO_NO_REALIZA_SERVICIO',
        'Este empleado no realiza el servicio seleccionado',
        400
      );
    }

    // Calculate end time based on service duration
    const fechaFin = new Date(fechaInicio.getTime() + servicio.duracion * 60 * 1000);

    // Check for conflicts (double booking)
    const hasConflict = await appointmentsRepository.hasConflict(
      data.empleadoId,
      fechaInicio,
      fechaFin
    );

    if (hasConflict) {
      throw new AppError(
        'HORARIO_NO_DISPONIBLE',
        'El horario seleccionado ya no está disponible',
        409
      );
    }

    // Validate employee is available at this time (within working hours)
    const dayOfWeek = fechaInicio.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    const horarioLaboral = empleado.horarioLaboral as any;
    const daySchedule = horarioLaboral[dayOfWeek];

    if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
      throw new AppError(
        'EMPLEADO_NO_TRABAJA_ESTEDÍA',
        'El empleado no trabaja este día',
        400
      );
    }

    const appointmentStartMinutes = fechaInicio.getHours() * 60 + fechaInicio.getMinutes();
    const appointmentEndMinutes = fechaFin.getHours() * 60 + fechaFin.getMinutes();
    const workStartMinutes = this.parseTimeToMinutes(daySchedule.inicio);
    const workEndMinutes = this.parseTimeToMinutes(daySchedule.fin);

    if (appointmentStartMinutes < workStartMinutes || appointmentEndMinutes > workEndMinutes) {
      throw new AppError(
        'FUERA_HORARIO_LABORAL',
        'La cita está fuera del horario laboral del empleado',
        400
      );
    }

    // Create the appointment
    const cita = await appointmentsRepository.create({
      clienteId,
      empleadoId: data.empleadoId,
      servicioId: data.servicioId,
      fechaInicio,
      fechaFin,
      notas: data.notas
    });

    // Send confirmation notification
    try {
      await this.notificationsService.sendAppointmentConfirmation(cita.id, clienteId);
    } catch (error) {
      console.error('Error sending appointment confirmation:', error);
      // Don't fail the appointment creation if notification fails
    }

    return {
      id: cita.id,
      servicio: {
        id: cita.servicio.id,
        nombre: cita.servicio.nombre,
        duracion: cita.servicio.duracion,
        precio: cita.servicio.precio.toNumber()
      },
      empleado: {
        id: cita.empleado.id,
        nombre: cita.empleado.nombre
      },
      cliente: {
        id: cita.cliente.id,
        nombre: cita.cliente.nombre
      },
      fechaInicio: cita.fechaInicio,
      fechaFin: cita.fechaFin,
      estado: cita.estado,
      notas: cita.notas,
      createdAt: cita.createdAt
    };
  }

  async getCitaById(id: string, userId: string, userRole: string) {
    const cita = await appointmentsRepository.findById(id);

    if (!cita) {
      throw new AppError(
        'CITA_NO_ENCONTRADA',
        'La cita no existe',
        404
      );
    }

    // Authorization: owner, employee, or admin
    if (
      userRole !== 'ADMIN' &&
      cita.clienteId !== userId &&
      cita.empleadoId !== userId
    ) {
      throw new AppError(
        'PERMISO_DENEGADO',
        'No tienes permiso para ver esta cita',
        403
      );
    }

    return {
      id: cita.id,
      servicio: {
        id: cita.servicio.id,
        nombre: cita.servicio.nombre,
        duracion: cita.servicio.duracion,
        precio: cita.servicio.precio.toNumber()
      },
      empleado: {
        id: cita.empleado.id,
        nombre: cita.empleado.nombre,
        email: cita.empleado.email
      },
      cliente: {
        id: cita.cliente.id,
        nombre: cita.cliente.nombre,
        email: cita.cliente.email
      },
      fechaInicio: cita.fechaInicio,
      fechaFin: cita.fechaFin,
      estado: cita.estado,
      notas: cita.notas,
      createdAt: cita.createdAt,
      updatedAt: cita.updatedAt,
      pago: cita.pago ? {
        id: cita.pago.id,
        estado: cita.pago.estado,
        monto: cita.pago.monto.toNumber()
      } : null
    };
  }

  async listCitas(
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 20,
    filters?: { estado?: EstadoCita; desde?: Date; hasta?: Date }
  ) {
    let result;

    if (userRole === 'ADMIN') {
      // Admin sees all appointments
      result = await appointmentsRepository.list(page, limit, {
        ...filters,
        empleadoId: filters?.empleadoId,
        servicioId: filters?.servicioId
      });
    } else if (userRole === 'EMPLEADO') {
      // Employee sees only their appointments
      result = await appointmentsRepository.listByEmpleado(
        userId,
        page,
        limit,
        filters
      );
    } else {
      // Client sees only their own appointments
      result = await appointmentsRepository.listByCliente(
        userId,
        page,
        limit,
        { estado: filters?.estado }
      );
    }

    // Format response
    const citas = result.citas.map((cita: any) => ({
      id: cita.id,
      servicio: {
        id: cita.servicio.id,
        nombre: cita.servicio.nombre,
        duracion: cita.servicio.duracion,
        precio: cita.servicio.precio.toNumber()
      },
      empleado: {
        id: cita.empleado.id,
        nombre: cita.empleado.nombre
      },
      cliente: {
        id: cita.cliente.id,
        nombre: cita.cliente.nombre
      },
      fechaInicio: cita.fechaInicio,
      fechaFin: cita.fechaFin,
      estado: cita.estado,
      notas: cita.notas
    }));

    return {
      citas,
      pagination: result.pagination
    };
  }

  async updateCita(
    id: string,
    data: UpdateCitaRequest,
    userId: string,
    userRole: string
  ) {
    // Get existing appointment
    const existing = await appointmentsRepository.findById(id);

    if (!existing) {
      throw new AppError(
        'CITA_NO_ENCONTRADA',
        'La cita no existe',
        404
      );
    }

    // Authorization: owner or admin
    if (
      userRole !== 'ADMIN' &&
      existing.clienteId !== userId
    ) {
      throw new AppError(
        'PERMISO_DENEGADO',
        'No tienes permiso para modificar esta cita',
        403
      );
    }

    // Cannot modify cancelled or completed appointments
    if (existing.estado === EstadoCita.CANCELADA || existing.estado === EstadoCita.COMPLETADA) {
      throw new AppError(
        'CITA_NO_MODIFICABLE',
        'No se puede modificar una cita cancelada o completada',
        400
      );
    }

    // If rescheduling (changing date)
    if (data.fechaInicio) {
      const nuevaFechaInicio = new Date(data.fechaInicio);
      const now = new Date();

      // Validate new date is not in the past
      if (nuevaFechaInicio <= now) {
        throw new AppError(
          'FECHA_INVALIDA',
          'La nueva fecha no puede ser en el pasado',
          400
        );
      }

      // Get service duration
      const servicio = await servicesService.getById(existing.servicioId);
      const nuevaFechaFin = new Date(nuevaFechaInicio.getTime() + servicio.duracion * 60 * 1000);

      // Check for conflicts with new time
      const hasConflict = await appointmentsRepository.hasConflict(
        existing.empleadoId,
        nuevaFechaInicio,
        nuevaFechaFin,
        id // Exclude current appointment
      );

      if (hasConflict) {
        throw new AppError(
          'HORARIO_NO_DISPONIBLE',
          'El nuevo horario seleccionado ya no está disponible',
          409
        );
      }

      // Update with new times
      const cita = await appointmentsRepository.update(id, {
        fechaInicio: nuevaFechaInicio,
        fechaFin: nuevaFechaFin,
        notas: data.notas
      });

      return {
        id: cita.id,
        fechaInicio: cita.fechaInicio,
        fechaFin: cita.fechaFin,
        estado: cita.estado,
        updatedAt: cita.updatedAt
      };
    }

    // Just update notes
    const cita = await appointmentsRepository.update(id, {
      notas: data.notas
    });

    return {
      id: cita.id,
      notas: cita.notas,
      updatedAt: cita.updatedAt
    };
  }

  async cancelarCita(
    id: string,
    userId: string,
    userRole: string
  ): Promise<CancelCitaResult> {
    // Get existing appointment
    const existing = await appointmentsRepository.findById(id);

    if (!existing) {
      throw new AppError(
        'CITA_NO_ENCONTRADA',
        'La cita no existe',
        404
      );
    }

    // Authorization: owner, employee, or admin
    if (
      userRole !== 'ADMIN' &&
      existing.clienteId !== userId &&
      existing.empleadoId !== userId
    ) {
      throw new AppError(
        'PERMISO_DENEGADO',
        'No tienes permiso para cancelar esta cita',
        403
      );
    }

    // Cannot cancel already cancelled or completed appointments
    if (existing.estado === EstadoCita.CANCELADA || existing.estado === EstadoCita.COMPLETADA) {
      throw new AppError(
        'CITA_YA_CANCELADA',
        'La cita ya está cancelada o completada',
        400
      );
    }

    // Calculate cancellation penalty
    const now = new Date();
    const hoursUntilAppointment = (existing.fechaInicio.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let reembolso = {
      aplica: false,
      monto: 0,
      porcentaje: 0
    };

    if (existing.estado === EstadoCita.PAGADA) {
      const servicio = await servicesService.getById(existing.servicioId);
      const montoOriginal = servicio.precio.toNumber();

      if (hoursUntilAppointment < 2) {
        // Less than 2 hours → 100% penalty (no refund)
        reembolso = {
          aplica: false,
          monto: 0,
          porcentaje: 0
        };
      } else if (hoursUntilAppointment < 24) {
        // Less than 24 hours → 50% penalty
        reembolso = {
          aplica: true,
          monto: montoOriginal * 0.5,
          porcentaje: 50
        };
      } else {
        // More than 24 hours → full refund
        reembolso = {
          aplica: true,
          monto: montoOriginal,
          porcentaje: 100
        };
      }
    }

    // Cancel the appointment
    const cita = await appointmentsRepository.cancel(id);

    // Send cancellation notification
    try {
      await this.notificationsService.sendAppointmentCancellation(id, existing.clienteId);
    } catch (error) {
      console.error('Error sending cancellation notification:', error);
      // Don't fail the cancellation if notification fails
    }

    return {
      cita: {
        id: cita.id,
        estado: cita.estado,
        updatedAt: cita.updatedAt
      },
      reembolso
    };
  }

  async completarCita(
    id: string,
    userId: string,
    userRole: string
  ) {
    // Get existing appointment
    const existing = await appointmentsRepository.findById(id);

    if (!existing) {
      throw new AppError(
        'CITA_NO_ENCONTRADA',
        'La cita no existe',
        404
      );
    }

    // Authorization: admin or employee (the one assigned to the appointment)
    if (
      userRole !== 'ADMIN' &&
      existing.empleadoId !== userId
    ) {
      throw new AppError(
        'PERMISO_DENEGADO',
        'Solo el empleado asignado o un admin pueden completar esta cita',
        403
      );
    }

    // Can only complete CONFIRMADA or PAGADA appointments
    if (
      existing.estado !== EstadoCita.CONFIRMADA &&
      existing.estado !== EstadoCita.PAGADA
    ) {
      throw new AppError(
        'CITA_NO_COMPLETABLE',
        'Solo se pueden completar citas confirmadas o pagadas',
        400
      );
    }

    // Mark as completed
    const cita = await appointmentsRepository.complete(id);

    return {
      id: cita.id,
      estado: cita.estado,
      updatedAt: cita.updatedAt
    };
  }

  async getAvailableSlots(
    empleadoId: string,
    fecha: string, // ISO date string
    servicioId: string
  ) {
    // Validate employee exists and is active
    const empleado = await employeesService.getById(empleadoId);
    if (!empleado.activo) {
      throw new AppError(
        'EMPLEADO_NO_DISPONIBLE',
        'El empleado no está disponible',
        400
      );
    }

    // Validate service exists and is active
    const servicio = await servicesService.getById(servicioId);
    if (!servicio.activo) {
      throw new AppError(
        'SERVICIO_NO_DISPONIBLE',
        'El servicio no está disponible',
        400
      );
    }

    const fechaDate = new Date(fecha);
    const slots = await appointmentsRepository.findAvailableSlots(
      empleadoId,
      fechaDate,
      servicioId
    );

    // Format slots for response
    return {
      empleadoId,
      fecha,
      servicioId,
      slots: slots.map(slot => ({
        fechaInicio: slot.fechaInicio.toISOString(),
        fechaFin: slot.fechaFin.toISOString(),
        disponible: slot.disponible
      }))
    };
  }

  private parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

export const appointmentsService = new AppointmentsService();
