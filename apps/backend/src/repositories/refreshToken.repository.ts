import prisma from '../lib/prisma.js';
import { RefreshToken } from '@prisma/client';

export interface CreateRefreshTokenDTO {
  token: string;
  usuarioId: string;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  async create(data: CreateRefreshTokenDTO): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { usuario: true }
    });
  }

  async revoke(token: string): Promise<RefreshToken> {
    return prisma.refreshToken.update({
      where: { token },
      data: { revoked: true }
    });
  }

  async revokeAllByUsuario(usuarioId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { usuarioId },
      data: { revoked: true }
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true }
        ]
      }
    });
    return result.count;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
