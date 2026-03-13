import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError | Prisma.PrismaClientKnownRequestError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  // Zod validation error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDACION_FALLIDO',
        message: 'Error de validación de datos',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })),
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // Unique constraint failed
        return res.status(409).json({
          error: {
            code: 'CONFLICTO_UNICO',
            message: 'El recurso ya existe (violación de unicidad)',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      case 'P2025': // Record not found
        return res.status(404).json({
          error: {
            code: 'RECURSO_NO_ENCONTRADO',
            message: 'El recurso solicitado no existe',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
      default:
        return res.status(500).json({
          error: {
            code: 'ERROR_DB',
            message: 'Error de base de datos',
            timestamp: new Date().toISOString(),
            path: req.path
          }
        });
    }
  }

  // AppError (our custom errors)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }

  // Generic error
  const isDev = config.nodeEnv === 'development';
  return res.status(500).json({
    error: {
      code: 'ERROR_INTERNO',
      message: isDev ? err.message : 'Error interno del servidor',
      stack: isDev ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
};
