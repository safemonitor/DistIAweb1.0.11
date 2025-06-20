import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  Users, 
  Plus,
  Truck,
  BarChart3,
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VanInventoryManager } from '../components/VanInventoryManager';
import { VanOrderCreator } from '../components/VanOrderCreator';
import { VanStockMovements } from '../components/VanStockMovements';
import { VanSalesMetrics } from '../components/VanSalesMetrics';
import type { VanInventory, VanStockMovement, Order, Customer, Product } from '../types/database';

export function VanSalesPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'movements'>('dashboard');
  const [vanInventory, setVanInventory] = useState<VanInventory[]>([]);
  const [recentMovements, setRecentMovements] = useState<VanStockMovement[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVanSalesData();
  }, []);

  async function fetchVanSalesData() {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch van inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('van_inventories')
        .select(`
          *,
          product:products (*)
        `)
        .eq('profile_id', user.id);

      if (inventoryError) throw inventoryError;

      // Fetch recent stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('van_stock_movements')
        .select(`
          *,
          product:products (*)
        `)
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (movementsError) throw movementsError;

      // Fetch recent orders (van sales)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (customersError) throw customersError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      setVanInventory(inventoryData || []);
      setRecentMovements(movementsData || []);
      setRecentOrders(ordersData || []);
      setCustomers(customersData || []);
      setProducts(productsData || []);

    } catch (err) {
      console.error('Error fetching van sales data:', err);
      setError('Failed to load van sales data');
    } finally {
      setIsLoading(false);
    }
  }

  const totalInventoryValue = vanInventory.reduce((sum, item) => 
    sum + (item.quantity * (item.product?.price || 0)), 0
  );

  const totalInventoryItems = vanInventory.reduce((sum, item) => sum + item.quantity, 0);

  const lowStockItems = vanInventory.filter(item => item.quantity <= 5);

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
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Van Sales</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your mobile inventory and create orders on the go
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
            { id: 'inventory', name: 'Van Inventory', icon: Package },
            { id: 'orders', name: 'Create Order', icon: ShoppingBag },
            { id: 'movements', name: 'Stock Movements', icon: ArrowUpDown },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    ${totalInventoryValue.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {totalInventoryItems}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {lowStockItems.length}
                  </p>
                </div>
                <div className="p-3 bg-red-50 rounded-full">
                  <Package className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Recent Orders</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {recentOrders.length}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Van Sales Metrics */}
          <VanSalesMetrics />

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setActiveTab('orders')}
                className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">Create Order</span>
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Package className="h-5 w-5 mr-2 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">Manage Inventory</span>
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Truck className="h-5 w-5 mr-2 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">Load/Unload Stock</span>
              </button>
              <button className="flex items-center justify-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Users className="h-5 w-5 mr-2 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">View Customers</span>
              </button>
            </div>
          </div>

          {/* Current Van Inventory Summary */}
          {vanInventory.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Van Inventory</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vanInventory.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.quantity <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${item.product?.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${(item.quantity * (item.product?.price || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vanInventory.length > 5 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                  >
                    View all {vanInventory.length} items →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <VanInventoryManager 
          inventory={vanInventory}
          products={products}
          onInventoryUpdate={fetchVanSalesData}
        />
      )}

      {activeTab === 'orders' && (
        <VanOrderCreator 
          customers={customers}
          vanInventory={vanInventory}
          onOrderCreated={fetchVanSalesData}
        />
      )}

      {activeTab === 'movements' && (
        <VanStockMovements 
          movements={recentMovements}
          products={products}
          onMovementCreated={fetchVanSalesData}
        />
      )}
    </div>
  );
}