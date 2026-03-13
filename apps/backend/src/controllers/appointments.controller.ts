import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { appointmentsService } from '../services/appointments.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { EstadoCita } from '@prisma/client';

const createCitaSchema = z.object({
  servicioId: z.string(),
  empleadoId: z.string(),
  fechaInicio: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Fecha inválida'
  ),
  notas: z.string().max(500).optional()
});

const updateCitaSchema = z.object({
  fechaInicio: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    'Fecha inválida'
  ).optional(),
  notas: z.string().max(500).optional()
});

const cancelCitaSchema = z.object({
  motivo: z.string().max(500).optional()
});

const listCitasQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  estado: z.nativeEnum(EstadoCita).optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
  empleadoId: z.string().optional(),
  servicioId: z.string().optional()
});

export class AppointmentsController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate query params
      const validationResult = listCitasQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const page = parseInt(validationResult.data.page || '1');
      const limit = parseInt(validationResult.data.limit || '20');
      
      const filters: any = {
        estado: validationResult.data.estado
      };

      if (validationResult.data.desde) {
        filters.desde = new Date(validationResult.data.desde);
      }

      if (validationResult.data.hasta) {
        filters.hasta = new Date(validationResult.data.hasta);
      }

      if (validationResult.data.empleadoId && req.usuario?.rol === 'ADMIN') {
        filters.empleadoId = validationResult.data.empleadoId;
      }

      if (validationResult.data.servicioId && req.usuario?.rol === 'ADMIN') {
        filters.servicioId = validationResult.data.servicioId;
      }

      const result = await appointmentsService.listCitas(
        req.usuario!.id,
        req.usuario!.rol,
        page,
        limit,
        filters
      );

      res.json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cita = await appointmentsService.getCitaById(
        id,
        req.usuario!.id,
        req.usuario!.rol
      );

      res.json({
        data: {
          cita
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validationResult = createCitaSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const cita = await appointmentsService.createCita(
        validationResult.data,
        req.usuario!.id
      );

      res.status(201).json({
        data: {
          cita
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
      const validationResult = updateCitaSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const cita = await appointmentsService.updateCita(
        id,
        validationResult.data,
        req.usuario!.id,
        req.usuario!.rol
      );

      res.json({
        data: {
          cita
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Validate request body (optional motivo)
      const validationResult = cancelCitaSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          validationResult.error.errors.map(e => e.message).join(', '),
          400
        );
      }

      const result = await appointmentsService.cancelarCita(
        id,
        req.usuario!.id,
        req.usuario!.rol
      );

      res.json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const result = await appointmentsService.completarCita(
        id,
        req.usuario!.id,
        req.usuario!.rol
      );

      res.json({
        data: {
          cita: result
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { empleadoId, fecha, servicioId } = req.query;

      if (!empleadoId || !fecha || !servicioId) {
        throw new AppError(
          'VALIDACION_FALLIDO',
          'Se requiere empleadoId, fecha y servicioId',
          400
        );
      }

      const slots = await appointmentsService.getAvailableSlots(
        empleadoId as string,
        fecha as string,
        servicioId as string
      );

      res.json({
        data: slots
      });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentsController = new AppointmentsController();
