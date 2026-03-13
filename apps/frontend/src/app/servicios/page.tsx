'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Servicio } from 'shared';

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  useEffect(() => {
    loadServicios();
  }, []);

  const loadServicios = async () => {
    try {
      const response = await api.get('/services');
      const serviciosData = response.data.data?.servicios || response.data.data || [];
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al cargar servicios');
    } finally {
      setIsLoading(false);
    }
  };

  // Obtener categorías únicas
  const categorias = ['todos', ...Array.from(new Set(servicios.map(s => s.categoria).filter(Boolean)))];
  
  // Filtrar servicios
  const serviciosFiltrados = filtroCategoria === 'todos' 
    ? servicios 
    : servicios.filter(s => s.categoria === filtroCategoria);

  const getCategoryIcon = (categoria?: string) => {
    const icons: Record<string, JSX.Element> = {
      'Peluquería': (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      'Color': (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      'Estilismo': (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      'Uñas': (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    };
    return icons[categoria || ''] || (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    );
  };

  const getCategoryColor = (categoria?: string) => {
    const colors: Record<string, string> = {
      'Peluquería': 'from-blue-500 to-cyan-500',
      'Color': 'from-purple-500 to-pink-500',
      'Estilismo': 'from-amber-500 to-orange-500',
      'Uñas': 'from-rose-500 to-red-500',
    };
    return colors[categoria || ''] || 'from-gray-500 to-slate-500';
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Nuestros Servicios</h1>
              <p className="mt-1 text-sm text-gray-600">
                Explorá nuestra gama de servicios profesionales
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white rounded-xl px-4 py-2 border border-gray-200 shadow-sm">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{servicios.length} servicios disponibles</span>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {categorias.map((categoria) => (
              <button
                key={categoria}
                onClick={() => setFiltroCategoria(categoria)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 capitalize',
                  filtroCategoria === categoria
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transform scale-105'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                )}
              >
                {categoria === 'todos' ? 'Todos' : categoria}
              </button>
            ))}
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
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
              </div>
            </div>
          ) : serviciosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-2xl border border-gray-200">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 mb-4">
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay servicios en esta categoría</h3>
              <p className="text-gray-600">Probá seleccionando otra categoría</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {serviciosFiltrados.map((servicio) => (
                <div
                  key={servicio.id}
                  className="group relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden transform hover:-translate-y-1"
                >
                  {/* Category gradient bar */}
                  <div className={cn('h-2 bg-gradient-to-r', getCategoryColor(servicio.categoria))}></div>
                  
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br text-white', getCategoryColor(servicio.categoria))}>
                        {getCategoryIcon(servicio.categoria)}
                      </div>
                      {servicio.activo && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          <span className="h-2 w-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                          Disponible
                        </span>
                      )}
                    </div>

                    {/* Service name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                      {servicio.nombre}
                    </h3>

                    {/* Category badge */}
                    {servicio.categoria && (
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 mb-3">
                        {servicio.categoria}
                      </span>
                    )}

                    {/* Description */}
                    {servicio.descripcion ? (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {servicio.descripcion}
                      </p>
                    ) : (
                      <div className="h-10 mb-4"></div>
                    )}

                    {/* Duration */}
                    <div className="flex items-center text-sm text-gray-600 mb-4">
                      <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{servicio.duracion} minutos</span>
                    </div>

                    {/* Footer with price and CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          €{servicio.precio.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          IVA incluido
                        </p>
                      </div>
                      <button className="group/btn inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg">
                        <span>Reservar</span>
                        <svg className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Hover effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
