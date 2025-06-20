import { useState } from 'react';
import { 
  Building, 
  Package, 
  Search, 
  Plus, 
  Pencil, 
  AlertTriangle,
  Warehouse,
  MapPin,
  Filter
} from 'lucide-react';
import type { Location, Product, LocationInventory } from '../types/database';

interface WmsInventoryViewProps {
  locations: Location[];
  products: Product[];
  inventory: LocationInventory[];
  onEditLocation: (location: Location) => void;
  onEditProduct?: (product: Product) => void;
  onRefresh: () => void;
}

export function WmsInventoryView({ 
  locations, 
  products, 
  inventory, 
  onEditLocation, 
  onEditProduct,
  onRefresh 
}: WmsInventoryViewProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Get unique categories from products
  const categories = Array.from(new Set(products.map(p => p.category || 'Uncategorized')));

  const filteredInventory = inventory.filter(item => {
    const matchesLocation = selectedLocationId === 'all' || item.location_id === selectedLocationId;
    
    const matchesSearch = !searchTerm || 
      item.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
      item.product?.category === categoryFilter;
    
    return matchesLocation && matchesSearch && matchesCategory;
  });

  const getStockStatus = (item: LocationInventory) => {
    if (!item.product) return { color: 'text-gray-600 bg-gray-100', label: 'Unknown' };
    
    if (item.quantity === 0) return { color: 'text-red-600 bg-red-100', label: 'Out of Stock' };
    if (item.quantity <= item.product.min_stock) return { color: 'text-yellow-600 bg-yellow-100', label: 'Low Stock' };
    if (item.product.max_stock && item.quantity >= item.product.max_stock) return { color: 'text-blue-600 bg-blue-100', label: 'Overstocked' };
    return { color: 'text-green-600 bg-green-100', label: 'In Stock' };
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Location
            </label>
            <select
              id="location-filter"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.location_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Products or Locations
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
                placeholder="Search by product name, SKU, or location..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.map((location) => {
          const locationItems = inventory.filter(item => item.location_id === location.id);
          const totalItems = locationItems.reduce((sum, item) => sum + item.quantity, 0);
          const totalValue = locationItems.reduce((sum, item) => 
            sum + (item.quantity * (item.product?.price || 0)), 0
          );
          const lowStockCount = locationItems.filter(item => item.quantity <= 10).length;

          return (
            <div key={location.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{location.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{location.location_type}</p>
                  </div>
                </div>
                <button
                  onClick={() => onEditLocation(location)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Items:</span>
                  <span className="text-sm font-medium text-gray-900">{totalItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Value:</span>
                  <span className="text-sm font-medium text-gray-900">${totalValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Product Types:</span>
                  <span className="text-sm font-medium text-gray-900">{locationItems.length}</span>
                </div>
                {lowStockCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Low Stock:
                    </span>
                    <span className="text-sm font-medium text-red-600">{lowStockCount}</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  location.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inventory Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Location Inventory</h3>
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
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm || selectedLocationId !== 'all' || categoryFilter !== 'all' 
                        ? 'No inventory found matching your filters.' 
                        : 'No inventory items found. Add stock transactions to get started.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const stockStatus = getStockStatus(item);
                    const totalValue = item.quantity * (item.product?.price || 0);

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Package className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.product?.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {item.product?.sku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">{item.location?.name}</div>
                              <div className="text-sm text-gray-500 capitalize">{item.location?.location_type}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${item.product?.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${totalValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(item.last_updated_at).toLocaleString()}
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