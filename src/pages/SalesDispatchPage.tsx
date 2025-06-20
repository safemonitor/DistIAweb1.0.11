import { useState, useEffect } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  XCircle, 
  Edit, 
  Search, 
  Filter, 
  User, 
  Calendar, 
  DollarSign,
  ShoppingBag,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OrderModal } from '../components/OrderModal';
import type { Order, Profile, VanInventory, Product } from '../types/database';

export function SalesDispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesAgents, setSalesAgents] = useState<Profile[]>([]);
  const [vanInventories, setVanInventories] = useState<Record<string, VanInventory[]>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      
      // Fetch pending orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers (
            name,
            email,
            phone
          ),
          order_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch sales agents (profiles with sales role)
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'sales');

      if (agentsError) throw agentsError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*');

      if (productsError) throw productsError;

      // Fetch van inventories for all sales agents
      const agentVanInventories: Record<string, VanInventory[]> = {};
      
      for (const agent of agentsData || []) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('van_inventories')
          .select(`
            *,
            product:products (*)
          `)
          .eq('profile_id', agent.id);
          
        if (inventoryError) {
          console.error(`Error fetching inventory for agent ${agent.id}:`, inventoryError);
          continue;
        }
        
        agentVanInventories[agent.id] = inventoryData || [];
      }

      setOrders(ordersData || []);
      setSalesAgents(agentsData || []);
      setVanInventories(agentVanInventories);
      setProducts(productsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load dispatch data');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredOrders = orders.filter(order => {
    // Filter by search term
    const matchesSearch = !searchTerm || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by status
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleConfirmOrder = async (order: Order, agentId: string) => {
    if (!order || !agentId) return;
    
    setIsProcessing(true);
    
    try {
      // Check if agent has enough stock for all items
      const agentInventory = vanInventories[agentId] || [];
      const orderItems = order.order_items || [];
      
      const insufficientItems = orderItems.filter(item => {
        const inventoryItem = agentInventory.find(inv => inv.product_id === item.product_id);
        return !inventoryItem || inventoryItem.quantity < item.quantity;
      });
      
      if (insufficientItems.length > 0) {
        const missingItems = insufficientItems.map(item => 
          `${item.product?.name} (need ${item.quantity}, have ${
            agentInventory.find(inv => inv.product_id === item.product_id)?.quantity || 0
          })`
        ).join(', ');
        
        throw new Error(`Agent doesn't have enough stock for: ${missingItems}`);
      }
      
      // Update order status to completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'completed'
        })
        .eq('id', order.id);
      
      if (updateError) throw updateError;
      
      // Create stock movements for each item (deduct from agent's inventory)
      const stockMovements = orderItems.map(item => ({
        profile_id: agentId,
        product_id: item.product_id,
        movement_type: 'sale',
        quantity: -item.quantity, // Negative quantity for sales
        reference_order_id: order.id,
        notes: `Sale to customer: ${order.customer?.name}`
      }));
      
      const { error: movementsError } = await supabase
        .from('van_stock_movements')
        .insert(stockMovements);
      
      if (movementsError) throw movementsError;
      
      // Refresh data
      await fetchData();
      
      alert('Order confirmed and dispatched successfully!');
    } catch (err) {
      console.error('Error confirming order:', err);
      alert(err instanceof Error ? err.message : 'Failed to confirm order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefuseOrder = async (order: Order) => {
    if (!confirm('Are you sure you want to refuse this order?')) return;
    
    setIsProcessing(true);
    
    try {
      // Update order status to cancelled
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled'
        })
        .eq('id', order.id);
      
      if (error) throw error;
      
      // Refresh data
      await fetchData();
      
      alert('Order refused successfully');
    } catch (err) {
      console.error('Error refusing order:', err);
      alert('Failed to refuse order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  const canDispatchOrder = (order: Order, agentId: string): boolean => {
    if (!order.order_items) return false;
    
    const agentInventory = vanInventories[agentId] || [];
    
    // Check if agent has enough stock for all items
    return !order.order_items.some(item => {
      const inventoryItem = agentInventory.find(inv => inv.product_id === item.product_id);
      return !inventoryItem || inventoryItem.quantity < item.quantity;
    });
  };

  const getAgentStockStatus = (order: Order, agentId: string): { 
    canDispatch: boolean; 
    insufficientItems: { name: string; needed: number; available: number }[] 
  } => {
    if (!order.order_items) return { canDispatch: false, insufficientItems: [] };
    
    const agentInventory = vanInventories[agentId] || [];
    const insufficientItems: { name: string; needed: number; available: number }[] = [];
    
    order.order_items.forEach(item => {
      const inventoryItem = agentInventory.find(inv => inv.product_id === item.product_id);
      const available = inventoryItem?.quantity || 0;
      
      if (!inventoryItem || available < item.quantity) {
        insufficientItems.push({
          name: item.product?.name || 'Unknown product',
          needed: item.quantity,
          available
        });
      }
    });
    
    return {
      canDispatch: insufficientItems.length === 0,
      insufficientItems
    };
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
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales Dispatch</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage and dispatch sales orders to agents
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Orders
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order ID or customer..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Orders to Dispatch</h3>
          
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No orders match your current filters.' 
                  : 'There are no pending orders to dispatch.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900 flex items-center">
                        <ShoppingBag className="h-5 w-5 mr-2 text-indigo-600" />
                        Order #{order.id.substring(0, 8)}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Created on {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-md border border-gray-200">
                      <div className="flex items-center text-sm font-medium text-gray-500 mb-1">
                        <User className="h-4 w-4 mr-1" />
                        Customer
                      </div>
                      <p className="text-sm font-medium text-gray-900">{order.customer?.name}</p>
                      <p className="text-sm text-gray-500">{order.customer?.email}</p>
                      <p className="text-sm text-gray-500">{order.customer?.phone}</p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-md border border-gray-200">
                      <div className="flex items-center text-sm font-medium text-gray-500 mb-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        Order Details
                      </div>
                      <p className="text-sm text-gray-900">
                        Items: {order.order_items?.length || 0}
                      </p>
                      <p className="text-sm text-gray-900">
                        Date: {new Date(order.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-md border border-gray-200">
                      <div className="flex items-center text-sm font-medium text-gray-500 mb-1">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Financial
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        Total: ${order.total_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Order Items */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Order Items</h5>
                    <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Product
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quantity
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unit Price
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {order.order_items?.map((item) => (
                            <tr key={item.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.product?.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${item.unit_price.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${(item.quantity * item.unit_price).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Agent Selection and Dispatch */}
                  {order.status === 'pending' && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Dispatch to Agent</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {salesAgents.map((agent) => {
                          const stockStatus = getAgentStockStatus(order, agent.id);
                          
                          return (
                            <div key={agent.id} className="bg-white p-4 rounded-md border border-gray-200">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {agent.first_name} {agent.last_name}
                                  </p>
                                  <p className="text-xs text-gray-500">ID: {agent.id.substring(0, 8)}...</p>
                                </div>
                                {stockStatus.canDispatch ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Stock Available
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Insufficient Stock
                                  </span>
                                )}
                              </div>
                              
                              {!stockStatus.canDispatch && stockStatus.insufficientItems.length > 0 && (
                                <div className="mb-2 text-xs text-red-600">
                                  <p>Missing items:</p>
                                  <ul className="list-disc list-inside">
                                    {stockStatus.insufficientItems.map((item, idx) => (
                                      <li key={idx}>
                                        {item.name}: need {item.needed}, have {item.available}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              <button
                                onClick={() => handleConfirmOrder(order, agent.id)}
                                disabled={isProcessing || !stockStatus.canDispatch}
                                className="w-full mt-2 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Confirm & Dispatch
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex justify-end mt-4 space-x-3">
                        <button
                          onClick={() => handleEditOrder(order)}
                          disabled={isProcessing}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Order
                        </button>
                        <button
                          onClick={() => handleRefuseOrder(order)}
                          disabled={isProcessing}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refuse Order
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Completed Order Info */}
                  {order.status === 'completed' && (
                    <div className="bg-green-50 p-4 rounded-md border border-green-200">
                      <div className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Order Dispatched</p>
                          <p className="text-sm text-green-700">
                            This order has been confirmed and dispatched to the sales agent.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Cancelled Order Info */}
                  {order.status === 'cancelled' && (
                    <div className="bg-red-50 p-4 rounded-md border border-red-200">
                      <div className="flex items-start">
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Order Refused</p>
                          <p className="text-sm text-red-700">
                            This order has been refused and will not be dispatched.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Edit Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        order={selectedOrder}
        onSuccess={fetchData}
      />
    </div>
  );
}