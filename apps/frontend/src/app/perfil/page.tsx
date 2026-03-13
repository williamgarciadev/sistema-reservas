'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';

const profileSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function PerfilPage() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState({ citasTotales: 0, citasPendientes: 0, citasCompletadas: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/appointments');
      const citas = response.data.data?.citas || response.data.data || [];
      setStats({
        citasTotales: citas.length,
        citasPendientes: citas.filter((c: any) => c.estado === 'CONFIRMADA').length,
        citasCompletadas: citas.filter((c: any) => c.estado === 'COMPLETADA').length,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre: user?.nombre || '',
      email: user?.email || '',
      telefono: '',
    },
  });

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.patch('/auth/perfil', data);
      updateUser(response.data.data);
      setSuccess('✅ Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al actualizar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    reset({
      nombre: user?.nombre || '',
      email: user?.email || '',
      telefono: '',
    });
    setIsEditing(false);
    setError(null);
  };

  const getInitials = () => {
    return user?.nombre
      ? user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U';
  };

  const getRoleBadge = (rol: string) => {
    const badges: Record<string, { bg: string; color: string; label: string }> = {
      ADMIN: { bg: 'bg-purple-100', color: 'text-purple-700', label: 'Administrador' },
      EMPLEADO: { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Empleado' },
      CLIENTE: { bg: 'bg-green-100', color: 'text-green-700', label: 'Cliente' },
    };
    return badges[rol] || { bg: 'bg-gray-100', color: 'text-gray-700', label: rol };
  };

  const roleBadge = getRoleBadge(user?.rol || 'CLIENTE');

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona tu información personal y preferencias
            </p>
          </div>

          {/* Success/Error messages */}
          {success && (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 animate-fade-in">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Cover */}
                <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                
                {/* Avatar */}
                <div className="px-6 pb-6">
                  <div className="relative -mt-12 mb-4">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg border-4 border-white">
                      {getInitials()}
                    </div>
                    {isEditing && (
                      <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white border-2 border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
                        <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{user?.nombre}</h2>
                    <p className="text-sm text-gray-600">{user?.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold', roleBadge.bg, roleBadge.color)}>
                    {roleBadge.label}
                  </span>

                  {/* Account status */}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Estado de cuenta</span>
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold',
                        user?.activo 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      )}>
                        <span className={cn(
                          'h-2 w-2 rounded-full mr-1.5',
                          user?.activo ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        )}></span>
                        {user?.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <div className="text-center p-3 rounded-xl bg-gray-50">
                      <p className="text-lg font-bold text-gray-900">{stats.citasTotales}</p>
                      <p className="text-xs text-gray-600">Totales</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <p className="text-lg font-bold text-blue-700">{stats.citasPendientes}</p>
                      <p className="text-xs text-blue-600">Pendientes</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <p className="text-lg font-bold text-green-700">{stats.citasCompletadas}</p>
                      <p className="text-xs text-green-600">Completadas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security card */}
              <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Seguridad</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-gray-200 group-hover:border-gray-300">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">Contraseña</p>
                        <p className="text-xs text-gray-500">Último cambio hace 30 días</p>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-gray-200 group-hover:border-gray-300">
                        <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">Autenticación 2FA</p>
                        <p className="text-xs text-gray-500">No configurado</p>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400 group-hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Información Personal</h3>
                    <p className="text-sm text-gray-600 mt-0.5">Actualizá tus datos personales</p>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Editar</span>
                    </button>
                  )}
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6">
                  <div className="space-y-6">
                    {/* Name field */}
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          {...register('nombre')}
                          type="text"
                          disabled={!isEditing}
                          className={cn(
                            'block w-full pl-10 pr-3 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200',
                            !isEditing 
                              ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                              : 'bg-white border-gray-200 hover:border-gray-300',
                            errors.nombre && 'border-red-300 focus:ring-red-500'
                          )}
                          placeholder="Tu nombre completo"
                        />
                      </div>
                      {errors.nombre && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.nombre.message}
                        </p>
                      )}
                    </div>

                    {/* Email field */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Correo Electrónico
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                          </svg>
                        </div>
                        <input
                          {...register('email')}
                          type="email"
                          disabled={!isEditing}
                          className={cn(
                            'block w-full pl-10 pr-3 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200',
                            !isEditing 
                              ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                              : 'bg-white border-gray-200 hover:border-gray-300',
                            errors.email && 'border-red-300 focus:ring-red-500'
                          )}
                          placeholder="tu@email.com"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Phone field */}
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
                        Número de Teléfono
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          {...register('telefono')}
                          type="tel"
                          disabled={!isEditing}
                          className={cn(
                            'block w-full pl-10 pr-3 py-3 border-2 rounded-xl text-gray-900 placeholder-gray-400',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200',
                            !isEditing 
                              ? 'bg-gray-50 border-gray-200 cursor-not-allowed' 
                              : 'bg-white border-gray-200 hover:border-gray-300',
                            errors.telefono && 'border-red-300 focus:ring-red-500'
                          )}
                          placeholder="+34 600 000 000"
                        />
                      </div>
                      {errors.telefono && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {errors.telefono.message}
                        </p>
                      )}
                    </div>

                    {/* Account info */}
                    <div className="rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 p-5 border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Información de Cuenta</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Miembro desde</p>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Último acceso</p>
                          <p className="text-sm font-medium text-gray-900">Hoy</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {isEditing && (
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                          'inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:shadow-lg',
                          'hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200',
                          isLoading && 'opacity-70 cursor-not-allowed transform-none'
                        )}
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Guardar Cambios</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Danger zone */}
              <div className="mt-6 bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-100">
                  <h3 className="text-lg font-semibold text-red-900">Zona de Peligro</h3>
                  <p className="text-sm text-red-700 mt-0.5">Acciones irreversibles para tu cuenta</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Eliminar cuenta</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Esta acción eliminará permanentemente tu cuenta y todos tus datos
                      </p>
                    </div>
                    <button className="px-4 py-2 rounded-xl border border-red-300 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors">
                      Eliminar Cuenta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
