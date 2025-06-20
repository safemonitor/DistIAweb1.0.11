import { useState, useEffect } from 'react';
import { ArrowRightLeft, MapPin, Package, Plus, Minus, FileText, Scan, CheckCircle, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { BarcodeScanner } from './BarcodeScanner';
import { supabase } from '../lib/supabase';
import type { StockTransfer, Location, Product } from '../types/database';

interface BarcodeStockTransferProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: StockTransfer;
  locations: Location[];
  products: Product[];
  onSuccess: () => void;
}

interface TransferItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  scanned: boolean;
}

export function BarcodeStockTransfer({ 
  isOpen, 
  onClose, 
  transfer, 
  locations, 
  products, 
  onSuccess 
}: BarcodeStockTransferProps) {
  const [formData, setFormData] = useState({
    from_location_id: transfer?.from_location_id || '',
    to_location_id: transfer?.to_location_id || '',
    notes: transfer?.notes || '',
    status: transfer?.status || 'pending',
  });
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState<'add' | 'verify'>('add');

  useEffect(() => {
    if (transfer && transfer.transfer_items) {
      setTransferItems(
        transfer.transfer_items.map(item => ({
          product_id: item.product_id,
          product_name: item.product?.name || 'Unknown',
          product_sku: item.product?.sku || '',
          quantity: item.quantity,
          scanned: false,
        }))
      );
    } else {
      setTransferItems([]);
    }
  }, [transfer]);

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      // Add to scan history
      setScanHistory(prev => [barcode, ...prev.slice(0, 9)]);
      
      // Look up product by SKU
      const product = products.find(p => 
        p.sku === barcode || 
        p.sku.includes(barcode) ||
        barcode.includes(p.sku)
      );

      if (!product) {
        setError(`No product found with barcode: ${barcode}`);
        return;
      }

      if (scanMode === 'add') {
        // Add new item or increase quantity
        const existingItemIndex = transferItems.findIndex(item => item.product_id === product.id);
        
        if (existingItemIndex >= 0) {
          setTransferItems(prev => 
            prev.map((item, index) => 
              index === existingItemIndex 
                ? { ...item, quantity: item.quantity + 1, scanned: true }
                : item
            )
          );
        } else {
          setTransferItems(prev => [...prev, {
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            quantity: 1,
            scanned: true,
          }]);
        }
      } else {
        // Verify mode - mark item as scanned
        const itemIndex = transferItems.findIndex(item => item.product_id === product.id);
        if (itemIndex >= 0) {
          setTransferItems(prev => 
            prev.map((item, index) => 
              index === itemIndex 
                ? { ...item, scanned: true }
                : item
            )
          );
        } else {
          setError(`Product ${product.name} is not in this transfer`);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error processing barcode:', err);
      setError('Failed to process barcode');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addTransferItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setTransferItems([
      ...transferItems,
      {
        product_id: firstProduct.id,
        product_name: firstProduct.name,
        product_sku: firstProduct.sku,
        quantity: 1,
        scanned: false,
      },
    ]);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const updateTransferItem = (index: number, field: keyof TransferItem, value: any) => {
    const newItems = [...transferItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
        newItems[index].product_sku = product.sku;
      }
    }
    
    setTransferItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferItems.length === 0) {
      setError('Please add at least one item to transfer');
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

      if (transfer) {
        // Update existing transfer
        const { error: transferError } = await supabase
          .from('stock_transfers')
          .update({
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            notes: formData.notes,
            status: formData.status,
          })
          .eq('id', transfer.id);

        if (transferError) throw transferError;

        // Delete existing transfer items
        const { error: deleteError } = await supabase
          .from('stock_transfer_items')
          .delete()
          .eq('transfer_id', transfer.id);

        if (deleteError) throw deleteError;

        // Insert updated transfer items
        const { error: itemsError } = await supabase
          .from('stock_transfer_items')
          .insert(
            transferItems.map(item => ({
              transfer_id: transfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
              tenant_id: tenant_id, // Add tenant_id to transfer items
            }))
          );

        if (itemsError) throw itemsError;
      } else {
        // Create new transfer
        const { data: newTransfer, error: transferError } = await supabase
          .from('stock_transfers')
          .insert([{
            from_location_id: formData.from_location_id,
            to_location_id: formData.to_location_id,
            notes: formData.notes + (scanHistory.length > 0 ? ` (Scanned items: ${scanHistory.slice(0, 3).join(', ')})` : ''),
            status: formData.status,
            created_by: user.id,
            tenant_id: tenant_id, // Add tenant_id to the transfer
          }])
          .select()
          .single();

        if (transferError || !newTransfer) throw transferError;

        // Insert transfer items
        const { error: itemsError } = await supabase
          .from('stock_transfer_items')
          .insert(
            transferItems.map(item => ({
              transfer_id: newTransfer.id,
              product_id: item.product_id,
              quantity: item.quantity,
              tenant_id: tenant_id, // Add tenant_id to transfer items
            }))
          );

        if (itemsError) throw itemsError;
      }

      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        from_location_id: '',
        to_location_id: '',
        notes: '',
        status: 'pending',
      });
      setTransferItems([]);
      setScanHistory([]);
    } catch (err) {
      setError('Failed to save transfer');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeLocations = locations.filter(l => l.is_active);
  const scannedItemsCount = transferItems.filter(item => item.scanned).length;
  const totalItemsCount = transferItems.length;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={transfer ? 'Edit Barcode Stock Transfer' : 'Create Barcode Stock Transfer'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Barcode Scanning Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-blue-900 flex items-center">
                <Scan className="h-4 w-4 mr-2" />
                Barcode Scanning
              </h4>
              <div className="flex space-x-2">
                <select
                  value={scanMode}
                  onChange={(e) => setScanMode(e.target.value as 'add' | 'verify')}
                  className="text-xs rounded border-blue-300 bg-blue-50"
                >
                  <option value="add">Add Items</option>
                  <option value="verify">Verify Items</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <Scan className="h-3 w-3 mr-1" />
                  Scan
                </button>
              </div>
            </div>

            {/* Scan Progress */}
            {totalItemsCount > 0 && scanMode === 'verify' && (
              <div className="mb-3">
                <div className="flex justify-between text-sm text-blue-700 mb-1">
                  <span>Verification Progress</span>
                  <span>{scannedItemsCount}/{totalItemsCount}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${totalItemsCount > 0 ? (scannedItemsCount / totalItemsCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">Recent Scans:</p>
                <div className="flex flex-wrap gap-1">
                  {scanHistory.slice(0, 5).map((barcode, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-blue-100 text-blue-700"
                    >
                      {barcode}
                    </span>
                  ))}
                  {scanHistory.length > 5 && (
                    <span className="text-xs text-blue-600">+{scanHistory.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="from_location_id" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="h-4 w-4 inline mr-2" />
                From Location
              </label>
              <select
                id="from_location_id"
                name="from_location_id"
                value={formData.from_location_id}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select source location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.location_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="to_location_id" className="block text-sm font-medium text-gray-700 mb-2">
                <ArrowRightLeft className="h-4 w-4 inline mr-2" />
                To Location
              </label>
              <select
                id="to_location_id"
                name="to_location_id"
                value={formData.to_location_id}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select destination location</option>
                {activeLocations
                  .filter(l => l.id !== formData.from_location_id)
                  .map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name} ({location.location_type})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Transfer Status */}
          {transfer && (
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Transfer Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                <Package className="h-4 w-4 inline mr-2" />
                Transfer Items ({transferItems.length})
              </label>
              <button
                type="button"
                onClick={addTransferItem}
                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Manual
              </button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transferItems.map((item, index) => (
                <div key={index} className={`flex gap-2 items-center border rounded-md p-3 ${
                  item.scanned ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex-1">
                    <select
                      value={item.product_id}
                      onChange={(e) => updateTransferItem(index, 'product_id', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">
                      SKU: {item.product_sku}
                      {item.scanned && (
                        <span className="ml-2 inline-flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Scanned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min="1"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTransferItem(index)}
                    className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {transferItems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No items added yet</p>
                  <p className="text-xs">Scan barcodes or add items manually</p>
                </div>
              )}
            </div>
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
              placeholder="Optional notes about this transfer..."
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
              disabled={isLoading || transferItems.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : transfer ? 'Update Transfer' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title={`Scan to ${scanMode === 'add' ? 'Add Items' : 'Verify Items'}`}
        placeholder="Scan product barcode or enter SKU"
      />
    </>
  );
}