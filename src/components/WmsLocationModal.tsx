import { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { WmsLocation, WmsWarehouse } from '../types/database';

interface WmsLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: WmsLocation;
  warehouses: WmsWarehouse[];
  onSuccess: () => void;
}

export function WmsLocationModal({ 
  isOpen, 
  onClose, 
  location, 
  warehouses,
  onSuccess 
}: WmsLocationModalProps) {
  const [formData, setFormData] = useState({
    parent_location_id: location?.parent_location_id || '',
    zone: location?.zone || '',
    aisle: location?.aisle || '',
    shelf: location?.shelf || '',
    position: location?.position || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      if (location) {
        // Update existing location
        const { error } = await supabase
          .from('wms_locations')
          .update({
            parent_location_id: formData.parent_location_id,
            zone: formData.zone,
            aisle: formData.aisle,
            shelf: formData.shelf,
            position: formData.position,
            updated_at: new Date().toISOString()
          })
          .eq('id', location.id);

        if (error) throw error;
      } else {
        // Create new location
        const { error } = await supabase
          .from('wms_locations')
          .insert([{
            parent_location_id: formData.parent_location_id,
            zone: formData.zone,
            aisle: formData.aisle,
            shelf: formData.shelf,
            position: formData.position
          }]);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving location:', err);
      setError('Failed to save location');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={location ? 'Edit Location' : 'Add Location'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="parent_location_id" className="block text-sm font-medium text-gray-700">
            Parent Location
          </label>
          <select
            id="parent_location_id"
            name="parent_location_id"
            value={formData.parent_location_id}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Select a parent location</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="zone" className="block text-sm font-medium text-gray-700">
              Zone
            </label>
            <input
              type="text"
              id="zone"
              name="zone"
              value={formData.zone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="aisle" className="block text-sm font-medium text-gray-700">
              Aisle
            </label>
            <input
              type="text"
              id="aisle"
              name="aisle"
              value={formData.aisle}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="shelf" className="block text-sm font-medium text-gray-700">
              Shelf
            </label>
            <input
              type="text"
              id="shelf"
              name="shelf"
              value={formData.shelf}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700">
              Position
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
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
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : location ? 'Update Location' : 'Create Location'}
          </button>
        </div>
      </form>
    </Modal>
  );
}