import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { servicesService } from '../services/services.service.js';
import { AppError } from '../middleware/errorHandler.js';

// Zod schemas for validation
import { z } from 'zod';

const createServicioSchema = z.object({
  nombre: z.string().min(3).max(100),
  descripcion: z.string().max(500).optional(),
  duracion: z.number().int().positive(),
  precio: z.number().nonnegative().max(10000),
  categoria: z.string().max(50).optional(),
  imagenUrl: z.string().url().optional()
});

const updateServicioSchema = z.object({
  nombre: z.string().min(3).max(100).optional(),
  descripcion: z.string().max(500).optional(),
  duracion: z.number().int().positive().optional(),
  precio: z.number().nonnegative().max(10000).optional(),
  categoria: z.string().max(50).optional(),
  imagenUrl: z.string().url().optional(),
  activo: z.boolean().optional()
});

export class ServicesController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const categoria = req.query.categoria as string | undefined;
      const activo = req.query.activo ? req.query.activo === 'true' : undefined;

      const result = await servicesService.list(page, limit, { categoria, activo });

      res.json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const servicios = await servicesService.listAllWithStats();

      res.json({
        data: {
          servicios
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const servicio = await servicesService.getById(id);

      res.json({
        data: {
          servicio
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validationResult = createServicioSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const servicio = await servicesService.create(validationResult.data);

      res.status(201).json({
        data: {
          servicio
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Validate request body
      const validationResult = updateServicioSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const servicio = await servicesService.update(id, validationResult.data);

      res.json({
        data: {
          servicio
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const servicio = await servicesService.deactivate(id);

      res.json({
        data: {
          servicio: {
            id: servicio.id,
            nombre: servicio.nombre,
            activo: servicio.activo
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async activate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const servicio = await servicesService.activate(id);

      res.json({
        data: {
          servicio: {
            id: servicio.id,
            nombre: servicio.nombre,
            activo: servicio.activo
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const servicesController = new ServicesController();
