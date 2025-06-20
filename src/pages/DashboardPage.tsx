import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Users,
  Package,
  ClipboardList,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { ModuleAccessWrapper } from '../components/ModuleAccessWrapper';
import { useModuleAccess } from '../hooks/useModuleAccess';
import type { Order, Product, Customer, Invoice, Delivery } from '../types/database';

interface DashboardMetrics {
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  totalRevenue: number;
  recentOrders: Order[];
  lowStockProducts: Product[];
  topCustomers: Customer[];
  overdueInvoices: Invoice[];
  activeDeliveries: number;
  completedDeliveries: number;
}

function StatCard({ title, value, icon: Icon, trend }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center">
              {trend.isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value}% from last month
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-indigo-50 rounded-full">
          <Icon className="h-6 w-6 text-indigo-600" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalRevenue: 0,
    recentOrders: [],
    lowStockProducts: [],
    topCustomers: [],
    overdueInvoices: [],
    activeDeliveries: 0,
    completedDeliveries: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasModule } = useModuleAccess();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [
        ordersResponse,
        customersResponse,
        productsResponse,
        invoicesResponse,
        deliveriesResponse,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('customers')
          .select('*'),
        supabase
          .from('products')
          .select('*')
          .lt('stock_quantity', 10)
          .order('stock_quantity')
          .limit(5),
        supabase
          .from('invoices')
          .select('*')
          .eq('status', 'overdue')
          .limit(5),
        // Only fetch deliveries if the module is enabled
        hasModule('presales_delivery') || hasModule('van_sales') ? 
          supabase
            .from('deliveries')
            .select('*')
            .in('status', ['out_for_delivery', 'delivered']) :
          Promise.resolve({ data: [], error: null })
      ]);

      if (ordersResponse.error) throw ordersResponse.error;
      if (customersResponse.error) throw customersResponse.error;
      if (productsResponse.error) throw productsResponse.error;
      if (invoicesResponse.error) throw invoicesResponse.error;
      if (deliveriesResponse.error) throw deliveriesResponse.error;

      const totalRevenue = (ordersResponse.data || [])
        .reduce((sum, order) => sum + order.total_amount, 0);

      const deliveries = deliveriesResponse.data || [];
      const activeDeliveries = deliveries.filter(d => d.status === 'out_for_delivery').length;
      const completedDeliveries = deliveries.filter(d => d.status === 'delivered').length;

      setMetrics({
        totalOrders: ordersResponse.data?.length || 0,
        totalCustomers: customersResponse.data?.length || 0,
        totalProducts: productsResponse.data?.length || 0,
        totalRevenue,
        recentOrders: ordersResponse.data || [],
        lowStockProducts: productsResponse.data || [],
        topCustomers: customersResponse.data || [],
        overdueInvoices: invoicesResponse.data || [],
        activeDeliveries,
        completedDeliveries,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={metrics.totalOrders}
          icon={ClipboardList}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Customers"
          value={metrics.totalCustomers}
          icon={Users}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Total Products"
          value={metrics.totalProducts}
          icon={Package}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Delivery metrics - only show if delivery modules are enabled */}
      <ModuleAccessWrapper requiredModules={['presales_delivery', 'van_sales']}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <StatCard
            title="Active Deliveries"
            value={metrics.activeDeliveries}
            icon={Truck}
            trend={{ value: 3, isPositive: true }}
          />
          <StatCard
            title="Completed Deliveries"
            value={metrics.completedDeliveries}
            icon={Package}
            trend={{ value: 7, isPositive: true }}
          />
        </div>
      </ModuleAccessWrapper>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
            <div className="mt-4">
              {metrics.recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent orders</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${order.total_amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900">Low Stock Products</h3>
            <div className="mt-4">
              {metrics.lowStockProducts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">All products are well stocked</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.lowStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {product.stock_quantity} left
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Module-specific alerts */}
      <ModuleAccessWrapper 
        requiredModules={['presales_delivery', 'van_sales']}
        fallback={
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Delivery Module Not Enabled
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Enable the delivery module to access delivery management features and tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        {metrics.activeDeliveries > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Truck className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Active Deliveries
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You have {metrics.activeDeliveries} deliveries currently out for delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModuleAccessWrapper>
    </div>
  );
}