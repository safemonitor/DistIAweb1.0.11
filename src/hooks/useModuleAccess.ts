import { useAuthStore } from '../store/authStore';
import type { TenantModule } from '../types/database';

export function useModuleAccess() {
  const { enabledModules } = useAuthStore();

  const hasModule = (moduleName: TenantModule['module_name']): boolean => {
    return enabledModules.some(module => 
      module.module_name === moduleName && module.enabled
    );
  };

  const hasAnyModule = (moduleNames: TenantModule['module_name'][]): boolean => {
    return moduleNames.some(moduleName => hasModule(moduleName));
  };

  const hasAllModules = (moduleNames: TenantModule['module_name'][]): boolean => {
    return moduleNames.every(moduleName => hasModule(moduleName));
  };

  return {
    enabledModules,
    hasModule,
    hasAnyModule,
    hasAllModules
  };
}