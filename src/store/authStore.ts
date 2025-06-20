import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Profile, TenantModule } from '../types/database';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  enabledModules: TenantModule[];
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setEnabledModules: (modules: TenantModule[]) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  enabledModules: [],
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setEnabledModules: (enabledModules) => set({ enabledModules }),
  setLoading: (isLoading) => set({ isLoading }),
}));

async function fetchUserProfileAndModules(userId: string) {
  try {
    // Fetch user profile - use maybeSingle() to handle cases where profile doesn't exist
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    console.log('Fetched profile from profiles table:', profile);
    console.log('User role:', profile?.role);
    
    useAuthStore.getState().setProfile(profile);

    // Fetch enabled modules for the tenant
    if (profile?.tenant_id) {
      const { data: modules, error: modulesError } = await supabase
        .from('tenant_modules')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('enabled', true);

      if (modulesError) throw modulesError;

      console.log('Fetched enabled modules:', modules);
      useAuthStore.getState().setEnabledModules(modules || []);
    } else {
      console.log('No tenant_id found for user, not fetching modules');
      // For superadmin, we should enable all modules by default
      if (profile?.role === 'superadmin') {
        console.log('User is superadmin, enabling all modules');
        // Create dummy enabled modules for all module types
        const allModules: TenantModule[] = [
          { tenant_id: '', module_name: 'presales_delivery', enabled: true },
          { tenant_id: '', module_name: 'van_sales', enabled: true },
          { tenant_id: '', module_name: 'wms', enabled: true }
        ];
        useAuthStore.getState().setEnabledModules(allModules);
      } else {
        useAuthStore.getState().setEnabledModules([]);
      }
    }
  } catch (error) {
    console.error('Error fetching user profile and modules:', error);
  } finally {
    useAuthStore.getState().setLoading(false);
  }
}

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.getState().setUser(session?.user ?? null);
  if (session?.user) {
    fetchUserProfileAndModules(session.user.id);
  } else {
    useAuthStore.getState().setLoading(false);
  }
});

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setUser(session?.user ?? null);
  if (session?.user) {
    fetchUserProfileAndModules(session.user.id);
  } else {
    useAuthStore.getState().setProfile(null);
    useAuthStore.getState().setEnabledModules([]);
    useAuthStore.getState().setLoading(false);
  }
});