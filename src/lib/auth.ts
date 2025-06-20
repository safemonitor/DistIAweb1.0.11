import { supabase } from './supabase';
import { logActivity, ActivityTypes } from './activityLogger';
import type { Profile } from '../types/database';

export async function signUp(email: string, password: string, firstName: string, lastName: string, role: Profile['role'], tenantId?: string) {
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !authData.user) {
    throw signUpError || new Error('Failed to create user');
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    first_name: firstName,
    last_name: lastName,
    role,
    tenant_id: tenantId || null,
  });

  if (profileError) {
    throw profileError;
  }

  // Log the signup activity
  await logActivity(ActivityTypes.USER_SIGNUP, {
    email,
    role,
    first_name: firstName,
    last_name: lastName,
    tenant_id: tenantId,
  });

  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  // Log the login activity
  await logActivity(ActivityTypes.USER_LOGIN, {
    email,
  });

  return data;
}

export async function signOut() {
  // Log the logout activity before signing out
  await logActivity(ActivityTypes.USER_LOGOUT);
  
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

// Function to create a superadmin account
export async function createSuperAdmin(email: string, password: string, firstName: string, lastName: string) {
  try {
    // Create the user in Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !authData.user) {
      throw signUpError || new Error('Failed to create user');
    }

    // Create the profile with superadmin role (no tenant_id for superadmin)
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      first_name: firstName,
      last_name: lastName,
      role: 'superadmin',
      tenant_id: null,
    });

    if (profileError) {
      throw profileError;
    }

    console.log('Superadmin created successfully:', authData.user.id);
    return authData;
  } catch (error) {
    console.error('Error creating superadmin:', error);
    throw error;
  }
}