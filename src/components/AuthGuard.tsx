import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { TenantModule } from '../types/database';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredModules?: TenantModule['module_name'][];
}

export function AuthGuard({ children, allowedRoles, requiredModules }: AuthGuardProps) {
  const { user, profile, enabledModules, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Superadmin bypasses all role and module checks
  if (profile?.role === 'superadmin') {
    return <>{children}</>;
  }

  // Check role access
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/\" replace />;
  }

  // Check module access
  if (requiredModules && requiredModules.length > 0) {
    const hasModuleAccess = requiredModules.some(moduleName => 
      enabledModules.some(module => module.module_name === moduleName && module.enabled)
    );

    if (!hasModuleAccess) {
      return <Navigate to="/\" replace />;
    }
  }

  return <>{children}</>;
}