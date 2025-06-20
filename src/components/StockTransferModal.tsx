import { useState, useEffect } from 'react';
import { ArrowRightLeft, MapPin, Package, Plus, Minus, FileText } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { StockTransfer, Location, Product } from '../types/database';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: StockTransfer;
  locations: Location[];
  products: Product[];
  onSuccess: () => void;
}

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export function StockTransferModal({ 
  isOpen, 
  onClose, 
  transfer, 
  locations, 
  products, 
  onSuccess 
}: StockTransferModalProps) {
  const [formData, setFormData] = useState({
    from_location_id: transfer?.from_location_id || '',
    to_location_id: transfer?.to_location_id || '',
    notes: transfer?.notes || '',
    status: transfer?.status || 'pending',
  });
  
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transfer && transfer.transfer_items) {
      setTransferItems(
        transfer.transfer_items.map(item => ({
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown',
          quantity: item.quantity,
        }))
      );
    } else {
      setTransferItems([]);
    }
  }, [transfer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addTransferItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setTransferItems([
      ...transferItems,
      {
        product_id: firstProduct.id,
        product_name: firstProduct.name,
        quantity: 1,
      },
    ]);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const updateTransferItem = (index: number, field: keyof TransferItem, value: any) => {
    const newItems = [...transferItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
      }
    }
    
    setTransferItems(newItems);
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

      // Get the user's tenant_id
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;

      if (transfer) {
        // Update existing transfer
        const { error: transferError } = await supabase
          .from('stock_transfers')
          .update({
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            notes: formData.notes,
            status: formData.status,
          })
          .eq('id', transfer.id);

        if (transferError) throw transferError;

        // Delete existing transfer items
        const { error: deleteError } = await supabase
          .from('stock_transfer_items')
          .delete()
          .eq('transfer_id', transfer.id);

        if (deleteError) throw deleteError;

        // Insert updated transfer items
        const { error: itemsError } = await supabase
          .from('stock_transfer_items')
          .insert(
            transferItems.map(item => ({
              transfer_id: transfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
              tenant_id: tenant_id, // Add tenant_id to transfer items
            }))
          );

        if (itemsError) throw itemsError;
      } else {
        // Create new transfer
        const { data: newTransfer, error: transferError } = await supabase
          .from('stock_transfers')
          .insert([{
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            notes: formData.notes,
            status: formData.status,
            created_by: user.id,
            tenant_id: tenant_id, // Ensure tenant_id is set
          }])
          .select()
          .single();

        if (transferError || !newTransfer) throw transferError;

        // Insert transfer items
        const { error: itemsError } = await supabase
          .from('stock_transfer_items')
          .insert(
            transferItems.map(item => ({
              transfer_id: newTransfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
              tenant_id: tenant_id, // Add tenant_id to transfer items
            }))
          );

        if (itemsError) throw itemsError;
      }

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        from_location_id: '',
        to_location_id: '',
        notes: '',
        status: 'pending',
      });
      setTransferItems([]);
    } catch (err) {
      setError('Failed to save transfer');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeLocations = locations.filter(l => l.is_active);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transfer ? 'Edit Stock Transfer' : 'Create Stock Transfer'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="from_location_id" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="h-4 w-4 inline mr-2" />
              From Location
            </label>
            <select
              id="from_location_id"
              name="from_location_id"
              value={formData.from_location_id}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select source location</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.location_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="to_location_id" className="block text-sm font-medium text-gray-700 mb-2">
              <ArrowRightLeft className="h-4 w-4 inline mr-2" />
              To Location
            </label>
            <select
              id="to_location_id"
              name="to_location_id"
              value={formData.to_location_id}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select destination location</option>
              {activeLocations
                .filter(l => l.id !== formData.from_location_id)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.location_type})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {transfer && (
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              <Package className="h-4 w-4 inline mr-2" />
              Transfer Items
            </label>
            <button
              type="button"
              onClick={addTransferItem}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {transferItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start border rounded-md p-2">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateTransferItem(index, 'product_id', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    min="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTransferItem(index)}
                  className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 inline mr-2" />
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Optional notes about this transfer..."
          />
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
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : transfer ? 'Update Transfer' : 'Create Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}