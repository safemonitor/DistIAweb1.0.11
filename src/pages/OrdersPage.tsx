import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OrderModal } from '../components/OrderModal';
import { InvoiceModal } from '../components/InvoiceModal';
import { DeliveryAssignmentModal } from '../components/DeliveryAssignmentModal';
import type { Order, Profile } from '../types/database';
import { useParams } from 'react-router-dom';

interface OrdersPageProps {
  moduleType?: 'presales' | 'sales' | 'delivery';
}

export function OrdersPage({ moduleType = 'presales' }: OrdersPageProps) {
  const { reportType } = useParams<{ reportType?: string }>();
  const effectiveModuleType = reportType || moduleType;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryStaff, setDeliveryStaff] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | undefined>();

  useEffect(() => {
    fetchOrders();
    fetchDeliveryStaff();
  }, [effectiveModuleType]);

  async function fetchOrders() {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Apply module-specific filters
      if (effectiveModuleType === 'presales') {
        // Presales orders are pending orders
        query = query.eq('status', 'pending');
      } else if (effectiveModuleType === 'sales') {
        // Sales orders are completed orders
        query = query.eq('status', 'completed');
      } else if (effectiveModuleType === 'delivery') {
        // Delivery orders are pending orders that need to be delivered
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      setError('Failed to fetch orders');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchDeliveryStaff() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'delivery');

      if (error) throw error;
      setDeliveryStaff(data || []);
    } catch (err) {
      console.error('Error fetching delivery staff:', err);
    }
  }

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  const handleDelete = async (order: Order) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (orderError) throw orderError;

      await fetchOrders();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete order');
    }
  };

  const handleGenerateInvoice = (order: Order) => {
    setSelectedOrder(order);
    setIsInvoiceModalOpen(true);
  };

  const handleAssignDelivery = (order: Order) => {
    setSelectedOrder(order);
    setIsDeliveryModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedOrder(undefined);
    setIsOrderModalOpen(true);
  };

  const getModuleTitle = () => {
    switch (effectiveModuleType) {
      case 'presales':
        return 'Presales Orders';
      case 'sales':
        return 'Sales Orders';
      case 'delivery':
        return 'Delivery Orders';
      default:
        return 'Orders';
    }
  };

  const getModuleDescription = () => {
    switch (effectiveModuleType) {
      case 'presales':
        return 'Manage pending orders from presales activities';
      case 'sales':
        return 'View and manage completed sales orders';
      case 'delivery':
        return 'Manage orders ready for delivery';
      default:
        return 'A list of all orders including their status, total amount, and order date';
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
          <h1 className="text-2xl font-semibold text-gray-900">{getModuleTitle()}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {getModuleDescription()}
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={handleAddNew}
            className="flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Order
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
                      Order ID
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Customer
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Total Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No orders found. Click "Create Order" to get started.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {order.id.substring(0, 8)}...
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(order.order_date).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {order.customer_id.substring(0, 8)}...
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          ${order.total_amount.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            order.status === 'completed'
                              ? 'bg-green-50 text-green-700'
                              : order.status === 'cancelled'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          {effectiveModuleType === 'delivery' && (
                            <button
                              type="button"
                              onClick={() => handleAssignDelivery(order)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              <Truck className="h-4 w-4" />
                              <span className="sr-only">Assign Delivery</span>
                            </button>
                          )}
                          
                          {effectiveModuleType === 'sales' && (
                            <button
                              type="button"
                              onClick={() => handleGenerateInvoice(order)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="sr-only">Generate Invoice</span>
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => handleEdit(order)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDelete(order)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        order={selectedOrder}
        onSuccess={fetchOrders}
      />

      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        order={selectedOrder}
        onSuccess={() => {
          fetchOrders();
          setIsInvoiceModalOpen(false);
        }}
      />

      <DeliveryAssignmentModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        order={selectedOrder}
        deliveryStaff={deliveryStaff}
        onSuccess={() => {
          fetchOrders();
          setIsDeliveryModalOpen(false);
        }}
      />
    </div>
  );
}