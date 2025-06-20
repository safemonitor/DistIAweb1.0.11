import { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Tenant } from '../types/database';

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: Tenant;
  onSuccess: () => void;
}

export function TenantModal({ isOpen, onClose, tenant, onSuccess }: TenantModalProps) {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    subscription_plan: tenant?.subscription_plan || 'basic',
    max_users: tenant?.max_users || 5
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'max_users' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (tenant) {
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ 
            name: formData.name, 
            subscription_plan: formData.subscription_plan,
            max_users: formData.max_users
          })
          .eq('id', tenant.id);
        
        if (updateError) throw updateError;
        
        // Log activity
        await logActivity(ActivityTypes.TENANT_UPDATED, {
          tenant_id: tenant.id,
          tenant_name: formData.name,
          subscription_plan: formData.subscription_plan,
          max_users: formData.max_users
        });
      } else {
        const { data, error: insertError } = await supabase
          .from('tenants')
          .insert([{ 
            name: formData.name, 
            subscription_plan: formData.subscription_plan,
            max_users: formData.max_users
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        // Log activity
        await logActivity(ActivityTypes.TENANT_CREATED, {
          tenant_id: data.id,
          tenant_name: formData.name,
          subscription_plan: formData.subscription_plan,
          max_users: formData.max_users
        });

        // Create default tenant modules
        const modules = [
          { module_name: 'presales_delivery', enabled: true },
          { module_name: 'van_sales', enabled: true },
          { module_name: 'wms', enabled: true }
        ];

        const { error: moduleError } = await supabase
          .from('tenant_modules')
          .insert(
            modules.map(module => ({
              tenant_id: data.id,
              module_name: module.module_name,
              enabled: module.enabled
            }))
          );

        if (moduleError) {
          console.error('Error creating tenant modules:', moduleError);
          // Don't throw here, as the tenant was created successfully
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save tenant');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tenant ? 'Edit Tenant' : 'Add Tenant'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="subscription_plan" className="block text-sm font-medium text-gray-700">
            Subscription Plan
          </label>
          <select
            id="subscription_plan"
            name="subscription_plan"
            value={formData.subscription_plan}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div>
          <label htmlFor="max_users" className="block text-sm font-medium text-gray-700">
            Maximum Users
          </label>
          <input
            type="number"
            id="max_users"
            name="max_users"
            value={formData.max_users}
            onChange={handleChange}
            min="1"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Maximum number of user seats allowed for this tenant
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
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
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