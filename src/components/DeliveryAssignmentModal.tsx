import { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Order, Profile, Delivery } from '../types/database';

interface DeliveryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
  deliveryStaff: Profile[];
  onSuccess: () => void;
}

export function DeliveryAssignmentModal({
  isOpen,
  onClose,
  order,
  deliveryStaff,
  onSuccess
}: DeliveryAssignmentModalProps) {
  const [formData, setFormData] = useState({
    delivery_staff_id: '',
    route_number: '',
    estimated_delivery: '',
    delivery_notes: '',
    delivery_zone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    
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

      const { error: deliveryError } = await supabase
        .from('deliveries')
        .insert([{
          order_id: order.id,
          delivery_staff_id: formData.delivery_staff_id,
          route_number: formData.route_number,
          estimated_delivery: formData.estimated_delivery,
          delivery_notes: formData.delivery_notes,
          delivery_zone: formData.delivery_zone,
          status: 'assigned',
          tracking_number: `DEL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          tenant_id: tenant_id, // Ensure tenant_id is set
        }]);

      if (deliveryError) throw deliveryError;

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to create delivery assignment');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Delivery"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="delivery_staff_id" className="block text-sm font-medium text-gray-700">
            Delivery Staff
          </label>
          <select
            id="delivery_staff_id"
            name="delivery_staff_id"
            value={formData.delivery_staff_id}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="">Select staff member</option>
            {deliveryStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.first_name} {staff.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="route_number" className="block text-sm font-medium text-gray-700">
            Route Number
          </label>
          <input
            type="text"
            id="route_number"
            name="route_number"
            value={formData.route_number}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="delivery_zone" className="block text-sm font-medium text-gray-700">
            Delivery Zone
          </label>
          <input
            type="text"
            id="delivery_zone"
            name="delivery_zone"
            value={formData.delivery_zone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="estimated_delivery" className="block text-sm font-medium text-gray-700">
            Estimated Delivery Date
          </label>
          <input
            type="datetime-local"
            id="estimated_delivery"
            name="estimated_delivery"
            value={formData.estimated_delivery}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="delivery_notes" className="block text-sm font-medium text-gray-700">
            Delivery Notes
          </label>
          <textarea
            id="delivery_notes"
            name="delivery_notes"
            value={formData.delivery_notes}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
          >
            {isLoading ? 'Assigning...' : 'Assign Delivery'}
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