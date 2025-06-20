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
  Filter,
  User,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VanInventoryManager } from '../components/VanInventoryManager';
import { VanOrderCreator } from '../components/VanOrderCreator';
import { VanStockMovements } from '../components/VanStockMovements';
import { VanSalesMetrics } from '../components/VanSalesMetrics';
import type { VanInventory, VanStockMovement, Order, Customer, Product, Profile, Location } from '../types/database';

export function SalesPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'movements'>('dashboard');
  const [vanInventory, setVanInventory] = useState<VanInventory[]>([]);
  const [recentMovements, setRecentMovements] = useState<VanStockMovement[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesAgents, setSalesAgents] = useState<Profile[]>([]);
  const [trucks, setTrucks] = useState<Location[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAgentSelectorOpen, setIsAgentSelectorOpen] = useState(false);

  useEffect(() => {
    fetchSalesAgentsAndTrucks();
    fetchCustomersAndProducts();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentData(selectedAgentId);
    }
  }, [selectedAgentId]);

  async function fetchSalesAgentsAndTrucks() {
    try {
      setIsLoading(true);
      
      // Fetch sales agents (profiles with sales role)
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'sales');

      if (agentsError) throw agentsError;
      setSalesAgents(agentsData || []);

      // If there are agents, select the first one by default
      if (agentsData && agentsData.length > 0) {
        setSelectedAgentId(agentsData[0].id);
      }

      // Fetch trucks (locations with van type)
      const { data: trucksData, error: trucksError } = await supabase
        .from('locations')
        .select('*')
        .eq('location_type', 'van')
        .eq('is_active', true);

      if (trucksError) throw trucksError;
      setTrucks(trucksData || []);

      // If there are trucks, select the first one by default
      if (trucksData && trucksData.length > 0) {
        setSelectedTruckId(trucksData[0].id);
      }
    } catch (err) {
      console.error('Error fetching sales agents and trucks:', err);
      setError('Failed to load sales agents and trucks');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCustomersAndProducts() {
    try {
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (customersError) throw customersError;
      setCustomers(customersData || []);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (err) {
      console.error('Error fetching customers and products:', err);
      setError('Failed to load customers and products');
    }
  }

  async function fetchAgentData(agentId: string) {
    try {
      setIsLoading(true);
      
      // Fetch van inventory for the selected agent
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('van_inventories')
        .select(`
          *,
          product:products (*)
        `)
        .eq('profile_id', agentId);

      if (inventoryError) throw inventoryError;

      // Fetch recent stock movements for the selected agent
      const { data: movementsData, error: movementsError } = await supabase
        .from('van_stock_movements')
        .select(`
          *,
          product:products (*)
        `)
        .eq('profile_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (movementsError) throw movementsError;

      // Fetch recent orders for the selected agent
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      setVanInventory(inventoryData || []);
      setRecentMovements(movementsData || []);
      setRecentOrders(ordersData || []);
    } catch (err) {
      console.error('Error fetching agent data:', err);
      setError('Failed to load agent data');
    } finally {
      setIsLoading(false);
    }
  }

  const totalInventoryValue = vanInventory.reduce((sum, item) => 
    sum + (item.quantity * (item.product?.price || 0)), 0
  );

  const totalInventoryItems = vanInventory.reduce((sum, item) => sum + item.quantity, 0);

  const lowStockItems = vanInventory.filter(item => item.quantity <= 5);

  const selectedAgent = salesAgents.find(agent => agent.id === selectedAgentId);
  const selectedTruck = trucks.find(truck => truck.id === selectedTruckId);

  if (isLoading && !selectedAgentId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error && !selectedAgentId) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Agent/Truck Selector */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage mobile inventory and create orders on the go
          </p>
        </div>
        
        {/* Agent and Truck Selector */}
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <button
              onClick={() => setIsAgentSelectorOpen(!isAgentSelectorOpen)}
              className="inline-flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <div className="flex items-center">
                <User className="h-5 w-5 text-gray-400 mr-2" />
                <span>
                  {selectedAgent 
                    ? `${selectedAgent.first_name} ${selectedAgent.last_name}`
                    : 'Select Agent'}
                </span>
              </div>
              <ChevronDown className="h-5 w-5 text-gray-400 ml-2" />
            </button>
            
            {isAgentSelectorOpen && (
              <div className="absolute right-0 mt-2 w-full bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <div className="py-1">
                  {salesAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setIsAgentSelectorOpen(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        selectedAgentId === agent.id
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {agent.first_name} {agent.last_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <select
            value={selectedTruckId}
            onChange={(e) => setSelectedTruckId(e.target.value)}
            className="block w-full sm:w-auto rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Truck</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agent/Truck Info Card */}
      {selectedAgent && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-medium text-gray-900">
                  {selectedAgent.first_name} {selectedAgent.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  Sales Agent • {selectedAgent.id.substring(0, 8)}
                </p>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-0">
              <div className="flex items-center">
                <Truck className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {selectedTruck ? selectedTruck.name : 'No truck selected'}
                </span>
              </div>
              {selectedTruck && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedTruck.address || 'No address available'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Agent Selected Warning */}
      {!selectedAgentId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No Agent Selected</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please select a sales agent to view their inventory and sales data.</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                disabled={!selectedAgentId}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } ${!selectedAgentId ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {selectedAgentId ? (
        <>
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
              onInventoryUpdate={() => fetchAgentData(selectedAgentId)}
            />
          )}

          {activeTab === 'orders' && (
            <VanOrderCreator 
              customers={customers}
              vanInventory={vanInventory}
              onOrderCreated={() => fetchAgentData(selectedAgentId)}
            />
          )}

          {activeTab === 'movements' && (
            <VanStockMovements 
              movements={recentMovements}
              products={products}
              onMovementCreated={() => fetchAgentData(selectedAgentId)}
            />
          )}
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Agent Selected</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Please select a sales agent from the dropdown above to view their inventory and sales data.
          </p>
        </div>
      )}
    </div>
  );
}