import prisma from '../lib/prisma.js';
import { Usuario, Rol } from '@prisma/client';

export interface CreateUsuarioDTO {
  nombre: string;
  email: string;
  passwordHash: string;
  telefono?: string;
  rol?: Rol;
}

export interface UpdateUsuarioDTO {
  nombre?: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
  lastLoginAt?: Date;
}

export class UsuarioRepository {
  async create(data: CreateUsuarioDTO): Promise<Usuario> {
    return prisma.usuario.create({ data });
  }

  async findById(id: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async update(id: string, data: UpdateUsuarioDTO): Promise<Usuario> {
    return prisma.usuario.update({
      where: { id },
      data
    });
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const usuario = await prisma.usuario.findFirst({
      where: {
        email: email.toLowerCase(),
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    return !!usuario;
  }

  async list(page: number = 1, limit: number = 20, filters?: {
    rol?: Rol;
    activo?: boolean;
  }) {
    const where: any = {};
    if (filters?.rol) where.rol = filters.rol;
    if (filters?.activo !== undefined) where.activo = filters.activo;

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          rol: true,
          activo: true,
          lastLoginAt: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.usuario.count({ where })
    ]);

    return {
      usuarios,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const usuarioRepository = new UsuarioRepository();
