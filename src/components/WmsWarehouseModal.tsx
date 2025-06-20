import { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { WmsWarehouse } from '../types/database';

interface WmsWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse?: WmsWarehouse;
  onSuccess: () => void;
}

export function WmsWarehouseModal({ 
  isOpen, 
  onClose, 
  warehouse, 
  onSuccess 
}: WmsWarehouseModalProps) {
  const [formData, setFormData] = useState({
    name: warehouse?.name || '',
    address: warehouse?.address || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (warehouse) {
        // Update existing warehouse
        const { error } = await supabase
          .from('wms_warehouses')
          .update({
            name: formData.name,
            address: formData.address,
            updated_at: new Date().toISOString()
          })
          .eq('id', warehouse.id);

        if (error) throw error;
      } else {
        // Create new warehouse
        const { error } = await supabase
          .from('wms_warehouses')
          .insert([{
            name: formData.name,
            address: formData.address
          }]);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving warehouse:', err);
      setError('Failed to save warehouse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={warehouse ? 'Edit Warehouse' : 'Add Warehouse'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Warehouse Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
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
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : warehouse ? 'Update Warehouse' : 'Create Warehouse'}
          </button>
        </div>
      </form>
    </Modal>
  );
}