import { useState } from 'react';
import { Modal } from './Modal';
import { Package, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupplierOrder, SupplierOrderItem } from '../types/database';

interface SupplierOrderReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SupplierOrder;
  onSuccess: () => void;
}

export function SupplierOrderReceiveModal({ 
  isOpen, 
  onClose, 
  order, 
  onSuccess 
}: SupplierOrderReceiveModalProps) {
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>(
    order.order_items?.reduce((acc, item) => {
      acc[item.id] = item.received_quantity || 0;
      return acc;
    }, {} as Record<string, number>) || {}
  );
  
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateReceivedQuantity = (itemId: string, quantity: number) => {
    setReceivedItems(prev => ({
      ...prev,
      [itemId]: quantity
    }));
  };

  const handleReceiveAll = () => {
    const newReceivedItems = { ...receivedItems };
    
    order.order_items?.forEach(item => {
      newReceivedItems[item.id] = item.quantity;
    });
    
    setReceivedItems(newReceivedItems);
  };

  const calculateTotalReceived = () => {
    if (!order.order_items) return 0;
    
    let totalReceived = 0;
    let totalOrdered = 0;
    
    order.order_items.forEach(item => {
      totalReceived += receivedItems[item.id] || 0;
      totalOrdered += item.quantity;
    });
    
    return { totalReceived, totalOrdered };
  };

  const determineNewStatus = () => {
    const { totalReceived, totalOrdered } = calculateTotalReceived();
    
    if (totalReceived === 0) {
      return 'pending';
    } else if (totalReceived === totalOrdered) {
      return 'received';
    } else {
      return 'partial';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update order status
      const newStatus = determineNewStatus();
      const { error: orderError } = await supabase
        .from('supplier_orders')
        .update({ 
          status: newStatus,
          notes: notes ? `${order.notes || ''}\n\nReceiving notes (${new Date().toLocaleString()}): ${notes}` : order.notes
        })
        .eq('id', order.id);
      
      if (orderError) throw orderError;

      // Update received quantities for each item
      for (const itemId in receivedItems) {
        const { error: itemError } = await supabase
          .from('supplier_order_items')
          .update({ 
            received_quantity: receivedItems[itemId]
          })
          .eq('id', itemId);
        
        if (itemError) throw itemError;
      }

      // Create inventory transactions for received items
      const orderItems = order.order_items || [];
      const transactionsToCreate = orderItems
        .filter(item => {
          const currentReceived = receivedItems[item.id] || 0;
          const previousReceived = item.received_quantity || 0;
          return currentReceived > previousReceived;
        })
        .map(item => {
          const currentReceived = receivedItems[item.id] || 0;
          const previousReceived = item.received_quantity || 0;
          const quantityToAdd = currentReceived - previousReceived;
          
          return {
            tenant_id: order.tenant_id,
            product_id: item.product_id,
            location_id: order.receiving_location_id,
            transaction_type: 'in',
            quantity: quantityToAdd,
            reference_id: order.id,
            notes: `Received from supplier order: ${order.supplier_name} ${order.order_number ? `(#${order.order_number})` : ''}`,
            performed_by: user.id,
            transaction_date: new Date().toISOString()
          };
        });

      if (transactionsToCreate.length > 0) {
        const { error: transactionError } = await supabase
          .from('inventory_transactions')
          .insert(transactionsToCreate);
        
        if (transactionError) throw transactionError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to process received items');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const { totalReceived, totalOrdered } = calculateTotalReceived();
  const receivingProgress = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Order - ${order.supplier_name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-900">Order Summary</h3>
            <span className="text-sm text-gray-500">
              Order Date: {new Date(order.order_date).toLocaleDateString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Order Number:</span>
              <span className="ml-2">{order.order_number || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Total Amount:</span>
              <span className="ml-2">${order.total_amount.toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Receiving Location:</span>
              <span className="ml-2">{order.receiving_location?.name || 'Not specified'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <span className="ml-2 capitalize">{order.status}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-900">Receive Items</h3>
            <button
              type="button"
              onClick={handleReceiveAll}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Receive All
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between text-sm text-gray-700 mb-1">
              <span>Receiving Progress</span>
              <span>{totalReceived} of {totalOrdered} items</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-green-600 h-2.5 rounded-full" 
                style={{ width: `${receivingProgress}%` }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {order.order_items?.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Package className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.product?.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {item.product?.sku} • ${item.unit_price.toFixed(2)} each
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ${(item.quantity * item.unit_price).toFixed(2)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Ordered: {item.quantity}
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-700 mr-2">Received:</span>
                    <input
                      type="number"
                      value={receivedItems[item.id] || 0}
                      onChange={(e) => updateReceivedQuantity(item.id, Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0)))}
                      min="0"
                      max={item.quantity}
                      className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                {receivedItems[item.id] > 0 && receivedItems[item.id] < item.quantity && (
                  <div className="mt-2 text-xs text-yellow-600 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Partially received
                  </div>
                )}
                
                {receivedItems[item.id] === item.quantity && (
                  <div className="mt-2 text-xs text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Fully received
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Receiving Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Optional notes about this receipt"
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
            disabled={isLoading || totalReceived === 0}
            className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 sm:ml-3 sm:w-auto disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Confirm Receipt'}
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