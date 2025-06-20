import { useState } from 'react';
import { Package, MapPin, Hash, FileText, User } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Location, Product } from '../types/database';

interface InventoryTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  products: Product[];
  onSuccess: () => void;
}

export function InventoryTransactionModal({ 
  isOpen, 
  onClose, 
  locations, 
  products, 
  onSuccess 
}: InventoryTransactionModalProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    transaction_type: 'in',
    quantity: 0,
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const { error } = await supabase
        .from('inventory_transactions')
        .insert([{
          ...formData,
          performed_by: user.id,
          tenant_id: tenant_id, // Add tenant_id to the transaction
        }]);

      if (error) throw error;

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        product_id: '',
        location_id: '',
        transaction_type: 'in',
        quantity: 0,
        notes: '',
      });
    } catch (err) {
      setError('Failed to create transaction');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const transactionTypes = [
    { value: 'in', label: 'Stock In', description: 'Add inventory to location' },
    { value: 'out', label: 'Stock Out', description: 'Remove inventory from location' },
    { value: 'adjustment', label: 'Adjustment', description: 'Correct inventory discrepancies' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Adjustment"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="location_id" className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="h-4 w-4 inline mr-2" />
            Location
          </label>
          <select
            id="location_id"
            name="location_id"
            value={formData.location_id}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Select a location</option>
            {locations.filter(l => l.is_active).map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.location_type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 mb-2">
            <Package className="h-4 w-4 inline mr-2" />
            Product
          </label>
          <select
            id="product_id"
            name="product_id"
            value={formData.product_id}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku}) - ${product.price}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="transaction_type" className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type
          </label>
          <select
            id="transaction_type"
            name="transaction_type"
            value={formData.transaction_type}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {transactionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label} - {type.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
            <Hash className="h-4 w-4 inline mr-2" />
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            {formData.transaction_type === 'out' 
              ? 'Quantity to remove from inventory'
              : formData.transaction_type === 'adjustment'
              ? 'Positive for increase, negative for decrease'
              : 'Quantity to add to inventory'
            }
          </p>
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
            placeholder="Optional notes about this transaction..."
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
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Create Transaction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}