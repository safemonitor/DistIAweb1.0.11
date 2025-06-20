import { useState, useEffect } from 'react';
import { 
  Package, 
  MapPin, 
  ArrowRightLeft, 
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Search,
  Filter,
  Building,
  Boxes,
  Scan,
  Warehouse
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarcodeInventoryLookup } from '../components/BarcodeInventoryLookup';
import { BarcodeInventoryTransaction } from '../components/BarcodeInventoryTransaction';
import { BarcodeStockTransfer } from '../components/BarcodeStockTransfer';
import { InventoryOverview } from '../components/InventoryOverview';
import { InventoryTransactionModal } from '../components/InventoryTransactionModal';
import { LocationInventoryView } from '../components/LocationInventoryView';
import { LocationModal } from '../components/LocationModal';
import { StockTransferManager } from '../components/StockTransferManager';
import { StockTransferModal } from '../components/StockTransferModal';
import { TransactionHistory } from '../components/TransactionHistory';
import type { 
  Location, 
  Product, 
  InventoryTransaction, 
  StockTransfer, 
  LocationInventory,
  InventoryMetrics
} from '../types/database';

export function WarehousePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'transactions' | 'transfers' | 'barcode'>('overview');
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [locationInventory, setLocationInventory] = useState<LocationInventory[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalLocations: 0,
    totalProducts: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    pendingTransfers: 0,
    recentTransactions: [],
    stockByLocation: [],
    topMovingProducts: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBarcodeTransactionOpen, setIsBarcodeTransactionOpen] = useState(false);
  const [isBarcodeTransferOpen, setIsBarcodeTransferOpen] = useState(false);
  
  // Selected items for editing
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>();
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name');

      if (locationsError) throw locationsError;

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (productsError) throw productsError;

      // Fetch inventory transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          product:products (*),
          location:locations (*),
          performed_by_profile:profiles!performed_by (
            first_name,
            last_name
          )
        `)
        .order('transaction_date', { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;

      // Fetch stock transfers
      const { data: transfersData, error: transfersError } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:locations!from_location_id (*),
          to_location:locations!to_location_id (*),
          created_by_profile:profiles!created_by (
            first_name,
            last_name
          ),
          transfer_items:stock_transfer_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (transfersError) throw transfersError;

      // Fetch location inventory
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('location_inventory')
        .select(`
          *,
          product:products (*),
          location:locations (*)
        `);

      if (inventoryError) throw inventoryError;

      setLocations(locationsData || []);
      setProducts(productsData || []);
      setTransactions(transactionsData || []);
      setTransfers(transfersData || []);
      setLocationInventory(inventoryData || []);

      // Calculate metrics
      calculateMetrics(
        locationsData || [], 
        productsData || [], 
        transactionsData || [], 
        transfersData || [], 
        inventoryData || []
      );
    } catch (err) {
      console.error('Error fetching warehouse data:', err);
      setError('Failed to load warehouse data');
    } finally {
      setIsLoading(false);
    }
  }

  function calculateMetrics(
    locations: Location[], 
    products: Product[],
    transactions: InventoryTransaction[],
    transfers: StockTransfer[],
    inventory: LocationInventory[]
  ) {
    // Calculate total stock value
    const totalStockValue = inventory.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      return sum + (item.quantity * (product?.price || 0));
    }, 0);

    // Count low stock items
    const lowStockItems = inventory.reduce((count, item) => {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.quantity <= product.min_stock) {
        return count + 1;
      }
      return count;
    }, 0);

    // Count pending transfers
    const pendingTransfers = transfers.filter(t => t.status === 'pending').length;

    // Calculate stock by location
    const stockByLocation = locations.map(location => {
      const locationItems = inventory.filter(i => i.location_id === location.id);
      const totalItems = locationItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = locationItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.product_id);
        return sum + (item.quantity * (product?.price || 0));
      }, 0);

      return {
        location_id: location.id,
        location_name: location.name,
        total_items: totalItems,
        total_value: totalValue
      };
    });

    // Calculate top moving products
    const productMovements = new Map();
    
    transactions.forEach(transaction => {
      const productId = transaction.product_id;
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      const existing = productMovements.get(productId) || {
        product_id: productId,
        product_name: product.name,
        total_movements: 0,
        net_change: 0
      };
      
      const quantityChange = transaction.transaction_type === 'in' || transaction.transaction_type === 'transfer_in'
        ? transaction.quantity
        : -transaction.quantity;
      
      existing.total_movements += Math.abs(transaction.quantity);
      existing.net_change += quantityChange;
      
      productMovements.set(productId, existing);
    });

    const topMovingProducts = Array.from(productMovements.values())
      .sort((a, b) => b.total_movements - a.total_movements)
      .slice(0, 10);

    setMetrics({
      totalLocations: locations.length,
      totalProducts: products.length,
      totalStockValue,
      lowStockItems,
      pendingTransfers,
      recentTransactions: transactions.slice(0, 10),
      stockByLocation,
      topMovingProducts
    });
  }

  const handleAddLocation = () => {
    setSelectedLocation(undefined);
    setIsLocationModalOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setIsLocationModalOpen(true);
  };

  const handleAddTransfer = () => {
    setSelectedTransfer(undefined);
    setIsTransferModalOpen(true);
  };

  const handleEditTransfer = (transfer: StockTransfer) => {
    setSelectedTransfer(transfer);
    setIsTransferModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Warehouse Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage inventory, locations, and stock transfers
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button
            onClick={handleAddLocation}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Add Location
          </button>
          <button
            onClick={() => setIsTransactionModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Add Transaction
          </button>
          <button
            onClick={handleAddTransfer}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Create Transfer
          </button>
          <button
            onClick={() => setIsBarcodeTransactionOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <Scan className="h-4 w-4 mr-2" />
            Barcode Transaction
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'inventory', name: 'Inventory', icon: Package },
            { id: 'transactions', name: 'Transactions', icon: TrendingUp },
            { id: 'transfers', name: 'Transfers', icon: ArrowRightLeft },
            { id: 'barcode', name: 'Barcode Lookup', icon: Scan },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <InventoryOverview 
          metrics={metrics}
          locations={locations}
          onLocationSelect={handleEditLocation}
        />
      )}

      {activeTab === 'inventory' && (
        <LocationInventoryView 
          locations={locations}
          locationInventory={locationInventory}
          onEditLocation={handleEditLocation}
          onAddTransaction={() => setIsTransactionModalOpen(true)}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionHistory 
          transactions={transactions}
          onAddTransaction={() => setIsTransactionModalOpen(true)}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'transfers' && (
        <StockTransferManager 
          transfers={transfers}
          locations={locations}
          onEditTransfer={handleEditTransfer}
          onAddTransfer={handleAddTransfer}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'barcode' && (
        <BarcodeInventoryLookup 
          products={products}
          locationInventory={locationInventory}
          onRefresh={fetchData}
        />
      )}

      {/* Modals */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={selectedLocation}
        onSuccess={fetchData}
      />

      <InventoryTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        locations={locations}
        products={products}
        onSuccess={fetchData}
      />

      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        transfer={selectedTransfer}
        locations={locations}
        products={products}
        onSuccess={fetchData}
      />

      <BarcodeInventoryTransaction
        isOpen={isBarcodeTransactionOpen}
        onClose={() => setIsBarcodeTransactionOpen(false)}
        locations={locations}
        products={products}
        onSuccess={fetchData}
      />

      <BarcodeStockTransfer
        isOpen={isBarcodeTransferOpen}
        onClose={() => setIsBarcodeTransferOpen(false)}
        locations={locations}
        products={products}
        onSuccess={fetchData}
      />
    </div>
  );
}