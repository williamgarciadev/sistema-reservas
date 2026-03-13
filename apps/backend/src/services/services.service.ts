import { servicesRepository } from '../repositories/services.repository.js';
import { AppError } from '../middleware/errorHandler.js';

export interface CreateServicioDTO {
  nombre: string;
  descripcion?: string;
  duracion: number; // minutos
  precio: number;
  categoria?: string;
  imagenUrl?: string;
}

export interface UpdateServicioDTO {
  nombre?: string;
  descripcion?: string;
  duracion?: number;
  precio?: number;
  categoria?: string;
  imagenUrl?: string;
  activo?: boolean;
}

export class ServicesService {
  async create(data: CreateServicioDTO) {
    // Validate duration (must be multiple of 15, between 15-480 minutes)
    if (data.duracion < 15 || data.duracion > 480) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'La duración debe estar entre 15 y 480 minutos',
        400
      );
    }

    if (data.duracion % 15 !== 0) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'La duración debe ser múltiplo de 15 minutos',
        400
      );
    }

    // Validate price (0-10000, 2 decimals)
    if (data.precio < 0 || data.precio > 10000) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'El precio debe estar entre 0 y 10000',
        400
      );
    }

    // Validate name length (3-100 characters)
    if (data.nombre.length < 3 || data.nombre.length > 100) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'El nombre debe tener entre 3 y 100 caracteres',
        400
      );
    }

    // Check name uniqueness
    const exists = await servicesRepository.existsByNombre(data.nombre);
    if (exists) {
      throw new AppError(
        'NOMBRE_DUPLICADO',
        'Ya existe un servicio con este nombre',
        409
      );
    }

    // Create service
    const servicio = await servicesRepository.create(data);

    return {
      id: servicio.id,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: servicio.duracion,
      precio: servicio.precio.toNumber(),
      categoria: servicio.categoria,
      imagenUrl: servicio.imagenUrl,
      activo: servicio.activo,
      createdAt: servicio.createdAt
    };
  }

  async update(id: string, data: UpdateServicioDTO) {
    // Verify service exists
    const existing = await servicesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'SERVICIO_NO_ENCONTRADO',
        'El servicio no existe',
        404
      );
    }

    // Validate duration if provided
    if (data.duracion !== undefined) {
      if (data.duracion < 15 || data.duracion > 480) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'La duración debe estar entre 15 y 480 minutos',
          400
        );
      }
      if (data.duracion % 15 !== 0) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'La duración debe ser múltiplo de 15 minutos',
          400
        );
      }
    }

    // Validate price if provided
    if (data.precio !== undefined && (data.precio < 0 || data.precio > 10000)) {
      throw new AppError(
        'VALIDACION_FALLIDO',
        'El precio debe estar entre 0 y 10000',
        400
      );
    }

    // Validate name if provided
    if (data.nombre !== undefined) {
      if (data.nombre.length < 3 || data.nombre.length > 100) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'El nombre debe tener entre 3 y 100 caracteres',
          400
        );
      }

      // Check name uniqueness (excluding current service)
      const exists = await servicesRepository.existsByNombre(data.nombre, id);
      if (exists) {
        throw new AppError(
          'NOMBRE_DUPLICADO',
          'Ya existe un servicio con este nombre',
          409
        );
      }
    }

    // Update service
    const servicio = await servicesRepository.update(id, data);

    return {
      id: servicio.id,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: servicio.duracion,
      precio: servicio.precio.toNumber(),
      categoria: servicio.categoria,
      imagenUrl: servicio.imagenUrl,
      activo: servicio.activo,
      updatedAt: servicio.updatedAt
    };
  }

  async activate(id: string) {
    const existing = await servicesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'SERVICIO_NO_ENCONTRADO',
        'El servicio no existe',
        404
      );
    }

    const servicio = await servicesRepository.update(id, { activo: true });
    return servicio;
  }

  async deactivate(id: string) {
    const existing = await servicesRepository.findById(id);
    if (!existing) {
      throw new AppError(
        'SERVICIO_NO_ENCONTRADO',
        'El servicio no existe',
        404
      );
    }

    // TODO: Check if service has active appointments
    // For now, just soft delete
    const servicio = await servicesRepository.softDelete(id);
    return servicio;
  }

  async getById(id: string) {
    const servicio = await servicesRepository.findById(id);
    
    if (!servicio) {
      throw new AppError(
        'SERVICIO_NO_ENCONTRADO',
        'El servicio no existe',
        404
      );
    }

    return {
      id: servicio.id,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: servicio.duracion,
      precio: servicio.precio.toNumber(),
      categoria: servicio.categoria,
      imagenUrl: servicio.imagenUrl,
      activo: servicio.activo,
      createdAt: servicio.createdAt,
      updatedAt: servicio.updatedAt
    };
  }

  async list(page: number = 1, limit: number = 20, filters?: { categoria?: string; activo?: boolean }) {
    const result = await servicesRepository.list(page, limit, filters);
    
    // Convert Decimal to number for JSON serialization
    const servicios = result.servicios.map(s => ({
      ...s,
      precio: s.precio.toNumber()
    }));

    return {
      servicios,
      pagination: result.pagination
    };
  }

  async listAllWithStats() {
    const servicios = await servicesRepository.listAllWithStats();
    
    return servicios.map(s => ({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      duracion: s.duracion,
      precio: s.precio.toNumber(),
      categoria: s.categoria,
      imagenUrl: s.imagenUrl,
      citasCount: s._count.citas,
      empleadosCount: s.empleados.length,
      empleados: s.empleados.map(e => ({
        id: e.empleado.id,
        nombre: e.empleado.nombre
      }))
    }));
  }
}

export const servicesService = new ServicesService();
