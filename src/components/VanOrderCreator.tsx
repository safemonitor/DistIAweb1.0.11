import { useState, useEffect } from 'react';
import { Plus, Minus, ShoppingCart, User, Package, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Customer, VanInventory, Product, Profile, Location } from '../types/database';

interface VanOrderCreatorProps {
  customers: Customer[];
  vanInventory: VanInventory[];
  selectedAgentId?: string;
  selectedTruckId?: string;
  onAgentChange?: (agentId: string) => void;
  onTruckChange?: (truckId: string) => void;
  onOrderCreated: () => void;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  available_stock: number;
}

export function VanOrderCreator({ 
  customers, 
  vanInventory, 
  selectedAgentId = '',
  selectedTruckId = '',
  onAgentChange,
  onTruckChange,
  onOrderCreated 
}: VanOrderCreatorProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError('Failed to load agents and trucks');
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

  const addOrderItem = (inventoryItem: VanInventory) => {
    if (!inventoryItem.product) return;

    const existingItem = orderItems.find(item => item.product_id === inventoryItem.product_id);
    
    if (existingItem) {
      if (existingItem.quantity < inventoryItem.quantity) {
        setOrderItems(prev => 
          prev.map(item => 
            item.product_id === inventoryItem.product_id 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      }
    } else {
      if (inventoryItem.quantity > 0) {
        setOrderItems(prev => [...prev, {
          product_id: inventoryItem.product_id,
          product_name: inventoryItem.product.name,
          quantity: 1,
          unit_price: inventoryItem.product.price,
          available_stock: inventoryItem.quantity
        }]);
      }
    }
  };

  const updateOrderItemQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.product_id !== productId));
    } else {
      setOrderItems(prev => 
        prev.map(item => 
          item.product_id === productId 
            ? { ...item, quantity: Math.min(newQuantity, item.available_stock) }
            : item
        )
      );
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || orderItems.length === 0) {
      setError('Please select a customer and add at least one item');
      return;
    }

    if (!agentId) {
      setError('Please select a sales agent');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const totalAmount = calculateTotal();

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: selectedCustomer,
          total_amount: totalAmount,
          status: 'completed' // Van sales are typically completed immediately
        })
        .select()
        .single();

      if (orderError || !order) throw orderError;

      // Create order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          orderItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          }))
        );

      if (itemsError) throw itemsError;

      // Create stock movements for each item sold
      const stockMovements = orderItems.map(item => ({
        profile_id: agentId,
        product_id: item.product_id,
        movement_type: 'sale' as const,
        quantity: item.quantity,
        reference_order_id: order.id,
        notes: `Sale to customer: ${customers.find(c => c.id === selectedCustomer)?.name}${truckId ? ` from truck ${trucks.find(t => t.id === truckId)?.name || truckId}` : ''}`
      }));

      const { error: movementsError } = await supabase
        .from('van_stock_movements')
        .insert(stockMovements);

      if (movementsError) throw movementsError;

      // Reset form
      setSelectedCustomer('');
      setOrderItems([]);
      onOrderCreated();

      alert(`Order created successfully! Order total: $${totalAmount.toFixed(2)}`);

    } catch (err) {
      console.error('Error creating order:', err);
      setError('Failed to create order');
    } finally {
      setIsLoading(false);
    }
  };

  const availableProducts = vanInventory.filter(item => item.quantity > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Create Van Sales Order</h2>
        <p className="mt-1 text-sm text-gray-600">
          Create orders using your van inventory
        </p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Select Customer
          </h3>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Choose a customer...</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} - {customer.email}
              </option>
            ))}
          </select>
        </div>

        {/* Product Selection */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Available Products
          </h3>
          
          {availableProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No products available in van inventory. Please load stock first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableProducts.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      {item.product?.name}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {item.quantity} available
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    ${item.product?.price.toFixed(2)} each
                  </p>
                  <button
                    type="button"
                    onClick={() => addOrderItem(item)}
                    disabled={item.quantity === 0}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add to Order
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Items */}
        {orderItems.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Order Items
            </h3>
            
            <div className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {item.product_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      ${item.unit_price.toFixed(2)} each • {item.available_stock} available
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => updateOrderItemQuantity(item.product_id, item.quantity - 1)}
                        className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateOrderItemQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="inline-flex items-center p-1 border border-transparent rounded-full text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !selectedCustomer || orderItems.length === 0 || !agentId}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating Order...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}