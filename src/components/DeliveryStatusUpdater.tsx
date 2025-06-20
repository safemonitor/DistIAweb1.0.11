import { useState } from 'react';
import { Clock, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types/database';

interface DeliveryStatusUpdaterProps {
  delivery: Delivery;
  onUpdate: () => void;
}

export function DeliveryStatusUpdater({ delivery, onUpdate }: DeliveryStatusUpdaterProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState('');

  const statusOptions = [
    { value: 'assigned', label: 'Assigned', icon: Clock, color: 'text-yellow-600' },
    { value: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin, color: 'text-blue-600' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-green-600' },
    { value: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-600' },
    { value: 'cancelled', label: 'Cancelled', icon: AlertTriangle, color: 'text-gray-600' },
  ];

  const updateStatus = async (newStatus: Delivery['status']) => {
    setIsUpdating(true);
    try {
      const updates: Partial<Delivery> = {
        status: newStatus,
      };

      if (newStatus === 'delivered') {
        updates.actual_delivery = new Date().toISOString();
      }

      if (notes.trim()) {
        updates.delivery_notes = notes;
      }

      const { error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', delivery.id);

      if (error) throw error;

      // Create a delivery performance log entry
      await supabase
        .from('delivery_performance_logs')
        .insert({
          delivery_id: delivery.id,
          delivery_staff_id: delivery.delivery_staff_id,
          status: newStatus === 'delivered' ? 'completed' : 'active',
          notes: notes || `Status updated to ${newStatus}`,
        });

      onUpdate();
      setNotes('');
    } catch (err) {
      console.error('Error updating delivery status:', err);
      alert('Failed to update delivery status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentStatusIcon = () => {
    const currentStatus = statusOptions.find(s => s.value === delivery.status);
    if (!currentStatus) return Clock;
    return currentStatus.icon;
  };

  const getCurrentStatusColor = () => {
    const currentStatus = statusOptions.find(s => s.value === delivery.status);
    return currentStatus?.color || 'text-gray-600';
  };

  const StatusIcon = getCurrentStatusIcon();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <StatusIcon className={`h-5 w-5 ${getCurrentStatusColor()}`} />
          <h3 className="text-lg font-medium text-gray-900">
            Delivery #{delivery.tracking_number}
          </h3>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
            delivery.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
            delivery.status === 'failed' ? 'bg-red-100 text-red-800' :
            delivery.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
            'bg-yellow-100 text-yellow-800'}`}>
          {delivery.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Add Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Add delivery notes..."
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isCurrentStatus = delivery.status === option.value;
            
            return (
              <button
                key={option.value}
                onClick={() => updateStatus(option.value as Delivery['status'])}
                disabled={isUpdating || isCurrentStatus}
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isCurrentStatus 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
              >
                <Icon className={`h-4 w-4 ${isCurrentStatus ? 'text-gray-400' : option.color}`} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}