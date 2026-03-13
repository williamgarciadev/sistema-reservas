import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { AppError } from './errorHandler.js';
import { Rol } from '@prisma/client';

export interface AuthRequest extends Request {
  usuario?: {
    id: string;
    rol: Rol;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'TOKEN_FALTANTE',
        'Token de autenticación requerido',
        401
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = authService.verifyToken(token);

    // TODO: Fetch user from DB to get rol and check if active
    // For now, just attach usuarioId
    req.usuario = {
      id: payload.usuarioId,
      rol: 'CLIENTE' // Default, will be fetched from DB in real implementation
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: Rol[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return next(new AppError(
        'NO_AUTENTICADO',
        'Usuario no autenticado',
        401
      ));
    }

    if (!roles.includes(req.usuario.rol)) {
      return next(new AppError(
        'PERMISO_DENEGADO',
        'No tiene permisos para realizar esta acción',
        403
      ));
    }

    next();
  };
};

export const isAdmin = requireRole('ADMIN');
export const isEmpleado = requireRole('EMPLEADO', 'ADMIN');
