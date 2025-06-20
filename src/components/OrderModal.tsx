import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Product, Order, OrderItem, Customer } from '../types/database';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
  onSuccess: () => void;
}

interface OrderItemForm extends Omit<OrderItem, 'id' | 'order_id'> {
  productName: string;
}

export function OrderModal({ isOpen, onClose, order, onSuccess }: OrderModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([]);
  const [status, setStatus] = useState<Order['status']>(order?.status || 'pending');
  const [customerId, setCustomerId] = useState(order?.customer_id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    if (order) {
      fetchOrderItems();
    }
  }, [order]);

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }

  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }

  async function fetchOrderItems() {
    if (!order) return;
    
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            name
          )
        `)
        .eq('order_id', order.id);
      
      if (error) throw error;
      
      setOrderItems(
        data.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          productName: item.products.name,
        }))
      );
    } catch (err) {
      console.error('Error fetching order items:', err);
    }
  }

  const addOrderItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setOrderItems([
      ...orderItems,
      {
        product_id: firstProduct.id,
        quantity: 1,
        unit_price: firstProduct.price,
        productName: firstProduct.name,
      },
    ]);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: keyof OrderItemForm, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = product.price;
        newItems[index].productName = product.name;
      }
    }
    
    setOrderItems(newItems);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const total_amount = calculateTotal();
      
      // Get the user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;
      
      if (order) {
        // Update existing order
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            customer_id: customerId,
            total_amount,
            status,
          })
          .eq('id', order.id);
        
        if (orderError) throw orderError;

        // Delete existing order items
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', order.id);
        
        if (deleteError) throw deleteError;
        
        // Insert new order items
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(
            orderItems.map(item => ({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tenant_id: tenant_id, // Add tenant_id to order items
            }))
          );
        
        if (itemsError) throw itemsError;
        
        // Log activity
        await logActivity(ActivityTypes.ORDER_UPDATED, {
          order_id: order.id,
          customer_id: customerId,
          total_amount,
          status,
          items_count: orderItems.length
        });
      } else {
        // Create new order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert([{ 
            customer_id: customerId,
            total_amount,
            status,
            tenant_id: tenant_id, // Ensure tenant_id is set
          }])
          .select()
          .single();
        
        if (orderError || !newOrder) throw orderError;
        
        // Insert new order items
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(
            orderItems.map(item => ({
              order_id: newOrder.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tenant_id: tenant_id, // Add tenant_id to order items
            }))
          );
        
        if (itemsError) throw itemsError;
        
        // Log activity
        await logActivity(ActivityTypes.ORDER_CREATED, {
          order_id: newOrder.id,
          customer_id: customerId,
          total_amount,
          status,
          items_count: orderItems.length
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save order');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? 'Edit Order' : 'Create Order'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700">
            Customer
          </label>
          <select
            id="customer_id"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Select a customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Order['status'])}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Order Items
            </label>
            <button
              type="button"
              onClick={addOrderItem}
              disabled={products.length === 0}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Item
            </button>
          </div>
          
          {products.length === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md mb-3">
              No products available. Please add products before creating an order.
            </div>
          )}
          
          <div className="space-y-2">
            {orderItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start border rounded-md p-2">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (${product.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value))}
                    min="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOrderItem(index)}
                  className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          
          {orderItems.length > 0 && (
            <div className="mt-2 text-right text-sm font-medium text-gray-900">
              Total: ${calculateTotal().toFixed(2)}
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isLoading || orderItems.length === 0}
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
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