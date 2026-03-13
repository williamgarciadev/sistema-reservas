import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JWTPayload {
  usuarioId: string;
}

export function generateAccessToken(usuarioId: string): string {
  return jwt.sign(
    { usuarioId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function generateRefreshToken(usuarioId: string): string {
  return jwt.sign(
    { usuarioId },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.jwtSecret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRADO');
    }
    throw new Error('TOKEN_INVALIDO');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.jwtRefreshSecret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRADO');
    }
    throw new Error('TOKEN_INVALIDO');
  }
}

export function decodeToken(token: string): JWTPayload | null {
  return jwt.decode(token) as JWTPayload | null;
}
