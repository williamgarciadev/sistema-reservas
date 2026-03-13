import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { employeesService } from '../services/employees.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const createEmpleadoSchema = z.object({
  usuarioId: z.string().optional(),
  nombre: z.string().min(3).max(100),
  email: z.string().email(),
  telefono: z.string().optional(),
  rol: z.enum(['EMPLEADO', 'ADMIN']).optional(),
  password: z.string().min(8).optional(),
  servicios: z.array(z.string()).optional(),
  horarioLaboral: z.record(z.object({
    inicio: z.string(),
    fin: z.string()
  })).optional()
});

const updateEmpleadoSchema = z.object({
  nombre: z.string().min(3).max(100).optional(),
  email: z.string().email().optional(),
  telefono: z.string().optional(),
  activo: z.boolean().optional(),
  servicios: z.array(z.string()).optional(),
  horarioLaboral: z.record(z.object({
    inicio: z.string(),
    fin: z.string()
  })).optional()
});

const assignServicioSchema = z.object({
  servicioId: z.string()
});

export class EmployeesController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const activo = req.query.activo ? req.query.activo === 'true' : undefined;
      const servicioId = req.query.servicioId as string | undefined;

      const result = await employeesService.list(page, limit, { activo, servicioId });

      res.json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async listByServicio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { servicioId } = req.params;
      const empleados = await employeesService.listByServicio(servicioId);

      res.json({
        data: {
          empleados
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const empleado = await employeesService.getById(id);

      res.json({
        data: {
          empleado
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validationResult = createEmpleadoSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const empleado = await employeesService.create(validationResult.data);

      res.status(201).json({
        data: {
          empleado
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
      const validationResult = updateEmpleadoSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const empleado = await employeesService.update(id, validationResult.data);

      res.json({
        data: {
          empleado
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const empleado = await employeesService.deactivate(id);

      res.json({
        data: {
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            activo: empleado.activo
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
      const empleado = await employeesService.activate(id);

      res.json({
        data: {
          empleado: {
            id: empleado.id,
            nombre: empleado.nombre,
            activo: empleado.activo
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async assignServicio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Validate request body
      const validationResult = assignServicioSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const empleado = await employeesService.assignServicio(id, validationResult.data.servicioId);

      res.json({
        data: {
          empleado
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async removeServicio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id, servicioId } = req.params;
      const empleado = await employeesService.removeServicio(id, servicioId);

      res.json({
        data: {
          empleado
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const employeesController = new EmployeesController();
