import { useState } from 'react';
import { 
  ArrowRightLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Ban, 
  Plus, 
  Search, 
  Eye,
  MapPin
} from 'lucide-react';
import type { WmsTransfer, WmsLocation } from '../types/database';

interface WmsTransferManagerProps {
  transfers: WmsTransfer[];
  locations: WmsLocation[];
  onProcessTransfer: (transfer: WmsTransfer) => void;
  onAddTransfer: () => void;
  onRefresh: () => void;
}

export function WmsTransferManager({ 
  transfers, 
  locations, 
  onProcessTransfer, 
  onAddTransfer, 
  onRefresh 
}: WmsTransferManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = !searchTerm || 
      transfer.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.from_location?.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.to_location?.zone.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const updateTransferStatus = async (transferId: string, newStatus: WmsTransfer['status']) => {
    setIsUpdating(transferId);
    try {
      const { error } = await supabase
        .from('wms_transfers')
        .update({ status: newStatus })
        .eq('id', transferId);

      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('Error updating transfer status:', err);
      alert('Failed to update transfer status');
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusIcon = (status: WmsTransfer['status']) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'cancelled':
        return Ban;
      case 'in_progress':
        return ArrowRightLeft;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: WmsTransfer['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Transfers
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by reference number or location..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={onAddTransfer}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Statistics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statusOptions.slice(1).map((status) => {
          const count = transfers.filter(t => t.status === status.value).length;
          const Icon = getStatusIcon(status.value as WmsTransfer['status']);
          
          return (
            <div key={status.value} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="ml-2 text-sm font-medium text-indigo-900">{status.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Transfers Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Stock Transfers</h3>
            <button
              onClick={onRefresh}
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    To Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Initiated By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'No transfers found matching your filters.' 
                        : 'No stock transfers found. Create a transfer to get started.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((transfer) => {
                    const StatusIcon = getStatusIcon(transfer.status);
                    const statusColor = getStatusColor(transfer.status);

                    return (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transfer.reference_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm text-gray-900">
                              {transfer.from_location?.zone}-{transfer.from_location?.aisle}-{transfer.from_location?.shelf}-{transfer.from_location?.position}
                              <div className="text-xs text-gray-500">
                                {transfer.from_location?.warehouse?.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm text-gray-900">
                              {transfer.to_location?.zone}-{transfer.to_location?.aisle}-{transfer.to_location?.shelf}-{transfer.to_location?.position}
                              <div className="text-xs text-gray-500">
                                {transfer.to_location?.warehouse?.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {transfer.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transfer.initiated_by_user?.full_name || transfer.initiated_by_user?.email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transfer.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => onProcessTransfer(transfer)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </button>
                            
                            {transfer.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => updateTransferStatus(transfer.id, 'in_progress')}
                                  disabled={isUpdating === transfer.id}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                >
                                  Start
                                </button>
                                <button
                                  onClick={() => updateTransferStatus(transfer.id, 'cancelled')}
                                  disabled={isUpdating === transfer.id}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            
                            {transfer.status === 'in_progress' && (
                              <button
                                onClick={() => updateTransferStatus(transfer.id, 'completed')}
                                disabled={isUpdating === transfer.id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}