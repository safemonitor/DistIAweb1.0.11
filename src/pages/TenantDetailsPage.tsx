import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Package, 
  ClipboardList, 
  Receipt, 
  Settings, 
  ArrowLeft,
  Calendar,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TenantUserManagement } from '../components/TenantUserManagement';
import { TenantModal } from '../components/TenantModal';
import { UserActivityLogViewer } from '../components/UserActivityLogViewer';
import type { Tenant, TenantModule } from '../types/database';

export function TenantDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantModules, setTenantModules] = useState<TenantModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'modules' | 'activity'>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [stats, setStats] = useState({
    userCount: 0,
    productCount: 0,
    orderCount: 0,
    invoiceCount: 0
  });

  useEffect(() => {
    if (id) {
      fetchTenantDetails(id);
    }
  }, [id]);

  async function fetchTenantDetails(tenantId: string) {
    try {
      setIsLoading(true);
      
      // Fetch tenant details
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;
      setTenant(tenantData);

      // Fetch tenant modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('tenant_modules')
        .select('*')
        .eq('tenant_id', tenantId);

      if (modulesError) throw modulesError;
      setTenantModules(modulesData || []);

      // Fetch stats
      await fetchTenantStats(tenantId);
    } catch (err) {
      console.error('Error fetching tenant details:', err);
      setError('Failed to load tenant details');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTenantStats(tenantId: string) {
    try {
      // Fetch user count
      const { count: userCount, error: userError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (userError) throw userError;

      // Fetch product count
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (productError) throw productError;

      // Fetch order count
      const { count: orderCount, error: orderError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (orderError) throw orderError;

      // Fetch invoice count
      const { count: invoiceCount, error: invoiceError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (invoiceError) throw invoiceError;

      setStats({
        userCount: userCount || 0,
        productCount: productCount || 0,
        orderCount: orderCount || 0,
        invoiceCount: invoiceCount || 0
      });
    } catch (err) {
      console.error('Error fetching tenant stats:', err);
    }
  }

  const toggleModuleStatus = async (moduleName: TenantModule['module_name'], currentStatus: boolean) => {
    if (!tenant) return;
    
    try {
      const { error } = await supabase
        .from('tenant_modules')
        .upsert({
          tenant_id: tenant.id,
          module_name: moduleName,
          enabled: !currentStatus
        });

      if (error) throw error;
      
      // Refresh modules
      const { data, error: refreshError } = await supabase
        .from('tenant_modules')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (refreshError) throw refreshError;
      setTenantModules(data || []);
    } catch (err) {
      console.error('Error toggling module status:', err);
      alert('Failed to update module status');
    }
  };

  const getModuleStatus = (moduleName: TenantModule['module_name']) => {
    return tenantModules.find(m => m.module_name === moduleName)?.enabled || false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error || 'Tenant not found'}</p>
        <button
          onClick={() => navigate('/tenants')}
          className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/tenants')}
            className="mr-4 text-gray-400 hover:text-gray-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
              <Building2 className="h-6 w-6 mr-3 text-indigo-600" />
              {tenant.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${
                tenant.subscription_plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                tenant.subscription_plan === 'premium' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {tenant.subscription_plan}
              </span>
              <span className="text-gray-500">Created on {new Date(tenant.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Edit Tenant
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="h-5 w-5 inline mr-2" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-5 w-5 inline mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'modules'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Zap className="h-5 w-5 inline mr-2" />
            Modules
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'activity'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-5 w-5 inline mr-2" />
            Activity
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="ml-2 text-sm font-medium text-blue-900">Users</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-blue-900">{stats.userCount}</p>
              <p className="text-sm text-blue-700">of {tenant.max_users} available seats</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Package className="h-5 w-5 text-green-500" />
                <span className="ml-2 text-sm font-medium text-green-900">Products</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-900">{stats.productCount}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ClipboardList className="h-5 w-5 text-purple-500" />
                <span className="ml-2 text-sm font-medium text-purple-900">Orders</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-purple-900">{stats.orderCount}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Receipt className="h-5 w-5 text-orange-500" />
                <span className="ml-2 text-sm font-medium text-orange-900">Invoices</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-orange-900">{stats.invoiceCount}</p>
            </div>
          </div>

          {/* Tenant Details */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Tenant Details</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tenant ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{tenant.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{tenant.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Subscription Plan</dt>
                  <dd className="mt-1 text-sm text-gray-900 capitalize">{tenant.subscription_plan}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">User Seats</dt>
                  <dd className="mt-1 text-sm text-gray-900">{tenant.max_users}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">{new Date(tenant.created_at).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Enabled Modules */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Enabled Modules</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: 'presales_delivery', label: 'Presales & Delivery' },
                  { name: 'van_sales', label: 'Van Sales' },
                  { name: 'wms', label: 'Warehouse Management' }
                ].map((module) => {
                  const isEnabled = getModuleStatus(module.name as TenantModule['module_name']);
                  return (
                    <div key={module.name} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      {isEnabled ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                      <span className={`text-sm font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                        {module.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <TenantUserManagement 
          tenant={tenant} 
          onRefresh={() => fetchTenantStats(tenant.id)} 
        />
      )}

      {activeTab === 'modules' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Module Management</h3>
            <p className="text-sm text-gray-500 mb-6">
              Enable or disable modules for this tenant. Changes take effect immediately.
            </p>
            
            <div className="space-y-4">
              {[
                { 
                  name: 'presales_delivery', 
                  label: 'Presales & Delivery', 
                  description: 'Customer visit management, delivery tracking, and route planning' 
                },
                { 
                  name: 'van_sales', 
                  label: 'Van Sales', 
                  description: 'Mobile inventory management and on-the-go sales' 
                },
                { 
                  name: 'wms', 
                  label: 'Warehouse Management', 
                  description: 'Inventory tracking, stock transfers, and barcode scanning' 
                }
              ].map((module) => {
                const isEnabled = getModuleStatus(module.name as TenantModule['module_name']);
                return (
                  <div key={module.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{module.label}</h4>
                      <p className="text-sm text-gray-500">{module.description}</p>
                    </div>
                    <div className="flex items-center">
                      <span className="mr-3 text-sm text-gray-500">
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleModuleStatus(module.name as TenantModule['module_name'], isEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <UserActivityLogViewer 
          showFilters={true}
          showExport={true}
          limit={100}
        />
      )}

      {/* Edit Tenant Modal */}
      <TenantModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tenant={tenant}
        onSuccess={() => {
          fetchTenantDetails(tenant.id);
          setIsEditModalOpen(false);
        }}
      />
    </div>
  );
}