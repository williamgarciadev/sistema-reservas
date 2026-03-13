// Shared types for sistema-reservas
// Based on spec.md v1.0

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export type Rol = 'CLIENTE' | 'EMPLEADO' | 'ADMIN';

export interface Servicio {
  id: string;
  nombre: string;
  descripcion?: string;
  duracion: number; // minutos
  precio: number;
  categoria?: string;
  activo: boolean;
}

export interface Empleado {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  servicios: Servicio[];
  horarioLaboral: HorarioSemanal;
}

export interface HorarioSemanal {
  lunes?: HorarioDiario;
  martes?: HorarioDiario;
  miercoles?: HorarioDiario;
  jueves?: HorarioDiario;
  viernes?: HorarioDiario;
  sabado?: HorarioDiario;
  domingo?: HorarioDiario;
}

export interface HorarioDiario {
  inicio: string; // "09:00"
  fin: string; // "18:00"
}

export type EstadoCita = 
  | 'CONFIRMADA'
  | 'PAGADA'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'REEMBOLSADA'
  | 'NO_SHOW';

export interface Cita {
  id: string;
  cliente: Usuario;
  empleado: Empleado;
  servicio: Servicio;
  fechaInicio: string; // ISO 8601
  fechaFin: string; // ISO 8601
  estado: EstadoCita;
  notas?: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path: string;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Auth types
export * from './auth';
