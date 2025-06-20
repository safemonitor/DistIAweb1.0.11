import { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import type { UserActivityLog } from '../types/database';

interface ActivityLogWithUser extends UserActivityLog {
  user: {
    first_name: string;
    last_name: string;
  };
}

interface UserActivityLogViewerProps {
  userId?: string; // Optional - if provided, only shows logs for this user
  limit?: number; // Optional - limits the number of logs shown
  showFilters?: boolean; // Optional - whether to show filtering options
  showExport?: boolean; // Optional - whether to show export button
  className?: string; // Optional - additional CSS classes
}

export function UserActivityLogViewer({ 
  userId, 
  limit = 100, 
  showFilters = true,
  showExport = true,
  className = ''
}: UserActivityLogViewerProps) {
  const [logs, setLogs] = useState<ActivityLogWithUser[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLogWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLogWithUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchActivityLogs();
  }, [userId, limit]);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, actionTypeFilter, dateFilter, logs]);

  async function fetchActivityLogs() {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('user_activity_logs')
        .select(`
          *,
          user:profiles!user_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });
      
      // Apply user filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      // Apply limit
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  }

  function filterLogs() {
    let filtered = logs;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.action_type.toLowerCase().includes(term) ||
        log.user.first_name.toLowerCase().includes(term) ||
        log.user.last_name.toLowerCase().includes(term) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(term)
      );
    }

    // Filter by action type
    if (actionTypeFilter !== 'all') {
      filtered = filtered.filter(log => log.action_type === actionTypeFilter);
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
  }

  const handleViewDetails = (log: ActivityLogWithUser) => {
    setSelectedLog(log);
    setIsDetailsModalOpen(true);
  };

  const exportLogs = () => {
    const csvContent = [
      ['Date', 'User', 'Action', 'Details'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString(),
        `${log.user.first_name} ${log.user.last_name}`,
        log.action_type,
        JSON.stringify(log.details || {})
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('login') || actionType.includes('signup')) {
      return User;
    } else if (actionType.includes('created')) {
      return CheckCircle;
    } else if (actionType.includes('deleted')) {
      return AlertCircle;
    } else if (actionType.includes('updated')) {
      return RefreshCw;
    }
    return Activity;
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('login') || actionType.includes('signup')) {
      return 'text-blue-600 bg-blue-100';
    } else if (actionType.includes('created')) {
      return 'text-green-600 bg-green-100';
    } else if (actionType.includes('deleted')) {
      return 'text-red-600 bg-red-100';
    } else if (actionType.includes('updated')) {
      return 'text-yellow-600 bg-yellow-100';
    }
    return 'text-gray-600 bg-gray-100';
  };

  const uniqueActionTypes = Array.from(new Set(logs.map(log => log.action_type))).sort();

  const dateFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
  ];

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 p-4 rounded-md ${className}`}>
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            User Activity Logs
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {userId ? 'Activity history for this user' : 'Recent system activity'}
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-3">
          <button
            onClick={fetchActivityLogs}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </button>
          {showExport && (
            <button
              onClick={exportLogs}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="action-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Action Type
              </label>
              <select
                id="action-filter"
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Action Types</option>
                {uniqueActionTypes.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                onChange={(e) => setDateFilter(e.target.value)}
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
      )}

      {/* Activity Logs */}
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
                  Details
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm || actionTypeFilter !== 'all' || dateFilter !== 'all'
                      ? 'No activity logs found matching your filters.'
                      : 'No activity logs recorded yet.'
                    }
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const ActionIcon = getActionIcon(log.action_type);
                  const actionColor = getActionColor(log.action_type);

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
                              <span className="text-sm font-medium text-gray-700">
                                {log.user.first_name.charAt(0)}{log.user.last_name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {log.user.first_name} {log.user.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
                          <ActionIcon className="h-3 w-3 mr-1" />
                          {log.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {log.details ? (
                          <div className="truncate">
                            {Object.keys(log.details).length > 0 
                              ? `${Object.keys(log.details).length} field(s) modified`
                              : 'No details'
                            }
                          </div>
                        ) : (
                          'No details'
                        )}
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
          title="Activity Log Details"
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
                  {selectedLog.user.first_name} {selectedLog.user.last_name}
                </p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Action Type</label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedLog.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <div className="mt-1 bg-gray-50 rounded-md p-3">
                {selectedLog.details ? (
                  <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.details, null, 2)}
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