import { useState } from 'react';
import { Package, TrendingUp, TrendingDown, RotateCcw, ArrowRightLeft, Plus, Search, Filter } from 'lucide-react';
import type { InventoryTransaction } from '../types/database';

interface TransactionHistoryProps {
  transactions: InventoryTransaction[];
  onAddTransaction: () => void;
  onRefresh: () => void;
}

export function TransactionHistory({ transactions, onAddTransaction, onRefresh }: TransactionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.product?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.location?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || transaction.transaction_type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getTransactionIcon = (type: InventoryTransaction['transaction_type']) => {
    switch (type) {
      case 'in':
        return TrendingUp;
      case 'out':
        return TrendingDown;
      case 'adjustment':
        return RotateCcw;
      case 'transfer_in':
      case 'transfer_out':
        return ArrowRightLeft;
      default:
        return Package;
    }
  };

  const getTransactionColor = (type: InventoryTransaction['transaction_type']) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
        return 'text-green-600 bg-green-100';
      case 'out':
      case 'transfer_out':
        return 'text-red-600 bg-red-100';
      case 'adjustment':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'in', label: 'Stock In' },
    { value: 'out', label: 'Stock Out' },
    { value: 'adjustment', label: 'Adjustment' },
    { value: 'transfer_in', label: 'Transfer In' },
    { value: 'transfer_out', label: 'Transfer Out' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Transactions
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
                placeholder="Search by product, location, or notes..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={onAddTransaction}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Statistics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {transactionTypes.slice(1).map((type) => {
          const count = transactions.filter(t => t.transaction_type === type.value).length;
          const Icon = getTransactionIcon(type.value as InventoryTransaction['transaction_type']);
          
          return (
            <div key={type.value} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Icon className="h-5 w-5 text-indigo-500" />
                <span className="ml-2 text-sm font-medium text-indigo-900">{type.label}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Transactions Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
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
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm || typeFilter !== 'all' 
                        ? 'No transactions found matching your filters.' 
                        : 'No transactions found. Create stock adjustments to get started.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const Icon = getTransactionIcon(transaction.transaction_type);
                    const typeColor = getTransactionColor(transaction.transaction_type);

                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Package className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {transaction.product?.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {transaction.product?.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.location?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {transaction.transaction_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${
                            transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in' ? '+' : '-'}
                            {Math.abs(transaction.quantity)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.performed_by_profile?.first_name} {transaction.performed_by_profile?.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.transaction_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {transaction.notes || '-'}
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