import prisma from '../lib/prisma.js';
import { Cita, EstadoCita } from '@prisma/client';

export interface CreateCitaDTO {
  clienteId: string;
  empleadoId: string;
  servicioId: string;
  fechaInicio: Date;
  fechaFin: Date;
  notas?: string;
}

export interface UpdateCitaDTO {
  fechaInicio?: Date;
  fechaFin?: Date;
  estado?: EstadoCita;
  notas?: string;
}

export interface ListCitasFilters {
  estado?: EstadoCita;
  desde?: Date;
  hasta?: Date;
  empleadoId?: string;
  servicioId?: string;
}

export interface AvailableSlot {
  fechaInicio: Date;
  fechaFin: Date;
  disponible: true;
}

export class AppointmentsRepository {
  async create(data: CreateCitaDTO): Promise<Cita> {
    return prisma.cita.create({
      data,
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        empleado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true,
            precio: true
          }
        }
      }
    });
  }

  async findById(id: string): Promise<Cita | null> {
    return prisma.cita.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        empleado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true,
            precio: true
          }
        },
        pago: {
          select: {
            id: true,
            estado: true,
            monto: true
          }
        }
      }
    });
  }

  async update(id: string, data: UpdateCitaDTO): Promise<Cita> {
    return prisma.cita.update({
      where: { id },
      data,
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        empleado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true,
            precio: true
          }
        }
      }
    });
  }

  async cancel(id: string): Promise<Cita> {
    return prisma.cita.update({
      where: { id },
      data: { estado: EstadoCita.CANCELADA },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        empleado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true,
            precio: true
          }
        }
      }
    });
  }

  async complete(id: string): Promise<Cita> {
    return prisma.cita.update({
      where: { id },
      data: { estado: EstadoCita.COMPLETADA },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        empleado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true,
            precio: true
          }
        }
      }
    });
  }

  async list(
    page: number = 1,
    limit: number = 20,
    filters?: ListCitasFilters
  ) {
    const where: any = {};

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.desde && filters?.hasta) {
      where.fechaInicio = {
        gte: filters.desde,
        lte: filters.hasta
      };
    } else if (filters?.desde) {
      where.fechaInicio = { gte: filters.desde };
    } else if (filters?.hasta) {
      where.fechaInicio = { lte: filters.hasta };
    }

    if (filters?.empleadoId) {
      where.empleadoId = filters.empleadoId;
    }

    if (filters?.servicioId) {
      where.servicioId = filters.servicioId;
    }

    const [citas, total] = await Promise.all([
      prisma.cita.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          empleado: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          servicio: {
            select: {
              id: true,
              nombre: true,
              duracion: true,
              precio: true
            }
          }
        },
        orderBy: { fechaInicio: 'desc' }
      }),
      prisma.cita.count({ where })
    ]);

    return {
      citas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async listByCliente(
    clienteId: string,
    page: number = 1,
    limit: number = 20,
    filters?: { estado?: EstadoCita }
  ) {
    const where: any = { clienteId };

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    const [citas, total] = await Promise.all([
      prisma.cita.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          empleado: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          servicio: {
            select: {
              id: true,
              nombre: true,
              duracion: true,
              precio: true
            }
          }
        },
        orderBy: { fechaInicio: 'desc' }
      }),
      prisma.cita.count({ where })
    ]);

    return {
      citas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async listByEmpleado(
    empleadoId: string,
    page: number = 1,
    limit: number = 20,
    filters?: { estado?: EstadoCita; desde?: Date; hasta?: Date }
  ) {
    const where: any = { empleadoId };

    if (filters?.estado) {
      where.estado = filters.estado;
    }

    if (filters?.desde && filters?.hasta) {
      where.fechaInicio = {
        gte: filters.desde,
        lte: filters.hasta
      };
    }

    const [citas, total] = await Promise.all([
      prisma.cita.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cliente: {
            select: {
              id: true,
              nombre: true,
              email: true
            }
          },
          servicio: {
            select: {
              id: true,
              nombre: true,
              duracion: true,
              precio: true
            }
          }
        },
        orderBy: { fechaInicio: 'asc' }
      }),
      prisma.cita.count({ where })
    ]);

    return {
      citas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByDateRange(
    empleadoId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<Cita[]> {
    return prisma.cita.findMany({
      where: {
        empleadoId,
        fechaInicio: {
          gte: fechaInicio,
          lte: fechaFin
        },
        estado: {
          in: [EstadoCita.CONFIRMADA, EstadoCita.PAGADA]
        }
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true
          }
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
            duracion: true
          }
        }
      },
      orderBy: { fechaInicio: 'asc' }
    });
  }

  async findAvailableSlots(
    empleadoId: string,
    fecha: Date,
    servicioId: string
  ): Promise<AvailableSlot[]> {
    // Get service duration
    const servicio = await prisma.servicio.findUnique({
      where: { id: servicioId },
      select: { duracion: true }
    });

    if (!servicio) {
      return [];
    }

    const serviceDuration = servicio.duracion; // in minutes

    // Get employee's working hours for that day
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
      select: { horarioLaboral: true }
    });

    if (!empleado) {
      return [];
    }

    const dayOfWeek = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
    const horarioLaboral = empleado.horarioLaboral as any;
    
    // Get working hours for the specific day
    const daySchedule = horarioLaboral[dayOfWeek];
    if (!daySchedule || !daySchedule.inicio || !daySchedule.fin) {
      return []; // Employee doesn't work this day
    }

    const workStart = this.parseTime(daySchedule.inicio);
    const workEnd = this.parseTime(daySchedule.fin);

    // Get existing appointments for this day
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCitas = await prisma.cita.findMany({
      where: {
        empleadoId,
        fechaInicio: {
          gte: startOfDay,
          lte: endOfDay
        },
        estado: {
          in: [EstadoCita.CONFIRMADA, EstadoCita.PAGADA]
        }
      },
      select: {
        fechaInicio: true,
        fechaFin: true
      }
    });

    // Generate available slots
    const slots: AvailableSlot[] = [];
    const slotDurationMs = serviceDuration * 60 * 1000;
    const intervalMs = 15 * 60 * 1000; // 15-minute intervals

    let currentTime = workStart;

    while (currentTime.getTime() + slotDurationMs <= workEnd.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + slotDurationMs);

      // Check if this slot conflicts with any existing appointment
      const hasConflict = existingCitas.some(cita => {
        const citaStart = cita.fechaInicio.getTime();
        const citaEnd = cita.fechaFin.getTime();
        const slotStart = currentTime.getTime();

        // Conflict if: slot starts before cita ends AND slot ends after cita starts
        return slotStart < citaEnd && slotEnd > citaStart;
      });

      if (!hasConflict) {
        slots.push({
          fechaInicio: new Date(currentTime),
          fechaFin: slotEnd,
          disponible: true
        });
      }

      // Move to next 15-minute interval
      currentTime = new Date(currentTime.getTime() + intervalMs);
    }

    return slots;
  }

  async hasConflict(
    empleadoId: string,
    fechaInicio: Date,
    fechaFin: Date,
    excludeId?: string
  ): Promise<boolean> {
    const where: any = {
      empleadoId,
      estado: {
        in: [EstadoCita.CONFIRMADA, EstadoCita.PAGADA]
      }
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    // Check for overlapping appointments
    // Two appointments overlap if: start1 < end2 AND end1 > start2
    const conflictingCitas = await prisma.cita.findFirst({
      where: {
        ...where,
        OR: [
          {
            fechaInicio: {
              lte: fechaInicio
            },
            fechaFin: {
              gt: fechaInicio
            }
          },
          {
            fechaInicio: {
              lt: fechaFin
            },
            fechaFin: {
              gte: fechaFin
            }
          },
          {
            fechaInicio: {
              gte: fechaInicio
            },
            fechaFin: {
              lte: fechaFin
            }
          }
        ]
      }
    });

    return !!conflictingCitas;
  }

  async countByEstado(estado: EstadoCita): Promise<number> {
    return prisma.cita.count({
      where: { estado }
    });
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}

export const appointmentsRepository = new AppointmentsRepository();
