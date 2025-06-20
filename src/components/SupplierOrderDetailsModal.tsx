import { Modal } from './Modal';
import { Truck as TruckReceiving, Package, Calendar, MapPin, DollarSign, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { SupplierOrder } from '../types/database';

interface SupplierOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SupplierOrder;
}

export function SupplierOrderDetailsModal({ 
  isOpen, 
  onClose, 
  order 
}: SupplierOrderDetailsModalProps) {
  const getStatusIcon = (status: SupplierOrder['status']) => {
    switch (status) {
      case 'received':
        return CheckCircle;
      case 'partially_received':
        return Clock;
      case 'cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: SupplierOrder['status']) => {
    switch (status) {
      case 'received':
        return 'text-green-600 bg-green-100';
      case 'partially_received':
        return 'text-blue-600 bg-blue-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const StatusIcon = getStatusIcon(order.status);
  const statusColor = getStatusColor(order.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Supplier Order Details - ${order.supplier_name}`}
    >
      <div className="space-y-6">
        {/* Order Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <TruckReceiving className="h-5 w-5 mr-2 text-indigo-600" />
              Order Information
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {order.status.replace('_', ' ')}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Supplier</p>
              <p className="mt-1 text-sm text-gray-900">{order.supplier_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Order Date</p>
              <p className="mt-1 text-sm text-gray-900 flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                {new Date(order.order_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Expected Delivery</p>
              <p className="mt-1 text-sm text-gray-900 flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                {new Date(order.expected_delivery_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Receiving Location</p>
              <p className="mt-1 text-sm text-gray-900 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                {order.receiving_location?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="mt-1 text-sm text-gray-900 flex items-center">
                <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
                ${order.total_amount?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created By</p>
              <p className="mt-1 text-sm text-gray-900">
                {order.created_by_profile?.first_name} {order.created_by_profile?.last_name}
              </p>
            </div>
          </div>

          {order.notes && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500">Notes</p>
              <div className="mt-1 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-900 whitespace-pre-line">{order.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-indigo-600" />
              Order Items
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity Ordered
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity Received
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.order_items && order.order_items.length > 0 ? (
                  order.order_items.map((item) => {
                    const isFullyReceived = item.quantity_received >= item.quantity_ordered;
                    const isPartiallyReceived = item.quantity_received > 0 && !isFullyReceived;
                    
                    return (
                      <tr key={item.id} className={isFullyReceived ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.product?.name || 'Unknown Product'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.quantity_ordered}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.quantity_received}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${item.unit_cost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${(item.quantity_ordered * item.unit_cost).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isFullyReceived ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Received
                            </span>
                          ) : isPartiallyReceived ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      No items found for this order
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${order.total_amount?.toFixed(2) || '0.00'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Receipt Summary */}
        {(order.status === 'partially_received' || order.status === 'received') && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Receipt Summary</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    {order.status === 'received' 
                      ? 'All items have been received.' 
                      : 'Some items have been partially received.'}
                  </p>
                  {order.order_items && (
                    <p className="mt-1">
                      Total received: {order.order_items.reduce((sum, item) => sum + item.quantity_received, 0)} of {order.order_items.reduce((sum, item) => sum + item.quantity_ordered, 0)} items
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}