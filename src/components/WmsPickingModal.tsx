import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Plus, Minus, Package, Warehouse, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WmsPicking, WmsPickingItem, WmsWarehouse, WmsLocation, WmsProduct, WmsInventory } from '../types/database';

interface WmsPickingModalProps {
  isOpen: boolean;
  onClose: () => void;
  picking?: WmsPicking;
  warehouses: WmsWarehouse[];
  locations: WmsLocation[];
  products: WmsProduct[];
  inventory: WmsInventory[];
  onSuccess: () => void;
}

interface PickingItemForm {
  id?: string;
  product_id: string;
  location_id: string;
  requested_quantity: number;
  picked_quantity?: number;
  lot_number?: string;
}

export function WmsPickingModal({ 
  isOpen, 
  onClose, 
  picking, 
  warehouses, 
  locations, 
  products, 
  inventory,
  onSuccess 
}: WmsPickingModalProps) {
  const [formData, setFormData] = useState({
    reference_number: picking?.reference_number || `PCK-${Date.now().toString(36).toUpperCase()}`,
    warehouse_id: picking?.warehouse_id || '',
    status: picking?.status || 'pending',
  });
  
  const [pickingItems, setPickingItems] = useState<PickingItemForm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picking && picking.picking_items) {
      setPickingItems(
        picking.picking_items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          location_id: item.location_id,
          requested_quantity: item.requested_quantity,
          picked_quantity: item.picked_quantity,
          lot_number: item.lot_number,
        }))
      );
    } else {
      setPickingItems([]);
    }
  }, [picking]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addPickingItem = () => {
    if (products.length === 0 || locations.length === 0) return;
    
    // Find locations in the selected warehouse
    const warehouseLocations = locations.filter(l => l.warehouse_id === formData.warehouse_id);
    if (warehouseLocations.length === 0) {
      setError('No locations available in the selected warehouse');
      return;
    }
    
    const firstProduct = products[0];
    const firstLocation = warehouseLocations[0];
    
    setPickingItems([
      ...pickingItems,
      {
        product_id: firstProduct.id,
        location_id: firstLocation.id,
        requested_quantity: 1,
        picked_quantity: 0,
        lot_number: '',
      },
    ]);
  };

  const removePickingItem = (index: number) => {
    setPickingItems(pickingItems.filter((_, i) => i !== index));
  };

  const updatePickingItem = (index: number, field: keyof PickingItemForm, value: any) => {
    const newItems = [...pickingItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setPickingItems(newItems);
  };

  const getAvailableQuantity = (productId: string, locationId: string) => {
    const inventoryItem = inventory.find(
      item => item.product_id === productId && item.location_id === locationId
    );
    return inventoryItem ? inventoryItem.quantity : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pickingItems.length === 0) {
      setError('Please add at least one item to pick');
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

      if (picking) {
        // Update existing picking
        const { error: pickingError } = await supabase
          .from('wms_picking')
          .update({
            reference_number: formData.reference_number,
            warehouse_id: formData.warehouse_id,
            status: formData.status,
            picked_by: formData.status === 'completed' ? wmsUserId : null,
            picked_at: formData.status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', picking.id);

        if (pickingError) throw pickingError;

        // Update or insert picking items
        for (const item of pickingItems) {
          if (item.id) {
            // Update existing item
            const { error: itemError } = await supabase
              .from('wms_picking_items')
              .update({
                product_id: item.product_id,
                location_id: item.location_id,
                requested_quantity: item.requested_quantity,
                picked_quantity: item.picked_quantity,
                lot_number: item.lot_number,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id);

            if (itemError) throw itemError;
          } else {
            // Insert new item
            const { error: itemError } = await supabase
              .from('wms_picking_items')
              .insert([{
                picking_id: picking.id,
                product_id: item.product_id,
                location_id: item.location_id,
                requested_quantity: item.requested_quantity,
                picked_quantity: item.picked_quantity,
                lot_number: item.lot_number
              }]);

            if (itemError) throw itemError;
          }
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of pickingItems) {
            if (!item.picked_quantity || item.picked_quantity <= 0) continue;

            // Get the inventory record
            const { data: inventoryItem, error: inventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', item.location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (inventoryError) throw inventoryError;

            if (!inventoryItem) {
              throw new Error(`No inventory found for product at the specified location`);
            }

            if (inventoryItem.quantity < item.picked_quantity) {
              throw new Error(`Not enough inventory for product at the specified location`);
            }

            // Update inventory
            const { error: updateError } = await supabase
              .from('wms_inventory')
              .update({
                quantity: inventoryItem.quantity - item.picked_quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', inventoryItem.id);

            if (updateError) throw updateError;
          }
        }
      } else {
        // Create new picking
        const { data: newPicking, error: pickingError } = await supabase
          .from('wms_picking')
          .insert([{
            reference_number: formData.reference_number,
            warehouse_id: formData.warehouse_id,
            status: formData.status,
            picked_by: formData.status === 'completed' ? wmsUserId : null,
            picked_at: formData.status === 'completed' ? new Date().toISOString() : null
          }])
          .select()
          .single();

        if (pickingError || !newPicking) throw pickingError;

        // Insert picking items
        for (const item of pickingItems) {
          const { error: itemError } = await supabase
            .from('wms_picking_items')
            .insert([{
              picking_id: newPicking.id,
              product_id: item.product_id,
              location_id: item.location_id,
              requested_quantity: item.requested_quantity,
              picked_quantity: item.picked_quantity,
              lot_number: item.lot_number
            }]);

          if (itemError) throw itemError;
        }

        // If status is completed, update inventory
        if (formData.status === 'completed') {
          for (const item of pickingItems) {
            if (!item.picked_quantity || item.picked_quantity <= 0) continue;

            // Get the inventory record
            const { data: inventoryItem, error: inventoryError } = await supabase
              .from('wms_inventory')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('location_id', item.location_id)
              .eq('lot_number', item.lot_number || null)
              .maybeSingle();

            if (inventoryError) throw inventoryError;

            if (!inventoryItem) {
              throw new Error(`No inventory found for product at the specified location`);
            }

            if (inventoryItem.quantity < item.picked_quantity) {
              throw new Error(`Not enough inventory for product at the specified location`);
            }

            // Update inventory
            const { error: updateError } = await supabase
              .from('wms_inventory')
              .update({
                quantity: inventoryItem.quantity - item.picked_quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', inventoryItem.id);

            if (updateError) throw updateError;
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving picking:', err);
      setError(err instanceof Error ? err.message : 'Failed to save picking');
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
      title={picking ? 'Process Picking' : 'Create Picking'}
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
              Items to Pick
            </label>
            <button
              type="button"
              onClick={addPickingItem}
              disabled={!formData.warehouse_id || warehouseLocations.length === 0}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {pickingItems.map((item, index) => {
              const availableQuantity = getAvailableQuantity(item.product_id, item.location_id);
              const product = products.find(p => p.id === item.product_id);
              const location = locations.find(l => l.id === item.location_id);
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Product
                      </label>
                      <select
                        value={item.product_id}
                        onChange={(e) => updatePickingItem(index, 'product_id', e.target.value)}
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
                        Location
                      </label>
                      <select
                        value={item.location_id}
                        onChange={(e) => updatePickingItem(index, 'location_id', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
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
                        Requested Quantity
                      </label>
                      <input
                        type="number"
                        value={item.requested_quantity}
                        onChange={(e) => updatePickingItem(index, 'requested_quantity', parseInt(e.target.value) || 0)}
                        min="1"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                    </div>

                    {(formData.status === 'in_progress' || formData.status === 'completed') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Picked Quantity
                        </label>
                        <input
                          type="number"
                          value={item.picked_quantity || 0}
                          onChange={(e) => updatePickingItem(index, 'picked_quantity', parseInt(e.target.value) || 0)}
                          min="0"
                          max={availableQuantity}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required={formData.status === 'completed'}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Available: {availableQuantity} {product?.unit || 'units'}
                        </p>
                      </div>
                    )}
                  </div>

                  {(formData.status === 'in_progress' || formData.status === 'completed') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Lot Number
                      </label>
                      <input
                        type="text"
                        value={item.lot_number || ''}
                        onChange={(e) => updatePickingItem(index, 'lot_number', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removePickingItem(index)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            {pickingItems.length === 0 && (
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
            disabled={isLoading || pickingItems.length === 0}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : picking ? 'Update Picking' : 'Create Picking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}