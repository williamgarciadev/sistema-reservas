'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/contexts/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('CLIENTE' | 'EMPLEADO' | 'ADMIN')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!isLoading && isAuthenticated && allowedRoles && user && !allowedRoles.includes(user.rol)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router, pathname, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.rol)) {
    return null;
  }

  return <>{children}</>;
}
