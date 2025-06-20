import { useState, useEffect } from 'react';
import { Package, Plus, Minus, Search, AlertTriangle, User, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { VanInventory, Product, Profile, Location } from '../types/database';

interface VanInventoryManagerProps {
  inventory: VanInventory[];
  products: Product[];
  selectedAgentId?: string;
  selectedTruckId?: string;
  onAgentChange?: (agentId: string) => void;
  onTruckChange?: (truckId: string) => void;
  onInventoryUpdate: () => void;
}

export function VanInventoryManager({ 
  inventory, 
  products, 
  selectedAgentId = '',
  selectedTruckId = '',
  onAgentChange,
  onTruckChange,
  onInventoryUpdate 
}: VanInventoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [salesAgents, setSalesAgents] = useState<Profile[]>([]);
  const [trucks, setTrucks] = useState<Location[]>([]);
  const [agentId, setAgentId] = useState(selectedAgentId);
  const [truckId, setTruckId] = useState(selectedTruckId);

  useEffect(() => {
    if (!selectedAgentId || !selectedTruckId) {
      fetchAgentsAndTrucks();
    }
  }, [selectedAgentId, selectedTruckId]);

  // Update local state when props change
  useEffect(() => {
    setAgentId(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    setTruckId(selectedTruckId);
  }, [selectedTruckId]);

  async function fetchAgentsAndTrucks() {
    try {
      // Fetch sales agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'sales');

      if (agentsError) throw agentsError;
      setSalesAgents(agentsData || []);

      // Fetch trucks (locations with van type)
      const { data: trucksData, error: trucksError } = await supabase
        .from('locations')
        .select('*')
        .eq('location_type', 'van')
        .eq('is_active', true);

      if (trucksError) throw trucksError;
      setTrucks(trucksData || []);
    } catch (err) {
      console.error('Error fetching agents and trucks:', err);
    }
  }

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentId = e.target.value;
    setAgentId(newAgentId);
    if (onAgentChange) {
      onAgentChange(newAgentId);
    }
  };

  const handleTruckChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTruckId = e.target.value;
    setTruckId(newTruckId);
    if (onTruckChange) {
      onTruckChange(newTruckId);
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product?.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const adjustStock = async (inventoryItem: VanInventory, adjustment: number) => {
    if (!agentId) {
      alert('Please select a sales agent first');
      return;
    }

    if (inventoryItem.quantity + adjustment < 0) {
      alert('Cannot reduce stock below zero');
      return;
    }

    setIsLoading(true);
    try {
      // Create stock movement record
      const { error: movementError } = await supabase
        .from('van_stock_movements')
        .insert({
          profile_id: agentId,
          product_id: inventoryItem.product_id,
          movement_type: 'adjustment',
          quantity: adjustment,
          notes: `Manual adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}${truckId ? ` for truck ${trucks.find(t => t.id === truckId)?.name || truckId}` : ''}`
        });

      if (movementError) throw movementError;

      onInventoryUpdate();
    } catch (err) {
      console.error('Error adjusting stock:', err);
      alert('Failed to adjust stock');
    } finally {
      setIsLoading(false);
    }
  };

  const lowStockItems = filteredInventory.filter(item => item.quantity <= 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Van Inventory Management</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage your mobile stock and make adjustments
          </p>
        </div>
      </div>

      {/* Agent and Truck Selection (if not provided via props) */}
      {(!selectedAgentId || !selectedTruckId) && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Agent and Truck</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent_select" className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-2" />
                Sales Agent
              </label>
              <select
                id="agent_select"
                value={agentId}
                onChange={handleAgentChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select an agent</option>
                {salesAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="truck_select" className="block text-sm font-medium text-gray-700 mb-1">
                <Truck className="h-4 w-4 inline mr-2" />
                Truck/Van
              </label>
              <select
                id="truck_select"
                value={truckId}
                onChange={handleTruckChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        />
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Low Stock Alert
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  You have {lowStockItems.length} item(s) with low stock (≤5 units).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm ? 'No products found matching your search.' : 'No inventory items found. Load stock to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className={item.quantity <= 5 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Package className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.product?.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.product?.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.product?.sku}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.quantity <= 5 
                            ? 'bg-red-100 text-red-800' 
                            : item.quantity <= 10 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {item.quantity} units
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${item.product?.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${(item.quantity * (item.product?.price || 0)).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => adjustStock(item, -1)}
                            disabled={isLoading || item.quantity <= 0 || !agentId}
                            className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-gray-900 min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => adjustStock(item, 1)}
                            disabled={isLoading || !agentId}
                            className="inline-flex items-center p-1 border border-transparent rounded-full text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {filteredInventory.length}
            </div>
            <div className="text-sm text-gray-500">Product Types</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {filteredInventory.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Units</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              ${filteredInventory.reduce((sum, item) => sum + (item.quantity * (item.product?.price || 0)), 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">Total Value</div>
          </div>
        </div>
      </div>
    </div>
  );
}