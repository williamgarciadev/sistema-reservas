import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

// Validation schemas
const registroSchema = z.object({
  nombre: z.string().min(3, 'Nombre debe tener al menos 3 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Password debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Password debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Password debe tener al menos un número'),
  telefono: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password requerido')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido')
});

const recuperarPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string()
    .min(8, 'Password debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Password debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Password debe tener al menos un número')
});

export class AuthController {
  async registro(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = registroSchema.parse(req.body);
      
      const result = await authService.registro(data);
      
      res.status(201).json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      
      const result = await authService.login(data);
      
      res.status(200).json({
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      
      const tokens = await authService.refresh(refreshToken);
      
      res.status(200).json({
        data: { tokens }
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken;
      
      await authService.logout(refreshToken);
      
      res.status(200).json({
        data: {
          message: 'Sesión cerrada exitosamente'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async recuperarPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = recuperarPasswordSchema.parse(req.body);
      
      await authService.recuperarPassword(email);
      
      // Always return success to prevent email enumeration
      res.status(200).json({
        data: {
          message: 'Si el email existe, se envió un link de recuperación'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      
      await authService.resetPassword(token, password);
      
      res.status(200).json({
        data: {
          message: 'Password actualizado exitosamente'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.usuario) {
        throw new AppError('NO_AUTENTICADO', 'Usuario no autenticado', 401);
      }
      
      // TODO: Fetch full user from DB
      res.status(200).json({
        data: {
          usuario: req.usuario
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

// Router
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/registro', (req, res, next) => authController.registro(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/recuperar-password', (req, res, next) => authController.recuperarPassword(req, res, next));
router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));

// Protected routes
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

export { router as authRoutes };
