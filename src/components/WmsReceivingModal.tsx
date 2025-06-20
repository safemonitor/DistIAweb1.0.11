import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Plus, Minus, Package, Warehouse, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WmsReceiving, WmsReceivingItem, WmsWarehouse, WmsLocation, WmsProduct } from '../types/database';

interface WmsReceivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiving?: WmsReceiving;
  warehouses: WmsWarehouse[];
  locations: WmsLocation[];
  products: WmsProduct[];
  onSuccess: () => void;
}

interface ReceivingItemForm {
  id?: string;
  product_id: string;
  expected_quantity: number;
  received_quantity?: number;
  lot_number?: string;
  expiration_date?: string;
  location_id?: string;
}

export function WmsReceivingModal({ 
  isOpen, 
  onClose, 
  receiving, 
  warehouses, 
  locations, 
  products, 
  onSuccess 
}: WmsReceivingModalProps) {
  const [formData, setFormData] = useState({
    reference_number: receiving?.reference_number || `RCV-${Date.now().toString(36).toUpperCase()}`,
    warehouse_id: receiving?.warehouse_id || '',
    status: receiving?.status || 'pending',
  });
  
  const [receivingItems, setReceivingItems] = useState<ReceivingItemForm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (receiving && receiving.receiving_items) {
      setReceivingItems(
        receiving.receiving_items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          expected_quantity: item.expected_quantity,
          received_quantity: item.received_quantity,
          lot_number: item.lot_number,
          expiration_date: item.expiration_date,
          location_id: item.location_id,
        }))
      );
    } else {
      setReceivingItems([]);
    }
  }, [receiving]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addReceivingItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setReceivingItems([
      ...receivingItems,
      {
        product_id: firstProduct.id,
        expected_quantity: 1,
        received_quantity: 0,
        lot_number: '',
        expiration_date: '',
        location_id: '',
      },
    ]);
  };

  const removeReceivingItem = (index: number) => {
    setReceivingItems(receivingItems.filter((_, i) => i !== index));
  };

  const updateReceivingItem = (index: number, field: keyof ReceivingItemForm, value: any) => {
    const newItems = [...receivingItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceivingItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (receivingItems.length === 0) {
      setError('Please add at least one item to receive');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the WMS user ID
      const { data: wmsUserData, error: wmsUserError } = await supabase
        .from('wms_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (wmsUserError) {
        console.error('Error getting WMS user:', wmsUserError);
        throw new Error('You are not registered as a WMS user');
      }

      const wmsUserId = wmsUserData.id;

      if (receiving) {
        // Update existing receiving
        const { error: receivingError } = await supabase
          .from('wms_receiving')
          .update({
            reference_number: formData.reference_number,
            warehouse_id: formData.warehouse_id,
            status: formData.status,
            received_by: formData.status === 'completed' ? wmsUserId : null,
            received_at: formData.status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', receiving.id);

        if (receivingError) throw receivingError;

        // Update or insert receiving items
        for (const item of receivingItems) {
          if (item.id) {
            // Update existing item
            const { error: itemError } = await supabase
              .from('wms_receiving_items')
              .update({
                product_id: item.product_id,
                expected_quantity: item.expected_quantity,
                received_quantity: item.received_quantity,
                lot_number: item.lot_number,
                expiration_date: item.expiration_date,
                location_id: item.location_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            if (itemError) throw itemError;
          } else {
            // Insert new item
            const { error: itemError } = await supabase
              .from('wms_receiving_items')
              .insert([{
                receiving_id: receiving.id,
                product_id: item.product_id,
                expected_quantity: item.expected_quantity,
                received_quantity: item.received_quantity,
                lot_number: item.lot_number,
                expiration_date: item.expiration_date,
                location_id: item.location_id
              }]);

            if (itemError) throw itemError;
          }
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of receivingItems) {
            if (!item.received_quantity || !item.location_id) continue;

            // Check if inventory record exists
            const { data: existingInventory, error: inventoryCheckError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', item.location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (inventoryCheckError) throw inventoryCheckError;

            if (existingInventory) {
              // Update existing inventory
              const { error: updateError } = await supabase
                .from('wms_inventory')
                .update({
                  quantity: existingInventory.quantity + item.received_quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingInventory.id);

              if (updateError) throw updateError;
            } else {
              // Create new inventory record
              const { error: insertError } = await supabase
                .from('wms_inventory')
                .insert([{
                  product_id: item.product_id,
                  location_id: item.location_id,
                  quantity: item.received_quantity,
                  lot_number: item.lot_number || null,
                  expiration_date: item.expiration_date || null
                }]);

              if (insertError) throw insertError;
            }
          }
        }
      } else {
        // Create new receiving
        const { data: newReceiving, error: receivingError } = await supabase
          .from('wms_receiving')
          .insert([{
            reference_number: formData.reference_number,
            warehouse_id: formData.warehouse_id,
            status: formData.status,
            received_by: formData.status === 'completed' ? wmsUserId : null,
            received_at: formData.status === 'completed' ? new Date().toISOString() : null
          }])
          .select()
          .single();

        if (receivingError || !newReceiving) throw receivingError;

        // Insert receiving items
        for (const item of receivingItems) {
          const { error: itemError } = await supabase
            .from('wms_receiving_items')
            .insert([{
              receiving_id: newReceiving.id,
              product_id: item.product_id,
              expected_quantity: item.expected_quantity,
              received_quantity: item.received_quantity,
              lot_number: item.lot_number,
              expiration_date: item.expiration_date,
              location_id: item.location_id
            }]);

          if (itemError) throw itemError;
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of receivingItems) {
            if (!item.received_quantity || !item.location_id) continue;

            // Check if inventory record exists
            const { data: existingInventory, error: inventoryCheckError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', item.location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (inventoryCheckError) throw inventoryCheckError;

            if (existingInventory) {
              // Update existing inventory
              const { error: updateError } = await supabase
                .from('wms_inventory')
                .update({
                  quantity: existingInventory.quantity + item.received_quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingInventory.id);

              if (updateError) throw updateError;
            } else {
              // Create new inventory record
              const { error: insertError } = await supabase
                .from('wms_inventory')
                .insert([{
                  product_id: item.product_id,
                  location_id: item.location_id,
                  quantity: item.received_quantity,
                  lot_number: item.lot_number || null,
                  expiration_date: item.expiration_date || null
                }]);

              if (insertError) throw insertError;
            }
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving receiving:', err);
      setError('Failed to save receiving');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter locations by selected warehouse
  const warehouseLocations = locations.filter(
    location => location.warehouse_id === formData.warehouse_id
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={receiving ? 'Process Receiving' : 'Create Receiving'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reference_number" className="block text-sm font-medium text-gray-700">
              Reference Number
            </label>
            <input
              type="text"
              id="reference_number"
              name="reference_number"
              value={formData.reference_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="warehouse_id" className="block text-sm font-medium text-gray-700">
              Warehouse
            </label>
            <select
              id="warehouse_id"
              name="warehouse_id"
              value={formData.warehouse_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select a warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
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
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Items to Receive
            </label>
            <button
              type="button"
              onClick={addReceivingItem}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {receivingItems.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Product
                    </label>
                    <select
                      value={item.product_id}
                      onChange={(e) => updateReceivingItem(index, 'product_id', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">Select a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Expected Quantity
                    </label>
                    <input
                      type="number"
                      value={item.expected_quantity}
                      onChange={(e) => updateReceivingItem(index, 'expected_quantity', parseInt(e.target.value) || 0)}
                      min="1"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>

                {(formData.status === 'in_progress' || formData.status === 'completed') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Received Quantity
                        </label>
                        <input
                          type="number"
                          value={item.received_quantity || 0}
                          onChange={(e) => updateReceivingItem(index, 'received_quantity', parseInt(e.target.value) || 0)}
                          min="0"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required={formData.status === 'completed'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Location
                        </label>
                        <select
                          value={item.location_id || ''}
                          onChange={(e) => updateReceivingItem(index, 'location_id', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required={formData.status === 'completed'}
                        >
                          <option value="">Select a location</option>
                          {warehouseLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.zone}-{location.aisle}-{location.shelf}-{location.position}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Lot Number
                        </label>
                        <input
                          type="text"
                          value={item.lot_number || ''}
                          onChange={(e) => updateReceivingItem(index, 'lot_number', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Expiration Date
                        </label>
                        <input
                          type="date"
                          value={item.expiration_date || ''}
                          onChange={(e) => updateReceivingItem(index, 'expiration_date', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeReceivingItem(index)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {receivingItems.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
                No items added yet. Click "Add Item" to start.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || receivingItems.length === 0}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : receiving ? 'Update Receiving' : 'Create Receiving'}
          </button>
        </div>
      </form>
    </Modal>
  );
}