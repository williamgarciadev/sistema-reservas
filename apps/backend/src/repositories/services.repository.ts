import prisma from '../lib/prisma.js';
import { Servicio } from '@prisma/client';

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

export interface ListServiciosFilters {
  categoria?: string;
  activo?: boolean;
}

export class ServicesRepository {
  async create(data: CreateServicioDTO): Promise<Servicio> {
    return prisma.servicio.create({
      data: {
        ...data,
        nombre: data.nombre.toLowerCase(), // Store lowercase for case-insensitive uniqueness
      }
    });
  }

  async findById(id: string): Promise<Servicio | null> {
    return prisma.servicio.findUnique({
      where: { id }
    });
  }

  async findByName(nombre: string): Promise<Servicio | null> {
    return prisma.servicio.findUnique({
      where: { nombre: nombre.toLowerCase() }
    });
  }

  async update(id: string, data: UpdateServicioDTO): Promise<Servicio> {
    return prisma.servicio.update({
      where: { id },
      data
    });
  }

  async softDelete(id: string): Promise<Servicio> {
    return prisma.servicio.update({
      where: { id },
      data: { activo: false }
    });
  }

  async existsByNombre(nombre: string, excludeId?: string): Promise<boolean> {
    const servicio = await prisma.servicio.findFirst({
      where: {
        nombre: nombre.toLowerCase(),
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    return !!servicio;
  }

  async list(page: number = 1, limit: number = 20, filters?: ListServiciosFilters) {
    const where: any = {};
    
    if (filters?.categoria) {
      where.categoria = filters.categoria;
    }
    
    // Default to active services only unless specified
    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    } else {
      where.activo = true;
    }

    const [servicios, total] = await Promise.all([
      prisma.servicio.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          duracion: true,
          precio: true,
          categoria: true,
          imagenUrl: true,
          activo: true,
          createdAt: true
        },
        orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }]
      }),
      prisma.servicio.count({ where })
    ]);

    return {
      servicios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async listAllWithStats() {
    const servicios = await prisma.servicio.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        duracion: true,
        precio: true,
        categoria: true,
        imagenUrl: true,
        _count: {
          select: { citas: true }
        },
        empleados: {
          select: {
            empleado: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }]
    });

    return servicios;
  }
}

export const servicesRepository = new ServicesRepository();
