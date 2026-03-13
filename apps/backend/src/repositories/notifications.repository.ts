import { PrismaClient, Notificacion, TipoNotificacion } from '@prisma/client';

interface CreateNotificationInput {
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  citaId?: string;
  metadata?: Record<string, any>;
}

interface NotificationWithRelations extends Notificacion {
  cita: {
    id: string;
    fechaInicio: Date;
    servicio: {
      nombre: string;
      duracion: number;
    };
    empleado: {
      nombre: string;
    };
  } | null;
}

export class NotificationsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationInput): Promise<Notificacion> {
    return this.prisma.notificacion.create({
      data: {
        usuarioId: data.usuarioId,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        citaId: data.citaId,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<Notificacion | null> {
    return this.prisma.notificacion.findUnique({
      where: { id },
    });
  }

  /**
   * Find notification by ID with relations
   */
  async findByIdWithRelations(id: string): Promise<NotificationWithRelations | null> {
    return this.prisma.notificacion.findUnique({
      where: { id },
      include: {
        cita: {
          include: {
            servicio: {
              select: {
                nombre: true,
                duracion: true,
              },
            },
            empleado: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get notifications for a specific user with pagination
   */
  async findByUsuario(
    usuarioId: string,
    options: {
      page?: number;
      limit?: number;
      leido?: boolean;
    } = {}
  ): Promise<{ notifications: Notificacion[]; total: number }> {
    const { page = 1, limit = 20, leido } = options;
    const skip = (page - 1) * limit;

    const where: any = { usuarioId };
    if (leido !== undefined) {
      where.leido = leido;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notificacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Get unread notifications for a user
   */
  async findUnread(usuarioId: string): Promise<Notificacion[]> {
    return this.prisma.notificacion.findMany({
      where: {
        usuarioId,
        leido: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get unread notification count for a user
   */
  async countUnread(usuarioId: string): Promise<number> {
    return this.prisma.notificacion.count({
      where: {
        usuarioId,
        leido: false,
      },
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, usuarioId: string): Promise<Notificacion | null> {
    return this.prisma.notificacion.updateMany({
      where: {
        id,
        usuarioId,
        leido: false,
      },
      data: {
        leido: true,
        leidoAt: new Date(),
      },
    }).then(result => {
      if (result.count === 0) return null;
      return this.prisma.notificacion.findUnique({ where: { id } });
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(usuarioId: string): Promise<number> {
    const result = await this.prisma.notificacion.updateMany({
      where: {
        usuarioId,
        leido: false,
      },
      data: {
        leido: true,
        leidoAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Mark email as sent
   */
  async markEmailAsSent(id: string): Promise<Notificacion> {
    return this.prisma.notificacion.update({
      where: { id },
      data: {
        emailEnviado: true,
        enviadoAt: new Date(),
      },
    });
  }

  /**
   * Mark SMS as sent
   */
  async markSmsAsSent(id: string): Promise<Notificacion> {
    return this.prisma.notificacion.update({
      where: { id },
      data: {
        smsEnviado: true,
        enviadoAt: new Date(),
      },
    });
  }

  /**
   * Find notifications for appointment reminders (24h before)
   * Returns appointments in the next hour that are 24h away
   */
  async findAppointmentReminders(): Promise<NotificationWithRelations[]> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Find appointments that are 24-25 hours away
    const citas = await this.prisma.cita.findMany({
      where: {
        fechaInicio: {
          gte: twentyFourHoursFromNow,
          lt: twentyFiveHoursFromNow,
        },
        estado: {
          in: ['CONFIRMADA', 'PAGADA'],
        },
      },
      include: {
        cliente: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        servicio: {
          select: {
            nombre: true,
            duracion: true,
          },
        },
        empleado: {
          select: {
            nombre: true,
          },
        },
      },
    });

    // Check which ones already have reminders sent
    const notifications = await Promise.all(
      citas.map(async (cita) => {
        const existingReminder = await this.prisma.notificacion.findFirst({
          where: {
            citaId: cita.id,
            tipo: 'CITA_RECORDATORIO',
          },
        });

        if (existingReminder) {
          return null;
        }

        // Create reminder notification
        const notification = await this.create({
          usuarioId: cita.clienteId,
          tipo: 'CITA_RECORDATORIO',
          titulo: 'Recordatorio de cita mañana',
          mensaje: `Tu cita de ${cita.servicio.nombre} es mañana a las ${this.formatTime(cita.fechaInicio)} con ${cita.empleado.nombre}.`,
          citaId: cita.id,
          metadata: {
            appointmentId: cita.id,
            appointmentDate: cita.fechaInicio.toISOString(),
          },
        });

        return {
          ...notification,
          cita: {
            id: cita.id,
            fechaInicio: cita.fechaInicio,
            servicio: {
              nombre: cita.servicio.nombre,
              duracion: cita.servicio.duracion,
            },
            empleado: {
              nombre: cita.empleado.nombre,
            },
          },
        } as NotificationWithRelations;
      })
    );

    return notifications.filter((n): n is NotificationWithRelations => n !== null);
  }

  /**
   * Delete notification
   */
  async delete(id: string): Promise<Notificacion> {
    return this.prisma.notificacion.delete({
      where: { id },
    });
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.notificacion.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        leido: true,
      },
    });

    return result.count;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
