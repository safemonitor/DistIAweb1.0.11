import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { signUp } from '../lib/auth';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import { useAuthStore } from '../store/authStore';
import type { Profile, Tenant } from '../types/database';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: Profile;
  onSuccess: () => void;
}

export function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
  const { profile: currentUserProfile } = useAuthStore();
  const isSuperAdmin = currentUserProfile?.role === 'superadmin';
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role: user?.role || 'admin',
    tenant_id: user?.tenant_id || currentUserProfile?.tenant_id || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: '',
        password: '',
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id || currentUserProfile?.tenant_id || '',
      });
    } else {
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'admin',
        tenant_id: currentUserProfile?.tenant_id || '',
      });
    }
    
    // Fetch tenants if superadmin
    if (isSuperAdmin && isOpen) {
      fetchTenants();
    }
  }, [user, currentUserProfile, isOpen, isSuperAdmin]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setTenants(data || []);
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (user) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            ...(isSuperAdmin && { tenant_id: formData.tenant_id || null }),
          })
          .eq('id', user.id);

        if (updateError) throw updateError;
        
        // Log activity
        await logActivity(ActivityTypes.USER_UPDATED, {
          user_id: user.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          ...(isSuperAdmin && { tenant_id: formData.tenant_id || null }),
        });
      } else {
        // Create new user
        const { user: newUser } = await signUp(
          formData.email,
          formData.password,
          formData.first_name,
          formData.last_name,
          formData.role as Profile['role'],
          isSuperAdmin ? formData.tenant_id : currentUserProfile?.tenant_id
        );
        
        // Log activity
        await logActivity(ActivityTypes.USER_CREATED, {
          user_id: newUser?.id,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          tenant_id: isSuperAdmin ? formData.tenant_id : currentUserProfile?.tenant_id
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Edit User' : 'Add User'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!user && (
          <>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {/* Tenant selection for superadmin */}
        {isSuperAdmin && (
          <div>
            <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700">
              Tenant
            </label>
            <select
              id="tenant_id"
              name="tenant_id"
              value={formData.tenant_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">No Tenant (Superadmin only)</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {formData.role === 'superadmin' ? 
                'Superadmins typically have no tenant assigned.' : 
                'Select which tenant this user belongs to.'}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="admin">Admin</option>
            <option value="warehouse">Warehouse</option>
            <option value="sales">Sales</option>
            <option value="presales">Presales</option>
            <option value="delivery">Delivery</option>
            {isSuperAdmin && (
              <option value="superadmin">Superadmin</option>
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Note: Sales, Presales, and Delivery roles can also be assigned through the respective Agents & Vehicles pages.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}