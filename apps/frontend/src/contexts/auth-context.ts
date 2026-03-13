'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';
import type { Usuario, AuthState, LoginRequest, RegistroRequest, AuthResponse } from 'shared';

interface AuthStore extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegistroRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<Usuario>) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (credentials: LoginRequest) => {
        try {
          const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
          const { user, token, refreshToken } = response.data.data;

          if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
          }

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegistroRequest) => {
        try {
          await apiClient.post('/auth/registro', data);
          // After registration, user should log in
        } catch (error) {
          throw error;
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (user: Partial<Usuario>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...user },
          });
        }
      },

      checkAuth: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (!token) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        try {
          const response = await apiClient.get<{ user: Usuario }>('/auth/me');
          set({
            user: response.data.data.user || response.data.data,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Hook for convenience
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login: store.login,
    register: store.register,
    logout: store.logout,
    updateUser: store.updateUser,
    checkAuth: store.checkAuth,
  };
};
