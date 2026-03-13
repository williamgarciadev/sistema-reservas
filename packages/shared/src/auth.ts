// Shared types for auth and API
import { Usuario, Rol, ApiResponse, ApiError } from './index';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegistroRequest {
  nombre: string;
  email: string;
  telefono?: string;
  password: string;
}

export interface AuthResponse {
  user: Usuario;
  token: string;
  refreshToken: string;
}

export interface AuthState {
  user: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterResponse {
  message: string;
  user: Usuario;
}
