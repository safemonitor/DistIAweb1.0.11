import { useState } from 'react';
import { Search, Package, MapPin, Calendar, TrendingUp, TrendingDown, BarChart3, Scan } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { supabase } from '../lib/supabase';
import type { Product, LocationInventory, InventoryTransaction } from '../types/database';

interface BarcodeInventoryLookupProps {
  products: Product[];
  locationInventory: LocationInventory[];
  onRefresh: () => void;
}

interface ProductLookupResult {
  product: Product;
  locations: {
    location: LocationInventory['location'];
    quantity: number;
    last_updated: string;
  }[];
  recentTransactions: InventoryTransaction[];
  totalQuantity: number;
  totalValue: number;
}

export function BarcodeInventoryLookup({ 
  products, 
  locationInventory, 
  onRefresh 
}: BarcodeInventoryLookupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lookupResult, setLookupResult] = useState<ProductLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleBarcodeScanned = async (barcode: string) => {
    setSearchTerm(barcode);
    await performLookup(barcode);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      await performLookup(searchTerm.trim());
    }
  };

  const performLookup = async (searchValue: string) => {
    setIsLoading(true);
    setError(null);
    setLookupResult(null);

    try {
      // Find product by SKU, name, or ID
      const product = products.find(p => 
        p.sku === searchValue ||
        p.sku.includes(searchValue) ||
        searchValue.includes(p.sku) ||
        p.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        p.id === searchValue
      );

      if (!product) {
        setError(`No product found matching: ${searchValue}`);
        return;
      }

      // Get inventory locations for this product
      const productInventory = locationInventory.filter(inv => inv.product_id === product.id);
      
      // Get recent transactions for this product
      const { data: transactions, error: transError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          location:locations (*),
          performed_by_profile:profiles!performed_by (
            first_name,
            last_name
          )
        `)
        .eq('product_id', product.id)
        .order('transaction_date', { ascending: false })
        .limit(10);

      if (transError) throw transError;

      const totalQuantity = productInventory.reduce((sum, inv) => sum + inv.quantity, 0);
      const totalValue = totalQuantity * product.price;

      const result: ProductLookupResult = {
        product,
        locations: productInventory.map(inv => ({
          location: inv.location,
          quantity: inv.quantity,
          last_updated: inv.last_updated_at,
        })),
        recentTransactions: transactions || [],
        totalQuantity,
        totalValue,
      };

      setLookupResult(result);
    } catch (err) {
      console.error('Error performing lookup:', err);
      setError('Failed to lookup product information');
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: InventoryTransaction['transaction_type']) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
        return TrendingUp;
      case 'out':
      case 'transfer_out':
        return TrendingDown;
      default:
        return BarChart3;
    }
  };

  const getTransactionColor = (type: InventoryTransaction['transaction_type']) => {
    switch (type) {
      case 'in':
      case 'transfer_in':
        return 'text-green-600';
      case 'out':
      case 'transfer_out':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Product Inventory Lookup</h3>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Scan className="h-4 w-4 mr-2" />
            Scan Barcode
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter SKU, barcode, or product name..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !searchTerm.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Lookup Results */}
      {lookupResult && (
        <div className="space-y-6">
          {/* Product Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Product Information
              </h3>
              <button
                onClick={onRefresh}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              >
                Refresh Data
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Product Name</h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">{lookupResult.product.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">SKU</h4>
                <p className="mt-1 text-lg font-mono text-gray-900">{lookupResult.product.sku}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Unit Price</h4>
                <p className="mt-1 text-lg font-semibold text-gray-900">${lookupResult.product.price.toFixed(2)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Category</h4>
                <p className="mt-1 text-lg text-gray-900 capitalize">{lookupResult.product.category}</p>
              </div>
            </div>

            {lookupResult.product.description && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-500">Description</h4>
                <p className="mt-1 text-gray-900">{lookupResult.product.description}</p>
              </div>
            )}
          </div>

          {/* Inventory Summary */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Summary</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-900">{lookupResult.totalQuantity}</div>
                <div className="text-sm text-blue-600">Total Quantity</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-900">${lookupResult.totalValue.toFixed(2)}</div>
                <div className="text-sm text-green-600">Total Value</div>
              </div>
            </div>

            {/* Location Breakdown */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lookupResult.locations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No inventory found at any location
                      </td>
                    </tr>
                  ) : (
                    lookupResult.locations.map((loc, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">
                              {loc.location?.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            {loc.location?.location_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {loc.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(loc.quantity * lookupResult.product.price).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(loc.last_updated).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recent Transactions
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
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
                  {lookupResult.recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No recent transactions found
                      </td>
                    </tr>
                  ) : (
                    lookupResult.recentTransactions.map((transaction) => {
                      const Icon = getTransactionIcon(transaction.transaction_type);
                      const color = getTransactionColor(transaction.transaction_type);

                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Icon className={`h-4 w-4 mr-2 ${color}`} />
                              <span className="text-sm text-gray-900 capitalize">
                                {transaction.transaction_type.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.location?.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${color}`}>
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
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product for Lookup"
        placeholder="Scan barcode or enter SKU to lookup inventory"
      />
    </div>
  );
}