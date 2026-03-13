import { employeesRepository } from '../repositories/employees.repository.js';
import { usuarioRepository } from '../repositories/usuario.repository.js';
import { servicesRepository } from '../repositories/services.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import { Rol } from '@prisma/client';

export interface HorarioLaboral {
  lunes?: { inicio: string; fin: string };
  martes?: { inicio: string; fin: string };
  miercoles?: { inicio: string; fin: string };
  jueves?: { inicio: string; fin: string };
  viernes?: { inicio: string; fin: string };
  sabado?: { inicio: string; fin: string };
  domingo?: { inicio: string; fin: string };
}

export interface CreateEmpleadoDTO {
  usuarioId?: string; // Optional - will create user if not provided
  nombre: string;
  email: string;
  telefono?: string;
  rol?: Rol; // EMPLEADO or ADMIN
  password?: string; // Required if creating user
  servicios?: string[]; // Array of servicio IDs
  horarioLaboral?: HorarioLaboral;
}

export interface UpdateEmpleadoDTO {
  nombre?: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
  servicios?: string[];
  horarioLaboral?: HorarioLaboral;
}

export class EmployeesService {
  async create(data: CreateEmpleadoDTO) {
    // Validate name length (3-100 characters)
    if (data.nombre.length < 3 || data.nombre.length > 100) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'El nombre debe tener entre 3 y 100 caracteres',
        400
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'Email inválido',
        400
      );
    }

    // Check email uniqueness
    const exists = await employeesRepository.existsByEmail(data.email);
    if (exists) {
      throw new AppError(
        'EMAIL_DUPLICADO',
        'Email ya registrado',
        409
      );
    }

    // Validate servicios if provided
    if (data.servicios && data.servicios.length > 0) {
      for (const servicioId of data.servicios) {
        const servicio = await servicesRepository.findById(servicioId);
        if (!servicio || !servicio.activo) {
          throw new AppError(
            'SERVICIO_INVALIDO',
            `El servicio ${servicioId} no existe o está inactivo`,
            400
          );
        }
      }
    }

    // Create user account if usuarioId not provided
    let usuarioId = data.usuarioId;
    if (!usuarioId) {
      if (!data.password) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'Password requerido para crear usuario',
          400
        );
      }

      // Create user with EMPLEADO or ADMIN rol
      const usuario = await usuarioRepository.create({
        nombre: data.nombre,
        email: data.email,
        passwordHash: '', // Will be set by AuthService if needed
        telefono: data.telefono,
        rol: data.rol || 'EMPLEADO'
      });

      usuarioId = usuario.id;
    }

    // Create employee
    const empleado = await employeesRepository.create({
      usuarioId,
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono,
      servicios: data.servicios,
      horarioLaboral: data.horarioLaboral
    });

    return this.formatEmpleado(empleado);
  }

  async update(id: string, data: UpdateEmpleadoDTO) {
    // Verify employee exists
    const existing = await employeesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    // Validate email if provided
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'Email inválido',
          400
        );
      }

      // Check email uniqueness (excluding current employee)
      const exists = await employeesRepository.existsByEmail(data.email, id);
      if (exists) {
        throw new AppError(
          'EMAIL_DUPLICADO',
          'Email ya registrado',
          409
        );
      }
    }

    // Validate name if provided
    if (data.nombre && (data.nombre.length < 3 || data.nombre.length > 100)) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'El nombre debe tener entre 3 y 100 caracteres',
        400
      );
    }

    // Validate servicios if provided
    if (data.servicios) {
      for (const servicioId of data.servicios) {
        const servicio = await servicesRepository.findById(servicioId);
        if (!servicio || !servicio.activo) {
          throw new AppError(
            'SERVICIO_INVALIDO',
            `El servicio ${servicioId} no existe o está inactivo`,
            400
          );
        }
      }
    }

    // Update employee
    const empleado = await employeesRepository.update(id, data);

    return this.formatEmpleado(empleado);
  }

  async activate(id: string) {
    const existing = await employeesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    const empleado = await employeesRepository.update(id, { activo: true });
    return this.formatEmpleado(empleado);
  }

  async deactivate(id: string) {
    const existing = await employeesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    // TODO: Check if employee has active appointments
    const empleado = await employeesRepository.softDelete(id);
    return this.formatEmpleado(empleado);
  }

  async getById(id: string) {
    const empleado = await employeesRepository.findById(id);

    if (!empleado) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    return this.formatEmpleado(empleado);
  }

  async list(page: number = 1, limit: number = 20, filters?: { activo?: boolean; servicioId?: string }) {
    const result = await employeesRepository.list(page, limit, filters);

    const empleados = result.empleados.map(e => ({
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      telefono: e.telefono,
      activo: e.activo,
      horarioLaboral: e.horarioLaboral as any,
      servicios: e.servicios.map(s => ({
        id: s.servicio.id,
        nombre: s.servicio.nombre,
        duracion: s.servicio.duracion
      })),
      citasCount: e._count.citas,
      createdAt: e.createdAt
    }));

    return {
      empleados,
      pagination: result.pagination
    };
  }

  async listByServicio(servicioId: string) {
    const empleados = await employeesRepository.listByServicio(servicioId);

    return empleados.map(e => ({
      id: e.id,
      nombre: e.nombre,
      email: e.email,
      servicios: e.servicios.map(s => ({
        id: s.servicio.id,
        nombre: s.servicio.nombre
      }))
    }));
  }

  async assignServicio(empleadoId: string, servicioId: string) {
    // Verify employee exists
    const empleado = await employeesRepository.findById(empleadoId);
    if (!empleado) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    // Verify service exists and is active
    const servicio = await servicesRepository.findById(servicioId);
    if (!servicio || !servicio.activo) {
      throw new AppError(
        'SERVICIO_INVALIDO',
        'El servicio no existe o está inactivo',
        400
      );
    }

    // Check if already assigned
    const alreadyAssigned = empleado.servicios.some(s => s.servicioId === servicioId);
    if (alreadyAssigned) {
      throw new AppError(
        'SERVICIO_YA_ASIGNADO',
        'El empleado ya tiene asignado este servicio',
        409
      );
    }

    await employeesRepository.addServicio(empleadoId, servicioId);

    // Return updated employee
    const updated = await employeesRepository.findById(empleadoId);
    return this.formatEmpleado(updated!);
  }

  async removeServicio(empleadoId: string, servicioId: string) {
    // Verify employee exists
    const empleado = await employeesRepository.findById(empleadoId);
    if (!empleado) {
      throw new AppError(
        'EMPLEADO_NO_ENCONTRADO',
        'El empleado no existe',
        404
      );
    }

    await employeesRepository.removeServicio(empleadoId, servicioId);

    // Return updated employee
    const updated = await employeesRepository.findById(empleadoId);
    return this.formatEmpleado(updated!);
  }

  // Private helpers

  private formatEmpleado(empleado: any) {
    return {
      id: empleado.id,
      nombre: empleado.nombre,
      email: empleado.email,
      telefono: empleado.telefono,
      activo: empleado.activo,
      horarioLaboral: empleado.horarioLaboral,
      servicios: empleado.servicios?.map((s: any) => ({
        id: s.servicio.id,
        nombre: s.servicio.nombre,
        duracion: s.servicio.duracion,
        precio: s.servicio.precio?.toNumber()
      })) || [],
      createdAt: empleado.createdAt,
      updatedAt: empleado.updatedAt
    };
  }
}

export const employeesService = new EmployeesService();
