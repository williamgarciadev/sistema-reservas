import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { usuarioRepository } from '../repositories/usuario.repository.js';
import { refreshTokenRepository } from '../repositories/refreshToken.repository.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RegistroDTO {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
  };
  token: string;
  refreshToken: string;
}

export class AuthService {
  private readonly SALT_ROUNDS = 10;

  async registro(data: RegistroDTO): Promise<AuthResponse> {
    // Check email uniqueness
    const exists = await usuarioRepository.existsByEmail(data.email);
    if (exists) {
      throw new AppError(
        'EMAIL_DUPLICADO',
        'Email ya registrado',
        409
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    // Create user
    const usuario = await usuarioRepository.create({
      nombre: data.nombre,
      email: data.email.toLowerCase(),
      passwordHash,
      telefono: data.telefono,
      rol: 'CLIENTE'
    });

    // Generate tokens
    const tokens = this.generateTokens(usuario.id);

    // Save refresh token
    await this.saveRefreshToken(usuario.id, tokens.refreshToken);

    return {
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user
    const usuario = await usuarioRepository.findByEmail(data.email);
    if (!usuario) {
      throw new AppError(
        'CREDENCIALES_INVALIDAS',
        'Email o password incorrectos',
        401
      );
    }

    // Check if active
    if (!usuario.activo) {
      throw new AppError(
        'USUARIO_INACTIVO',
        'Usuario inactivo. Contacte al administrador.',
        403
      );
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, usuario.passwordHash);
    if (!validPassword) {
      throw new AppError(
        'CREDENCIALES_INVALIDAS',
        'Email o password incorrectos',
        401
      );
    }

    // Update last login
    await usuarioRepository.update(usuario.id, { lastLoginAt: new Date() });

    // Generate tokens
    const tokens = this.generateTokens(usuario.id);

    // Save refresh token
    await this.saveRefreshToken(usuario.id, tokens.refreshToken);

    return {
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    // Find and validate refresh token
    const tokenRecord = await refreshTokenRepository.findByToken(refreshToken);
    
    if (!tokenRecord) {
      throw new AppError(
        'TOKEN_INVALIDO',
        'Token inválido',
        401
      );
    }

    if (tokenRecord.revoked) {
      throw new AppError(
        'TOKEN_REVOCADO',
        'Token ya fue usado',
        401
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError(
        'TOKEN_EXPIRADO',
        'Token expirado',
        401
      );
    }

    // Revoke old token (rotation)
    await refreshTokenRepository.revoke(refreshToken);

    // Generate new tokens
    const tokens = this.generateTokens(tokenRecord.usuarioId);

    // Save new refresh token
    await this.saveRefreshToken(tokenRecord.usuarioId, tokens.refreshToken);

    return tokens;
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await refreshTokenRepository.revoke(refreshToken);
    }
  }

  async recuperarPassword(email: string): Promise<void> {
    // Always return success to prevent email enumeration
    const usuario = await usuarioRepository.findByEmail(email);
    if (!usuario) {
      return; // Silent success
    }

    // Generate reset token (1 hour expiry)
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // TODO: Save reset token to DB and send email
    // For now, just log it (development only)
    console.log('[DEV] Reset token:', resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // TODO: Implement token validation and password reset
    // This would require a PasswordResetToken model
    throw new AppError(
      'NO_IMPLEMENTADO',
      'Funcionalidad en desarrollo',
      501
    );
  }

  // Private helpers

  private generateTokens(usuarioId: string): Tokens {
    const accessToken = jwt.sign(
      { usuarioId },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      { usuarioId },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(usuarioId: string, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await refreshTokenRepository.create({
      token,
      usuarioId,
      expiresAt
    });
  }

  public verifyToken(token: string): { usuarioId: string } {
    try {
      return jwt.verify(token, config.jwtSecret) as { usuarioId: string };
    } catch (error) {
      throw new AppError(
        'TOKEN_INVALIDO',
        'Token inválido o expirado',
        401
      );
    }
  }
}

export const authService = new AuthService();
