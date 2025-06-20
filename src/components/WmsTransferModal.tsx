import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Plus, Minus, Package, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WmsTransfer, WmsTransferItem, WmsLocation, WmsProduct, WmsInventory } from '../types/database';

interface WmsTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: WmsTransfer;
  locations: WmsLocation[];
  products: WmsProduct[];
  onSuccess: () => void;
}

interface TransferItemForm {
  id?: string;
  product_id: string;
  quantity: number;
  lot_number?: string;
}

export function WmsTransferModal({ 
  isOpen, 
  onClose, 
  transfer, 
  locations, 
  products, 
  onSuccess 
}: WmsTransferModalProps) {
  const [formData, setFormData] = useState({
    reference_number: transfer?.reference_number || `TRF-${Date.now().toString(36).toUpperCase()}`,
    from_location_id: transfer?.from_location_id || '',
    to_location_id: transfer?.to_location_id || '',
    status: transfer?.status || 'pending',
  });
  
  const [transferItems, setTransferItems] = useState<TransferItemForm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<WmsInventory[]>([]);

  useEffect(() => {
    if (transfer && transfer.transfer_items) {
      setTransferItems(
        transfer.transfer_items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          lot_number: item.lot_number,
        }))
      );
    } else {
      setTransferItems([]);
    }

    // Fetch inventory for the selected from_location
    if (formData.from_location_id) {
      fetchInventoryForLocation(formData.from_location_id);
    }
  }, [transfer, formData.from_location_id]);

  const fetchInventoryForLocation = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('wms_inventory')
        .select(`
          *,
          product:wms_products (*)
        `)
        .eq('location_id', locationId);

      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory for the selected location');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addTransferItem = () => {
    if (products.length === 0) return;
    
    // Find products that have inventory in the from_location
    const availableProducts = inventory
      .filter(inv => inv.quantity > 0)
      .map(inv => inv.product_id);
    
    if (availableProducts.length === 0) {
      setError('No products with inventory available in the selected location');
      return;
    }
    
    // Use the first available product
    const firstProductId = availableProducts[0];
    const firstProduct = products.find(p => p.id === firstProductId);
    
    if (!firstProduct) {
      setError('Product not found');
      return;
    }
    
    setTransferItems([
      ...transferItems,
      {
        product_id: firstProduct.id,
        quantity: 1,
        lot_number: '',
      },
    ]);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const updateTransferItem = (index: number, field: keyof TransferItemForm, value: any) => {
    const newItems = [...transferItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setTransferItems(newItems);
  };

  const getAvailableQuantity = (productId: string) => {
    const inventoryItem = inventory.find(item => item.product_id === productId);
    return inventoryItem ? inventoryItem.quantity : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0) {
      setError('Please add at least one item to transfer');
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

      // Validate inventory availability
      for (const item of transferItems) {
        const availableQty = getAvailableQuantity(item.product_id);
        if (item.quantity > availableQty) {
          const product = products.find(p => p.id === item.product_id);
          throw new Error(`Not enough inventory for ${product?.name || 'product'} (requested: ${item.quantity}, available: ${availableQty})`);
        }
      }

      if (transfer) {
        // Update existing transfer
        const { error: transferError } = await supabase
          .from('wms_transfers')
          .update({
            reference_number: formData.reference_number,
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            status: formData.status,
            completed_by: formData.status === 'completed' ? wmsUserId : null,
            completed_at: formData.status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', transfer.id);

        if (transferError) throw transferError;

        // Update or insert transfer items
        for (const item of transferItems) {
          if (item.id) {
            // Update existing item
            const { error: itemError } = await supabase
              .from('wms_transfer_items')
              .update({
                product_id: item.product_id,
                quantity: item.quantity,
                lot_number: item.lot_number,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            if (itemError) throw itemError;
          } else {
            // Insert new item
            const { error: itemError } = await supabase
              .from('wms_transfer_items')
              .insert([{
                transfer_id: transfer.id,
                product_id: item.product_id,
                quantity: item.quantity,
                lot_number: item.lot_number
              }]);

            if (itemError) throw itemError;
          }
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of transferItems) {
            // Reduce inventory in from_location
            const { data: fromInventory, error: fromInventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', formData.from_location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (fromInventoryError) throw fromInventoryError;

            if (!fromInventory) {
              throw new Error(`No inventory found for product at the source location`);
            }

            if (fromInventory.quantity < item.quantity) {
              throw new Error(`Not enough inventory for product at the source location`);
            }

            const { error: updateFromError } = await supabase
              .from('wms_inventory')
              .update({
                quantity: fromInventory.quantity - item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', fromInventory.id);

            if (updateFromError) throw updateFromError;

            // Increase inventory in to_location
            const { data: toInventory, error: toInventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', formData.to_location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (toInventoryError) throw toInventoryError;

            if (toInventory) {
              // Update existing inventory
              const { error: updateToError } = await supabase
                .from('wms_inventory')
                .update({
                  quantity: toInventory.quantity + item.quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', toInventory.id);

              if (updateToError) throw updateToError;
            } else {
              // Create new inventory record
              const { error: insertError } = await supabase
                .from('wms_inventory')
                .insert([{
                  product_id: item.product_id,
                  location_id: formData.to_location_id,
                  quantity: item.quantity,
                  lot_number: item.lot_number || null,
                  expiration_date: fromInventory.expiration_date
                }]);

              if (insertError) throw insertError;
            }
          }
        }
      } else {
        // Create new transfer
        const { data: newTransfer, error: transferError } = await supabase
          .from('wms_transfers')
          .insert([{
            reference_number: formData.reference_number,
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            status: formData.status,
            initiated_by: wmsUserId,
            completed_by: formData.status === 'completed' ? wmsUserId : null,
            completed_at: formData.status === 'completed' ? new Date().toISOString() : null
          }])
          .select()
          .single();

        if (transferError || !newTransfer) throw transferError;

        // Insert transfer items
        for (const item of transferItems) {
          const { error: itemError } = await supabase
            .from('wms_transfer_items')
            .insert([{
              transfer_id: newTransfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
              lot_number: item.lot_number
            }]);

          if (itemError) throw itemError;
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of transferItems) {
            // Reduce inventory in from_location
            const { data: fromInventory, error: fromInventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', formData.from_location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (fromInventoryError) throw fromInventoryError;

            if (!fromInventory) {
              throw new Error(`No inventory found for product at the source location`);
            }

            if (fromInventory.quantity < item.quantity) {
              throw new Error(`Not enough inventory for product at the source location`);
            }

            const { error: updateFromError } = await supabase
              .from('wms_inventory')
              .update({
                quantity: fromInventory.quantity - item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', fromInventory.id);

            if (updateFromError) throw updateFromError;

            // Increase inventory in to_location
            const { data: toInventory, error: toInventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', formData.to_location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (toInventoryError) throw toInventoryError;

            if (toInventory) {
              // Update existing inventory
              const { error: updateToError } = await supabase
                .from('wms_inventory')
                .update({
                  quantity: toInventory.quantity + item.quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', toInventory.id);

              if (updateToError) throw updateToError;
            } else {
              // Create new inventory record
              const { error: insertError } = await supabase
                .from('wms_inventory')
                .insert([{
                  product_id: item.product_id,
                  location_id: formData.to_location_id,
                  quantity: item.quantity,
                  lot_number: item.lot_number || null,
                  expiration_date: fromInventory.expiration_date
                }]);

              if (insertError) throw insertError;
            }
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving transfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to save transfer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transfer ? 'Process Transfer' : 'Create Transfer'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="from_location_id" className="block text-sm font-medium text-gray-700">
              From Location
            </label>
            <select
              id="from_location_id"
              name="from_location_id"
              value={formData.from_location_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select source location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.warehouse?.name} / {location.zone}-{location.aisle}-{location.shelf}-{location.position}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="to_location_id" className="block text-sm font-medium text-gray-700">
              To Location
            </label>
            <select
              id="to_location_id"
              name="to_location_id"
              value={formData.to_location_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select destination location</option>
              {locations
                .filter(l => l.id !== formData.from_location_id)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.warehouse?.name} / {location.zone}-{location.aisle}-{location.shelf}-{location.position}
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
              Items to Transfer
            </label>
            <button
              type="button"
              onClick={addTransferItem}
              disabled={!formData.from_location_id || inventory.length === 0}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {transferItems.map((item, index) => {
              const availableQty = getAvailableQuantity(item.product_id);
              const product = products.find(p => p.id === item.product_id);
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Product
                      </label>
                      <select
                        value={item.product_id}
                        onChange={(e) => updateTransferItem(index, 'product_id', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => {
                          const inventoryItem = inventory.find(inv => inv.product_id === product.id);
                          const availableQty = inventoryItem ? inventoryItem.quantity : 0;
                          return (
                            <option key={product.id} value={product.id} disabled={availableQty <= 0}>
                              {product.name} ({product.sku}) - {availableQty} available
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        max={availableQty}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Available: {availableQty} {product?.unit || 'units'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Lot Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={item.lot_number || ''}
                      onChange={(e) => updateTransferItem(index, 'lot_number', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeTransferItem(index)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            {transferItems.length === 0 && (
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
            disabled={isLoading || transferItems.length === 0}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : transfer ? 'Update Transfer' : 'Create Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}