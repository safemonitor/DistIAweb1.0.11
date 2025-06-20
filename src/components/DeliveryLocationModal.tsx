import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types/database';

interface DeliveryLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery;
  onSuccess: () => void;
}

export function DeliveryLocationModal({
  isOpen,
  onClose,
  delivery,
  onSuccess
}: DeliveryLocationModalProps) {
  const [coordinates, setCoordinates] = useState({
    latitude: delivery.latitude || 0,
    longitude: delivery.longitude || 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCoordinates({
      latitude: delivery.latitude || 0,
      longitude: delivery.longitude || 0
    });
  }, [delivery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        })
        .eq('id', delivery.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to update delivery location');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Delivery Location"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">
            Latitude
          </label>
          <input
            type="number"
            id="latitude"
            step="any"
            value={coordinates.latitude}
            onChange={(e) => setCoordinates(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">
            Longitude
          </label>
          <input
            type="number"
            id="longitude"
            step="any"
            value={coordinates.longitude}
            onChange={(e) => setCoordinates(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
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