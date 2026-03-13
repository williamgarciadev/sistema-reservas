import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotificationsRepository } from '../repositories/notifications.repository.js';
import { NotificationsService } from '../services/notifications.service.js';
import { UsuarioRepository } from '../repositories/usuario.repository.js';

// Validation schemas
const markAsReadSchema = z.object({
  leido: z.boolean().optional(),
});

const testEmailSchema = z.object({
  email: z.string().email('Email inválido'),
});

const createNotificationSchema = z.object({
  usuarioId: z.string(),
  tipo: z.enum(['CITA_CONFIRMADA', 'CITA_RECORDATORIO', 'CITA_CANCELADA', 'CITA_REAGENDADA', 'PROMO', 'SISTEMA']),
  titulo: z.string().min(1).max(200),
  mensaje: z.string().min(1).max(2000),
  citaId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export class NotificationsController {
  constructor(
    private notificationsRepo: NotificationsRepository,
    private notificationsService: NotificationsService,
    private usuarioRepo: UsuarioRepository
  ) {}

  /**
   * GET /api/notifications
   * List user's notifications (authenticated)
   */
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const leido = req.query.leido ? req.query.leido === 'true' : undefined;

      const result = await this.notificationsRepo.findByUsuario(usuarioId, {
        page,
        limit,
        leido,
      });

      res.json({
        data: {
          notificaciones: result.notifications,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/unread
   * List unread notifications
   */
  async listUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const notificaciones = await this.notificationsRepo.findUnread(usuarioId);
      const count = await this.notificationsRepo.countUnread(usuarioId);

      res.json({
        data: {
          notificaciones,
          count,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/unread/count
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const count = await this.notificationsRepo.countUnread(usuarioId);

      res.json({
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/:id
   * Get notification by ID
   */
  async getNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const { id } = req.params;
      const notificacion = await this.notificationsRepo.findById(id);

      if (!notificacion) {
        return res.status(404).json({
          error: {
            code: 'NOTIFICACION_NO_ENCONTRADA',
            message: 'La notificación no existe',
          },
        });
      }

      // Verify ownership
      if (notificacion.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: {
            code: 'PERMISO_DENEGADO',
            message: 'No tienes permiso para ver esta notificación',
          },
        });
      }

      res.json({
        data: { notificacion },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const { id } = req.params;
      
      // Validate body if present
      if (req.body && Object.keys(req.body).length > 0) {
        markAsReadSchema.parse(req.body);
      }

      const notificacion = await this.notificationsRepo.markAsRead(id, usuarioId);

      if (!notificacion) {
        return res.status(404).json({
          error: {
            code: 'NOTIFICACION_NO_ENCONTRADA',
            message: 'La notificación no existe o ya fue marcada como leída',
          },
        });
      }

      res.json({
        data: { notificacion },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: 'VALIDACION_FALLIDO',
            message: 'Error de validación',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const count = await this.notificationsRepo.markAllAsRead(usuarioId);

      res.json({
        data: {
          message: `${count} notificaciones marcadas como leídas`,
          count,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Delete notification
   */
  async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      const { id } = req.params;
      const notificacion = await this.notificationsRepo.findById(id);

      if (!notificacion) {
        return res.status(404).json({
          error: {
            code: 'NOTIFICACION_NO_ENCONTRADA',
            message: 'La notificación no existe',
          },
        });
      }

      // Verify ownership
      if (notificacion.usuarioId !== usuarioId) {
        return res.status(403).json({
          error: {
            code: 'PERMISO_DENEGADO',
            message: 'No tienes permiso para eliminar esta notificación',
          },
        });
      }

      await this.notificationsRepo.delete(id);

      res.json({
        data: {
          message: 'Notificación eliminada',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications/test
   * Send test email (admin only)
   */
  async sendTestEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = (req as any).user?.id;
      const usuarioRol = (req as any).user?.rol;

      if (!usuarioId) {
        return res.status(401).json({
          error: {
            code: 'NO_AUTENTICADO',
            message: 'Usuario no autenticado',
          },
        });
      }

      // Admin only
      if (usuarioRol !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'PERMISO_DENEGADO',
            message: 'Solo administradores pueden enviar emails de prueba',
          },
        });
      }

      // Validate email
      const validation = testEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDACION_FALLIDO',
            message: 'Email inválido',
            details: validation.errors,
          },
        });
      }

      const { email } = validation.data;
      const result = await this.notificationsService.sendTestEmail(email);

      if (result.success) {
        res.json({
          data: { message: result.message },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'ERROR_ENVIO_EMAIL',
            message: result.message,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications (Admin only - for promotional notifications)
   * Create notification manually
   */
  async createNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioRol = (req as any).user?.rol;

      // Admin only
      if (usuarioRol !== 'ADMIN') {
        return res.status(403).json({
          error: {
            code: 'PERMISO_DENEGADO',
            message: 'Solo administradores pueden crear notificaciones',
          },
        });
      }

      // Validate
      const validation = createNotificationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDACION_FALLIDO',
            message: 'Error de validación',
            details: validation.errors,
          },
        });
      }

      const data = validation.data;

      // Verify target user exists
      const targetUser = await this.usuarioRepo.findById(data.usuarioId);
      if (!targetUser) {
        return res.status(404).json({
          error: {
            code: 'USUARIO_NO_ENCONTRADO',
            message: 'El usuario destino no existe',
          },
        });
      }

      // Create notification
      const notificacion = await this.notificationsRepo.create(data);

      res.status(201).json({
        data: { notificacion },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: {
            code: 'VALIDACION_FALLIDO',
            message: 'Error de validación',
            details: error.errors,
          },
        });
      }
      next(error);
    }
  }
}
