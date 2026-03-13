import prisma from '../lib/prisma.js';
import { Empleado, EmpleadoServicio, Rol } from '@prisma/client';

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
  usuarioId: string;
  nombre: string;
  email: string;
  telefono?: string;
  servicios?: string[]; // Array of servicio IDs
  horarioLaboral?: HorarioLaboral;
}

export interface UpdateEmpleadoDTO {
  nombre?: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
  servicios?: string[]; // Replace all servicios
  horarioLaboral?: HorarioLaboral;
}

export interface ListEmpleadosFilters {
  activo?: boolean;
  servicioId?: string;
}

export class EmployeesRepository {
  async create(data: CreateEmpleadoDTO): Promise<Empleado> {
    return prisma.$transaction(async (tx) => {
      // Create employee
      const empleado = await tx.empleado.create({
        data: {
          usuarioId: data.usuarioId,
          nombre: data.nombre,
          email: data.email.toLowerCase(),
          telefono: data.telefono,
          horarioLaboral: data.horarioLaboral || {},
          servicios: data.servicios?.length
            ? {
                create: data.servicios.map(servicioId => ({
                  servicioId
                }))
              }
            : undefined
        }
      });

      return empleado;
    });
  }

  async findById(id: string): Promise<Empleado | null> {
    return prisma.empleado.findUnique({
      where: { id },
      include: {
        servicios: {
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
                duracion: true,
                precio: true
              }
            }
          }
        }
      }
    });
  }

  async findByEmail(email: string): Promise<Empleado | null> {
    return prisma.empleado.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async update(id: string, data: UpdateEmpleadoDTO): Promise<Empleado> {
    return prisma.$transaction(async (tx) => {
      // Update employee basic info
      const updateData: any = {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.email && { email: data.email.toLowerCase() }),
        ...(data.telefono !== undefined && { telefono: data.telefono }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.horarioLaboral && { horarioLaboral: data.horarioLaboral })
      };

      // Handle servicios replacement
      if (data.servicios) {
        // Delete existing servicios
        await tx.empleadoServicio.deleteMany({
          where: { empleadoId: id }
        });

        // Create new servicios
        if (data.servicios.length > 0) {
          await tx.empleadoServicio.createMany({
            data: data.servicios.map(servicioId => ({
              empleadoId: id,
              servicioId
            }))
          });
        }
      }

      return tx.empleado.update({
        where: { id },
        data: updateData,
        include: {
          servicios: {
            include: {
              servicio: {
                select: {
                  id: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    });
  }

  async softDelete(id: string): Promise<Empleado> {
    return prisma.empleado.update({
      where: { id },
      data: { activo: false }
    });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const empleado = await prisma.empleado.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    return !!empleado;
  }

  async list(page: number = 1, limit: number = 20, filters?: ListEmpleadosFilters) {
    const where: any = {};

    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    } else {
      where.activo = true; // Default to active only
    }

    // Filter by servicio if provided
    if (filters?.servicioId) {
      where.servicios = {
        some: {
          servicioId: filters.servicioId
        }
      };
    }

    const [empleados, total] = await Promise.all([
      prisma.empleado.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          activo: true,
          horarioLaboral: true,
          createdAt: true,
          servicios: {
            select: {
              servicio: {
                select: {
                  id: true,
                  nombre: true,
                  duracion: true
                }
              }
            }
          },
          _count: {
            select: { citas: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.empleado.count({ where })
    ]);

    return {
      empleados,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async listByServicio(servicioId: string): Promise<Empleado[]> {
    return prisma.empleado.findMany({
      where: {
        activo: true,
        servicios: {
          some: {
            servicioId
          }
        }
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        servicios: {
          select: {
            servicio: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        }
      }
    });
  }

  async addServicio(empleadoId: string, servicioId: string): Promise<EmpleadoServicio> {
    return prisma.empleadoServicio.create({
      data: {
        empleadoId,
        servicioId
      }
    });
  }

  async removeServicio(empleadoId: string, servicioId: string): Promise<void> {
    await prisma.empleadoServicio.delete({
      where: {
        empleadoId_servicioId: {
          empleadoId,
          servicioId
        }
      }
    });
  }
}

export const employeesRepository = new EmployeesRepository();
