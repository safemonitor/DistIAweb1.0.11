import { useState, useEffect } from 'react';
import { Package, MapPin, Hash, FileText, Scan, AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { BarcodeScanner } from './BarcodeScanner';
import { supabase } from '../lib/supabase';
import type { Location, Product } from '../types/database';

interface BarcodeInventoryTransactionProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  products: Product[];
  onSuccess: () => void;
}

export function BarcodeInventoryTransaction({ 
  isOpen, 
  onClose, 
  locations, 
  products, 
  onSuccess 
}: BarcodeInventoryTransactionProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    location_id: '',
    transaction_type: 'in',
    quantity: 1,
    notes: '',
  });
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanHistory, setScanHistory] = useState<string[]>([]);

  useEffect(() => {
    if (formData.product_id) {
      const product = products.find(p => p.id === formData.product_id);
      setScannedProduct(product || null);
    } else {
      setScannedProduct(null);
    }
  }, [formData.product_id, products]);

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      // Add to scan history
      setScanHistory(prev => [barcode, ...prev.slice(0, 4)]);
      
      // Look up product by SKU (assuming SKU is the barcode)
      const product = products.find(p => 
        p.sku === barcode || 
        p.sku.includes(barcode) ||
        barcode.includes(p.sku)
      );

      if (product) {
        setFormData(prev => ({ ...prev, product_id: product.id }));
        setScannedProduct(product);
        setError(null);
      } else {
        setError(`No product found with barcode: ${barcode}`);
        setScannedProduct(null);
      }
    } catch (err) {
      console.error('Error processing barcode:', err);
      setError('Failed to process barcode');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) {
      setError('Please scan or select a product');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the user's tenant_id
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;

      const { error } = await supabase
        .from('inventory_transactions')
        .insert([{
          ...formData,
          performed_by: user.id,
          tenant_id: tenant_id, // Add tenant_id to the transaction
          notes: formData.notes || `Barcode scan transaction for ${scannedProduct?.name}`,
        }]);

      if (error) throw error;

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        product_id: '',
        location_id: '',
        transaction_type: 'in',
        quantity: 1,
        notes: '',
      });
      setScannedProduct(null);
      setScanHistory([]);
    } catch (err) {
      setError('Failed to create transaction');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const transactionTypes = [
    { value: 'in', label: 'Stock In', description: 'Add inventory to location', icon: '📦' },
    { value: 'out', label: 'Stock Out', description: 'Remove inventory from location', icon: '📤' },
    { value: 'adjustment', label: 'Adjustment', description: 'Correct inventory discrepancies', icon: '⚖️' },
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Barcode Stock Transaction"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Barcode Scanning Section */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-indigo-900 flex items-center">
                <Scan className="h-4 w-4 mr-2" />
                Product Scanning
              </h4>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
              >
                <Scan className="h-3 w-3 mr-1" />
                Scan Barcode
              </button>
            </div>

            {scannedProduct ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-800">{scannedProduct.name}</p>
                    <p className="text-xs text-green-600">SKU: {scannedProduct.sku} • Price: ${scannedProduct.price}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <Package className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm text-indigo-600">No product scanned yet</p>
                <p className="text-xs text-indigo-500">Scan a barcode or select manually below</p>
              </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-indigo-700 mb-1">Recent Scans:</p>
                <div className="flex flex-wrap gap-1">
                  {scanHistory.map((barcode, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-indigo-100 text-indigo-700"
                    >
                      {barcode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual Product Selection */}
          <div>
            <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 mb-2">
              <Package className="h-4 w-4 inline mr-2" />
              Product (Manual Selection)
            </label>
            <select
              id="product_id"
              name="product_id"
              value={formData.product_id}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a product manually</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) - ${product.price}
                </option>
              ))}
            </select>
          </div>

          {/* Location Selection */}
          <div>
            <label htmlFor="location_id" className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="h-4 w-4 inline mr-2" />
              Location
            </label>
            <select
              id="location_id"
              name="location_id"
              value={formData.location_id}
              onChange={handleChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select a location</option>
              {locations.filter(l => l.is_active).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.location_type})
                </option>
              ))}
            </select>
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transaction Type
            </label>
            <div className="grid grid-cols-1 gap-3">
              {transactionTypes.map((type) => (
                <label
                  key={type.value}
                  className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                    formData.transaction_type === type.value
                      ? 'border-indigo-600 ring-2 ring-indigo-600 bg-indigo-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transaction_type"
                    value={type.value}
                    checked={formData.transaction_type === type.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{type.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
              <Hash className="h-4 w-4 inline mr-2" />
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              min="1"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              {formData.transaction_type === 'out' 
                ? 'Quantity to remove from inventory'
                : formData.transaction_type === 'adjustment'
                ? 'Positive for increase, negative for decrease'
                : 'Quantity to add to inventory'
              }
            </p>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="h-4 w-4 inline mr-2" />
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Optional notes about this transaction..."
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.product_id}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="Scan Product Barcode"
        placeholder="Enter product SKU or barcode"
      />
    </>
  );
}