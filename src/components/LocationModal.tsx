import { useState } from 'react';
import { Building, MapPin, FileText, ToggleLeft, ToggleRight, CreditCard } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Location } from '../types/database';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: Location;
  onSuccess: () => void;
}

export function LocationModal({ isOpen, onClose, location, onSuccess }: LocationModalProps) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    description: location?.description || '',
    location_type: location?.location_type || 'warehouse',
    address: location?.address || '',
    is_active: location?.is_active ?? true,
    immatriculation: location?.immatriculation || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
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

      if (location) {
        const { error } = await supabase
          .from('locations')
          .update(formData)
          .eq('id', location.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('locations')
          .insert([{
            ...formData,
            tenant_id: tenant_id // Ensure tenant_id is set
          }]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save location');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const locationTypes = [
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'store', label: 'Store' },
    { value: 'van', label: 'Van' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'customer', label: 'Customer' },
  ];

  // Show immatriculation field only for vans
  const showImmatriculation = formData.location_type === 'van';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={location ? 'Edit Location' : 'Add Location'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            <Building className="h-4 w-4 inline mr-2" />
            Location Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="location_type" className="block text-sm font-medium text-gray-700 mb-2">
            Location Type
          </label>
          <select
            id="location_type"
            name="location_type"
            value={formData.location_type}
            onChange={handleChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {locationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {showImmatriculation && (
          <div>
            <label htmlFor="immatriculation" className="block text-sm font-medium text-gray-700 mb-2">
              <CreditCard className="h-4 w-4 inline mr-2" />
              Immatriculation
            </label>
            <input
              type="text"
              id="immatriculation"
              name="immatriculation"
              value={formData.immatriculation}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Vehicle registration number"
            />
          </div>
        )}

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            <FileText className="h-4 w-4 inline mr-2" />
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Optional description of the location..."
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="h-4 w-4 inline mr-2" />
            Address
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={2}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Physical address of the location..."
          />
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="is_active" className="block text-sm font-medium text-gray-700">
            Active Status
          </label>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              formData.is_active ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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