'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { cn } from '@/lib/utils';
import api from '@/lib/api-client';
import type { Servicio, Empleado } from 'shared';

type Step = 'servicio' | 'profesional' | 'fecha' | 'confirmacion';

interface BookingData {
  servicioId: string | null;
  empleadoId: string | null;
  fecha: string | null;
  hora: string | null;
  notas: string;
}

export default function NuevaCitaPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('servicio');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<string[]>([]);
  
  const [bookingData, setBookingData] = useState<BookingData>({
    servicioId: null,
    empleadoId: null,
    fecha: null,
    hora: null,
    notas: '',
  });

  const steps: { id: Step; label: string; icon: JSX.Element }[] = [
    {
      id: 'servicio',
      label: 'Servicio',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: 'profesional',
      label: 'Profesional',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'fecha',
      label: 'Fecha y Hora',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'confirmacion',
      label: 'Confirmar',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    loadServicios();
  }, []);

  const loadServicios = async () => {
    try {
      const response = await api.get('/services');
      const serviciosData = response.data.data?.servicios || response.data.data || [];
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
    } catch (err) {
      setError('Error al cargar servicios');
    }
  };

  const loadEmpleados = async () => {
    if (!bookingData.servicioId) return;
    try {
      const response = await api.get(`/employees/by-service/${bookingData.servicioId}`);
      const empleadosData = response.data.data?.empleados || response.data.data || [];
      setEmpleados(Array.isArray(empleadosData) ? empleadosData : []);
    } catch (err) {
      setError('Error al cargar profesionales');
    }
  };

  const loadDisponibilidad = async () => {
    if (!bookingData.servicioId || !bookingData.empleadoId || !bookingData.fecha) return;
    try {
      const response = await api.get(
        `/appointments/availability?empleadoId=${bookingData.empleadoId}&fecha=${bookingData.fecha}&servicioId=${bookingData.servicioId}`
      );
      const slots = response.data.data?.slots || response.data.data || [];
      setDisponibilidad(Array.isArray(slots) ? slots : []);
    } catch (err) {
      setError('Error al cargar disponibilidad');
    }
  };

  useEffect(() => {
    if (currentStep === 'profesional') {
      loadEmpleados();
    }
  }, [currentStep, bookingData.servicioId]);

  useEffect(() => {
    if (currentStep === 'fecha') {
      loadDisponibilidad();
    }
  }, [currentStep, bookingData.servicioId, bookingData.empleadoId, bookingData.fecha]);

  const selectServicio = (servicioId: string) => {
    setBookingData({ ...bookingData, servicioId });
  };

  const selectEmpleado = (empleadoId: string) => {
    setBookingData({ ...bookingData, empleadoId });
  };

  const selectFecha = (fecha: string) => {
    setBookingData({ ...bookingData, fecha });
  };

  const selectHora = (hora: string) => {
    setBookingData({ ...bookingData, hora });
  };

  const nextStep = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  };

  const prevStep = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/appointments', {
        servicioId: bookingData.servicioId,
        empleadoId: bookingData.empleadoId,
        fechaInicio: `${bookingData.fecha}T${bookingData.hora}:00`,
        notas: bookingData.notas || undefined,
      });
      router.push('/citas?booking=success');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al crear la cita');
    } finally {
      setIsLoading(false);
    }
  };

  const getStepStatus = (stepId: Step) => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const selectedServicio = servicios.find(s => s.id === bookingData.servicioId);
  const selectedEmpleado = empleados.find(e => e.id === bookingData.empleadoId);

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const getDayName = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'short' });
  };

  const getDayNumber = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate();
  };

  const getMonthName = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { month: 'short' });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reservar Nueva Cita</h1>
            <p className="mt-1 text-sm text-gray-600">
              Completa los pasos para agendar tu cita
            </p>
          </div>

          {/* Progress steps */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const status = getStepStatus(step.id);
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300',
                        status === 'completed' && 'bg-green-500 border-green-500 text-white',
                        status === 'current' && 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110',
                        status === 'upcoming' && 'bg-white border-gray-300 text-gray-400'
                      )}>
                        {status === 'completed' ? (
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step.icon
                        )}
                      </div>
                      <span className={cn(
                        'mt-2 text-xs font-medium hidden sm:block',
                        status === 'current' ? 'text-blue-600' :
                        status === 'completed' ? 'text-green-600' : 'text-gray-400'
                      )}>
                        {step.label}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={cn(
                        'flex-1 h-1 mx-4 rounded-full transition-all duration-300',
                        status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                      )}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error message */}
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

          {/* Step content */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Step 1: Servicio */}
            {currentStep === 'servicio' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Seleccioná un Servicio</h2>
                <p className="text-sm text-gray-600 mb-6">Elegí el servicio que querés reservar</p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {servicios.map((servicio) => (
                    <button
                      key={servicio.id}
                      onClick={() => selectServicio(servicio.id)}
                      className={cn(
                        'relative p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md',
                        bookingData.servicioId === servicio.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {bookingData.servicioId === servicio.id && (
                        <div className="absolute top-3 right-3">
                          <svg className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="mb-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{servicio.nombre}</h3>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{servicio.descripcion || 'Servicio profesional'}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">€{servicio.precio.toFixed(2)}</span>
                        <span className="text-xs text-gray-500">{servicio.duracion} min</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={nextStep}
                    disabled={!bookingData.servicioId}
                    className={cn(
                      'inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:shadow-lg',
                      'hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200',
                      !bookingData.servicioId && 'opacity-50 cursor-not-allowed transform-none'
                    )}
                  >
                    <span>Continuar</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Profesional */}
            {currentStep === 'profesional' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Seleccioná un Profesional</h2>
                <p className="text-sm text-gray-600 mb-6">Elegí quién te atenderá</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {empleados.map((empleado) => (
                    <button
                      key={empleado.id}
                      onClick={() => selectEmpleado(empleado.id)}
                      className={cn(
                        'relative p-5 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md w-full',
                        bookingData.empleadoId === empleado.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {bookingData.empleadoId === empleado.id && (
                        <div className="absolute top-3 right-3">
                          <svg className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="flex items-center space-x-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold">
                          {empleado.nombre.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{empleado.nombre}</h3>
                          <p className="text-sm text-gray-600">{empleado.servicios?.length || 0} servicios</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {empleado.servicios?.slice(0, 3).map((servicio) => (
                              <span key={servicio.id} className="inline-block px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
                                {servicio.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {empleados.length === 0 && (
                  <div className="text-center py-12">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mx-auto mb-4">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-600">No hay profesionales disponibles para este servicio</p>
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={nextStep}
                    disabled={!bookingData.empleadoId}
                    className={cn(
                      'inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:shadow-lg',
                      'hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200',
                      !bookingData.empleadoId && 'opacity-50 cursor-not-allowed transform-none'
                    )}
                  >
                    <span>Continuar</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Fecha y Hora */}
            {currentStep === 'fecha' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Seleccioná Fecha y Hora</h2>
                <p className="text-sm text-gray-600 mb-6">Elegí cuándo querés tu cita</p>

                {/* Date selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Fecha</label>
                  <div className="flex space-x-2 overflow-x-auto pb-2">
                    {getNext7Days().map((date) => (
                      <button
                        key={date}
                        onClick={() => selectFecha(date)}
                        className={cn(
                          'flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border-2 transition-all duration-200',
                          bookingData.fecha === date
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="text-xs text-gray-500 uppercase">{getDayName(date)}</span>
                        <span className={cn(
                          'text-lg font-bold',
                          bookingData.fecha === date ? 'text-blue-600' : 'text-gray-900'
                        )}>
                          {getDayNumber(date)}
                        </span>
                        <span className="text-xs text-gray-500">{getMonthName(date)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time slots */}
                {bookingData.fecha && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Horarios Disponibles</label>
                    {disponibilidad.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {disponibilidad.map((hora) => (
                          <button
                            key={hora}
                            onClick={() => selectHora(hora)}
                            className={cn(
                              'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200',
                              bookingData.hora === hora
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            )}
                          >
                            {hora}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-xl">
                        <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-gray-600">No hay horarios disponibles para esta fecha</p>
                        <p className="text-sm text-gray-500 mt-1">Seleccioná otra fecha</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={nextStep}
                    disabled={!bookingData.fecha || !bookingData.hora}
                    className={cn(
                      'inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-md hover:shadow-lg',
                      'hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200',
                      (!bookingData.fecha || !bookingData.hora) && 'opacity-50 cursor-not-allowed transform-none'
                    )}
                  >
                    <span>Continuar</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Confirmación */}
            {currentStep === 'confirmacion' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmá tu Reserva</h2>
                <p className="text-sm text-gray-600 mb-6">Revisá los detalles antes de confirmar</p>

                {/* Summary card */}
                <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 mb-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedServicio?.nombre}</h3>
                      <p className="text-sm text-gray-600">{selectedServicio?.duracion} minutos</p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Profesional</p>
                        <p className="font-semibold text-gray-900">{selectedEmpleado?.nombre}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Fecha y Hora</p>
                        <p className="font-semibold text-gray-900">
                          {bookingData.fecha && new Date(bookingData.fecha).toLocaleDateString('es-ES')} a las {bookingData.hora}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Precio</p>
                        <p className="font-semibold text-gray-900">€{selectedServicio?.precio.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <p className="font-semibold text-green-600">Por Confirmar</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes field */}
                <div className="mb-6">
                  <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-2">
                    Notas adicionales <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="notas"
                    rows={3}
                    value={bookingData.notas}
                    onChange={(e) => setBookingData({ ...bookingData, notas: e.target.value })}
                    className="block w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                    placeholder="¿Alguna necesidad especial o comentario?"
                  />
                </div>

                {/* Terms */}
                <div className="mb-6 flex items-start">
                  <input
                    id="confirm-terms"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="confirm-terms" className="ml-3 text-sm text-gray-600">
                    Confirmo que he leído y acepto la política de cancelación (24 horas de anticipación)
                  </label>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={prevStep}
                    className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Atrás
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className={cn(
                      'inline-flex items-center space-x-2 px-8 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-sm font-semibold text-white shadow-md hover:shadow-lg',
                      'hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200',
                      isLoading && 'opacity-70 cursor-not-allowed transform-none'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Confirmar Reserva</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Help card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-5">
            <div className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-blue-900">¿Necesitás ayuda?</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Si tenés dudas sobre los servicios o necesitas asistencia, contactanos al{' '}
                  <a href="tel:+34900000000" className="font-medium underline">900 000 000</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
