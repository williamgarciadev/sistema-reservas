'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Cita } from 'shared';

export default function CitasPage() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCitas();
  }, []);

  const loadCitas = async () => {
    try {
      const response = await api.get('/appointments');
      const citasData = response.data.data?.citas || response.data.data || [];
      setCitas(Array.isArray(citasData) ? citasData : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al cargar citas');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = (estado: string) => {
    const statusMap: Record<string, { color: string; bg: string; icon: string; label: string }> = {
      CONFIRMADA: { 
        color: 'text-blue-700', 
        bg: 'bg-blue-50 border-blue-200', 
        icon: '✓',
        label: 'Confirmada'
      },
      PAGADA: { 
        color: 'text-green-700', 
        bg: 'bg-green-50 border-green-200',
        icon: '$',
        label: 'Pagada'
      },
      COMPLETADA: { 
        color: 'text-gray-700', 
        bg: 'bg-gray-50 border-gray-200',
        icon: '✓',
        label: 'Completada'
      },
      CANCELADA: { 
        color: 'text-red-700', 
        bg: 'bg-red-50 border-red-200',
        icon: '✕',
        label: 'Cancelada'
      },
      REEMBOLSADA: { 
        color: 'text-yellow-700', 
        bg: 'bg-yellow-50 border-yellow-200',
        icon: '↺',
        label: 'Reembolsada'
      },
      NO_SHOW: { 
        color: 'text-purple-700', 
        bg: 'bg-purple-50 border-purple-200',
        icon: '!',
        label: 'No asistió'
      },
    };
    return statusMap[estado] || { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '•', label: estado };
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mis Citas</h1>
              <p className="mt-1 text-sm text-gray-600">
                Gestiona y visualiza todas tus reservas programadas
              </p>
            </div>
            <a
              href="/nueva-cita"
              className="inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nueva Cita</span>
            </a>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Citas</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">{citas.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Próxima Cita</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {citas.filter(c => c.estado === 'CONFIRMADA').length > 0 ? 'Hoy' : '—'}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completadas</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {citas.filter(c => c.estado === 'COMPLETADA').length}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                  <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Canceladas</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {citas.filter(c => c.estado === 'CANCELADA').length}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900">Historial de Citas</h2>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center p-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
                </div>
              </div>
            ) : citas.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 mb-6">
                  <svg className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No tienes citas programadas</h3>
                <p className="text-gray-600 mb-8 max-w-sm">
                  Comienza reservando tu primera cita con nuestros servicios profesionales
                </p>
                <a
                  href="/servicios"
                  className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Ver Servicios Disponibles</span>
                </a>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {citas.map((cita) => {
                  const statusInfo = getStatusInfo(cita.estado);
                  return (
                    <div 
                      key={cita.id} 
                      className="group p-6 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50/30 transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start space-x-4 flex-1">
                          {/* Service icon */}
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                            <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                {cita.servicio.nombre}
                              </h3>
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border',
                                statusInfo.bg,
                                statusInfo.color
                              )}>
                                <span className="mr-1">{statusInfo.icon}</span>
                                {statusInfo.label}
                              </span>
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="font-medium">{cita.empleado.nombre}</span>
                                <span className="mx-2 text-gray-300">•</span>
                                <span>{cita.servicio.duracion} minutos</span>
                              </div>
                              
                              <div className="flex items-center text-sm text-gray-600">
                                <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDate(cita.fechaInicio)}
                              </div>
                              
                              {cita.notas && (
                                <div className="flex items-start text-sm text-gray-500 italic mt-2">
                                  <svg className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  {cita.notas}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-bold text-gray-900">
                            €{cita.servicio.precio.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            IVA incluido
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          Ver Detalles
                        </button>
                        {cita.estado === 'CONFIRMADA' && (
                          <>
                            <button className="px-4 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                              Reagendar
                            </button>
                            <button className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
