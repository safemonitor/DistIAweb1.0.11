import { 
  Building, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Warehouse,
  MapPin
} from 'lucide-react';
import type { Location, InventoryMetrics } from '../types/database';

interface WmsOverviewProps {
  metrics: InventoryMetrics;
  locations: Location[];
  onLocationSelect: (location: Location) => void;
}

export function WmsOverview({ metrics, locations, onLocationSelect }: WmsOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Warehouse className="h-5 w-5 text-blue-500" />
            <span className="ml-2 text-sm font-medium text-blue-900">Warehouses</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-900">{metrics.totalLocations}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-indigo-500" />
            <span className="ml-2 text-sm font-medium text-indigo-900">Locations</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">{metrics.totalLocations}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-green-500" />
            <span className="ml-2 text-sm font-medium text-green-900">Products</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-green-900">{metrics.totalProducts}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-purple-500" />
            <span className="ml-2 text-sm font-medium text-purple-900">Stock Value</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-purple-900">
            ${metrics.totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="ml-2 text-sm font-medium text-red-900">Low Stock</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-900">{metrics.lowStockItems}</p>
        </div>
      </div>

      {/* Pending Operations */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-yellow-500" />
            <span className="ml-2 text-sm font-medium text-yellow-900">Pending Transfers</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-yellow-900">{metrics.pendingTransfers}</p>
        </div>
      </div>

      {/* Stock by Location */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Stock by Location
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.stockByLocation.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No location inventory data available.
                  </td>
                </tr>
              ) : (
                metrics.stockByLocation.map((locationStock) => {
                  const location = locations.find(l => l.id === locationStock.location_id);
                  if (!location) return null;

                  return (
                    <tr key={locationStock.location_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {locationStock.location_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {location.address || 'No address'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {locationStock.total_items.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${locationStock.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => onLocationSelect(location)}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        >
                          View Details
                          <ArrowRight className="h-4 w-4 ml-1" />
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

      {/* Top Moving Products */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Top Moving Products
        </h3>
        
        <div className="space-y-3">
          {metrics.topMovingProducts.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No product movement data available.</p>
          ) : (
            metrics.topMovingProducts.slice(0, 10).map((product, index) => (
              <div key={product.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Net change: {product.net_change > 0 ? '+' : ''}{product.net_change}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {product.total_movements} movements
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        
        <div className="space-y-3">
          {metrics.recentTransactions.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No recent activity found.</p>
          ) : (
            metrics.recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.product?.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {transaction.location?.name} • {transaction.performed_by_profile?.first_name} {transaction.performed_by_profile?.last_name}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${
                    transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in' ? '+' : '-'}
                    {transaction.quantity}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {transaction.transaction_type.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}