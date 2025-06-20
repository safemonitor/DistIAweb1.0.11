import { useState } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Invoice, Order } from '../types/database';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: Order;
  invoice?: Invoice;
  onSuccess: () => void;
}

export function InvoiceModal({ isOpen, onClose, order, invoice, onSuccess }: InvoiceModalProps) {
  const [dueDate, setDueDate] = useState(
    invoice?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<Invoice['status']>(invoice?.status || 'unpaid');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (invoice) {
        // Update existing invoice
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            due_date: dueDate,
            status,
          })
          .eq('id', invoice.id);

        if (updateError) throw updateError;
      } else if (order) {
        // Create new invoice
        const { error: createError } = await supabase
          .from('invoices')
          .insert([{
            order_id: order.id,
            due_date: dueDate,
            total_amount: order.total_amount,
            status,
            tenant_id: tenant_id, // Ensure tenant_id is set
          }]);

        if (createError) throw createError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save invoice');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoice ? 'Edit Invoice' : 'Generate Invoice'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
            Due Date
          </label>
          <input
            type="date"
            id="due_date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Invoice['status'])}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
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