import { useAuthStore } from '../store/authStore';
import type { TenantModule } from '../types/database';

interface ModuleAccessWrapperProps {
  children: React.ReactNode;
  requiredModules: TenantModule['module_name'][];
  fallback?: React.ReactNode;
}

export function ModuleAccessWrapper({ 
  children, 
  requiredModules, 
  fallback = null 
}: ModuleAccessWrapperProps) {
  const { enabledModules } = useAuthStore();

  const hasModuleAccess = requiredModules.some(moduleName => 
    enabledModules.some(module => module.module_name === moduleName && module.enabled)
  );

  if (!hasModuleAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}