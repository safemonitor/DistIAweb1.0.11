import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Plus, Minus, Package, Building, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupplierOrder, SupplierOrderItem, Location, Product } from '../types/database';

interface SupplierOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: SupplierOrder;
  locations: Location[];
  products: Product[];
  onSuccess: () => void;
}

export function SupplierOrderModal({ 
  isOpen, 
  onClose, 
  order, 
  locations, 
  products, 
  onSuccess 
}: SupplierOrderModalProps) {
  const [formData, setFormData] = useState({
    supplier_name: order?.supplier_name || '',
    order_number: order?.order_number || '',
    order_date: order?.order_date ? new Date(order.order_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    expected_date: order?.expected_date ? new Date(order.expected_date).toISOString().split('T')[0] : '',
    receiving_location_id: order?.receiving_location_id || '',
    status: order?.status || 'pending',
    notes: order?.notes || '',
  });
  
  const [orderItems, setOrderItems] = useState<(Omit<SupplierOrderItem, 'id' | 'order_id' | 'created_at'> & { product_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order && order.order_items) {
      setOrderItems(
        order.order_items.map(item => ({
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown Product',
          quantity: item.quantity,
          received_quantity: item.received_quantity,
          unit_price: item.unit_price,
        }))
      );
    } else {
      setOrderItems([]);
    }
  }, [order]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addOrderItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setOrderItems([
      ...orderItems,
      {
        product_id: firstProduct.id,
        product_name: firstProduct.name,
        quantity: 1,
        received_quantity: 0,
        unit_price: firstProduct.price,
      },
    ]);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: value,
          product_name: product.name,
          unit_price: product.price,
        };
      }
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    
    setOrderItems(newItems);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      setError('Please add at least one item to the order');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the user's tenant_id
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;

      const total_amount = calculateTotal();
      
      if (order) {
        // Update existing order
        const { error: orderError } = await supabase
          .from('supplier_orders')
          .update({ 
            ...formData,
            total_amount,
          })
          .eq('id', order.id);
        
        if (orderError) throw orderError;

        // Delete existing order items
        const { error: deleteError } = await supabase
          .from('supplier_order_items')
          .delete()
          .eq('order_id', order.id);
        
        if (deleteError) throw deleteError;
        
        // Insert new order items
        const { error: itemsError } = await supabase
          .from('supplier_order_items')
          .insert(
            orderItems.map(item => ({
              order_id: order.id,
              product_id: item.product_id,
              quantity: item.quantity,
              received_quantity: item.received_quantity,
              unit_price: item.unit_price,
              tenant_id: tenant_id, // Add tenant_id to order items
            }))
          );
        
        if (itemsError) throw itemsError;
      } else {
        // Create new order
        const { data: newOrder, error: orderError } = await supabase
          .from('supplier_orders')
          .insert([{ 
            ...formData,
            total_amount,
            created_by: user.id,
            tenant_id: tenant_id, // Ensure tenant_id is set
          }])
          .select()
          .single();
        
        if (orderError || !newOrder) throw orderError;
        
        // Insert new order items
        const { error: itemsError } = await supabase
          .from('supplier_order_items')
          .insert(
            orderItems.map(item => ({
              order_id: newOrder.id,
              product_id: item.product_id,
              quantity: item.quantity,
              received_quantity: 0, // New orders have no received items
              unit_price: item.unit_price,
              tenant_id: tenant_id, // Add tenant_id to order items
            }))
          );
        
        if (itemsError) throw itemsError;
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
      title={order ? 'Edit Supplier Order' : 'Create Supplier Order'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="supplier_name" className="block text-sm font-medium text-gray-700">
              Supplier Name
            </label>
            <input
              type="text"
              id="supplier_name"
              name="supplier_name"
              value={formData.supplier_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="order_number" className="block text-sm font-medium text-gray-700">
              Order Number
            </label>
            <input
              type="text"
              id="order_number"
              name="order_number"
              value={formData.order_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="order_date" className="block text-sm font-medium text-gray-700">
              Order Date
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                id="order_date"
                name="order_date"
                value={formData.order_date}
                onChange={handleChange}
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="expected_date" className="block text-sm font-medium text-gray-700">
              Expected Delivery Date
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                id="expected_date"
                name="expected_date"
                value={formData.expected_date}
                onChange={handleChange}
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="receiving_location_id" className="block text-sm font-medium text-gray-700">
              Receiving Location
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building className="h-4 w-4 text-gray-400" />
              </div>
              <select
                id="receiving_location_id"
                name="receiving_location_id"
                value={formData.receiving_location_id}
                onChange={handleChange}
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select a location</option>
                {locations
                  .filter(location => location.is_active && location.location_type === 'warehouse')
                  .map(location => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="partial">Partially Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Optional notes about this order"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Order Items
            </label>
            <button
              type="button"
              onClick={addOrderItem}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {orderItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start border rounded-md p-2">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (${product.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    min="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Qty"
                    required
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Price"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeOrderItem(index)}
                  className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                >
                  <Minus className="h-4 w-4" />
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