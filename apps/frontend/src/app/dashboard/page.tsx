'use client';

import { useAuth } from '@/contexts/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { ProtectedRoute } from '@/components/protected-route';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bienvenido, {user?.nombre}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona tus citas y servicios desde un solo lugar
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Citas Card */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Mis Citas</p>
                  <p className="text-2xl font-bold text-gray-900">--</p>
                </div>
                <div className="rounded-full bg-blue-100 p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <a href="/citas" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
                Ver todas →
              </a>
            </div>

            {/* Servicios Card */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Servicios</p>
                  <p className="text-2xl font-bold text-gray-900">--</p>
                </div>
                <div className="rounded-full bg-green-100 p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              </div>
              <a href="/servicios" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
                Explorar →
              </a>
            </div>

            {/* Perfil Card */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Perfil</p>
                  <p className="text-lg font-bold text-gray-900">{user?.rol}</p>
                </div>
                <div className="rounded-full bg-purple-100 p-3">
                  <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <a href="/perfil" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500">
                Editar →
              </a>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border bg-blue-50 p-6">
            <h2 className="text-lg font-semibold text-blue-900">Próximas Funcionalidades</h2>
            <ul className="mt-3 space-y-2 text-sm text-blue-800">
              <li className="flex items-center">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Reserva de citas en línea
              </li>
              <li className="flex items-center">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Notificaciones por email
              </li>
              <li className="flex items-center">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Pagos en línea
              </li>
            </ul>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
