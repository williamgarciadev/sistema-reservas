import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { authService } from '../services/auth.service.js';
import { AppError } from '../middleware/errorHandler.js';

class AuthController {
  async registro(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { nombre, email, password, telefono } = req.body;
      const result = await authService.registro({ nombre, email, password, telefono });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken;
      await authService.logout(refreshToken);
      res.json({ success: true, message: 'Logout exitoso' });
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.usuario) {
        throw new AppError('NO_AUTENTICADO', 'Usuario no autenticado', 401);
      }
      const usuario = await authService.getUsuarioById(req.usuario.id);
      res.json({ success: true, data: usuario });
    } catch (error) {
      next(error);
    }
  }

  async recuperarPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await authService.recuperarPassword(email);
      res.json({ success: true, message: 'Email de recuperación enviado' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
