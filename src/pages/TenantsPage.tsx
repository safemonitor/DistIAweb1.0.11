import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TenantModal } from '../components/TenantModal';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Tenant } from '../types/database';

interface TenantWithUserCount extends Tenant {
  user_count: number;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithUserCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | undefined>();

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    try {
      // Fetch tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Fetch user counts for each tenant
      const tenantsWithUserCount = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const { count, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);

          if (countError) {
            console.error('Error fetching user count:', countError);
            return { ...tenant, user_count: 0 };
          }

          return { ...tenant, user_count: count || 0 };
        })
      );

      setTenants(tenantsWithUserCount);
    } catch (err) {
      setError('Failed to fetch tenants');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleEdit = (tenant: TenantWithUserCount) => {
    setSelectedTenant(tenant);
    setIsModalOpen(true);
  };

  const handleDelete = async (tenant: TenantWithUserCount) => {
    if (!confirm('Are you sure you want to delete this tenant? This will delete all associated data and cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id);

      if (error) throw error;
      
      // Log activity
      await logActivity(ActivityTypes.TENANT_DELETED, {
        tenant_id: tenant.id,
        tenant_name: tenant.name
      });
      
      await fetchTenants();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete tenant');
    }
  };

  const handleAddNew = () => {
    setSelectedTenant(undefined);
    setIsModalOpen(true);
  };

  const getSubscriptionBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'premium':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserLimitStatus = (tenant: TenantWithUserCount) => {
    const percentage = (tenant.user_count / tenant.max_users) * 100;
    
    if (percentage >= 90) {
      return 'bg-red-100 text-red-800';
    } else if (percentage >= 70) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Tenants</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all tenants in the system including their name, subscription plan, and user allocation.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={handleAddNew}
            className="flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </button>
        </div>
      </div>
      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Subscription Plan
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      User Seats
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Created At
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                          {tenant.name}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSubscriptionBadgeColor(tenant.subscription_plan)}`}>
                          {tenant.subscription_plan}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUserLimitStatus(tenant)}`}>
                            {tenant.user_count} / {tenant.max_users} users
                          </span>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              tenant.user_count / tenant.max_users >= 0.9 ? 'bg-red-500' : 
                              tenant.user_count / tenant.max_users >= 0.7 ? 'bg-yellow-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, (tenant.user_count / tenant.max_users) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          type="button"
                          onClick={() => handleEdit(tenant)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tenant)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <TenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenant={selectedTenant}
        onSuccess={fetchTenants}
      />
    </div>
  );
}