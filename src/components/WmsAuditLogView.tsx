import { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Eye, 
  Download,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Package
} from 'lucide-react';
import { Modal } from './Modal';
import type { WmsAuditLog } from '../types/database';

interface WmsAuditLogViewProps {
  auditLogs: WmsAuditLog[];
  onRefresh: () => void;
}

export function WmsAuditLogView({ auditLogs, onRefresh }: WmsAuditLogViewProps) {
  const [filteredLogs, setFilteredLogs] = useState<WmsAuditLog[]>(auditLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<WmsAuditLog | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Get unique actions and tables for filters
  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action))).sort();
  const uniqueTables = Array.from(new Set(auditLogs.map(log => log.table_name))).sort();

  const filterLogs = () => {
    let filtered = auditLogs;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(term) ||
        log.table_name.toLowerCase().includes(term) ||
        log.user?.full_name?.toLowerCase().includes(term) ||
        log.user?.email.toLowerCase().includes(term) ||
        JSON.stringify(log.old_values || {}).toLowerCase().includes(term) ||
        JSON.stringify(log.new_values || {}).toLowerCase().includes(term)
      );
    }

    // Filter by action
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Filter by table
    if (tableFilter !== 'all') {
      filtered = filtered.filter(log => log.table_name === tableFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0); // All time
      }
      
      filtered = filtered.filter(log => 
        new Date(log.created_at) >= startDate
      );
    }

    setFilteredLogs(filtered);
  };

  const handleViewDetails = (log: WmsAuditLog) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };

  const exportLogs = () => {
    const csvContent = [
      ['Date', 'User', 'Action', 'Table', 'Record ID', 'Details'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.user?.full_name || log.user?.email || 'System',
        log.action,
        log.table_name,
        log.record_id,
        JSON.stringify({
          old: log.old_values || {},
          new: log.new_values || {}
        })
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wms-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('insert')) {
      return CheckCircle;
    } else if (action.includes('update')) {
      return RefreshCw;
    } else if (action.includes('delete')) {
      return AlertCircle;
    }
    return Activity;
  };

  const getActionColor = (action: string) => {
    if (action.includes('insert')) {
      return 'text-green-600 bg-green-100';
    } else if (action.includes('update')) {
      return 'text-blue-600 bg-blue-100';
    } else if (action.includes('delete')) {
      return 'text-red-600 bg-red-100';
    }
    return 'text-gray-600 bg-gray-100';
  };

  const dateFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            WMS Audit Logs
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Track all changes to inventory, receiving, picking, and transfers
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-3">
          <button
            onClick={onRefresh}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </button>
          <button
            onClick={exportLogs}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  filterLogs();
                }}
                placeholder="Search logs..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="action-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                filterLogs();
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="table-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Table
            </label>
            <select
              id="table-filter"
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value);
                filterLogs();
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Tables</option>
              {uniqueTables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                filterLogs();
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {dateFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Table
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Record ID
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm || actionFilter !== 'all' || tableFilter !== 'all' || dateFilter !== 'all'
                      ? 'No audit logs found matching your filters.'
                      : 'No audit logs recorded yet.'
                    }
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const ActionIcon = getActionIcon(log.action);
                  const actionColor = getActionColor(log.action);

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1.5" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {log.user?.full_name || log.user?.email || 'System'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                          <ActionIcon className="h-3 w-3 mr-1" />
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.table_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {log.record_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(log)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Audit Log Details"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">User</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLog.user?.full_name || selectedLog.user?.email || 'System'}
                </p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Action Type</label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedLog.action}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <div className="mt-1 bg-gray-50 rounded-md p-3">
                {selectedLog.old_values || selectedLog.new_values ? (
                  <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                    {JSON.stringify({
                      old: selectedLog.old_values || {},
                      new: selectedLog.new_values || {}
                    }, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500 italic">No additional details recorded</p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}