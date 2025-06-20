import { useState } from 'react';
import { TrendingUp, TrendingDown, Plus, Minus, Truck, User } from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Product, Location, Profile } from '../types/database';

interface StockLoadUnloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'load' | 'unload';
  products: Product[];
  agents?: Profile[];
  trucks?: Location[];
  selectedAgentId?: string;
  selectedTruckId?: string;
  onAgentChange?: (agentId: string) => void;
  onTruckChange?: (truckId: string) => void;
  onSuccess: () => void;
}

interface StockItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export function StockLoadUnloadModal({
  isOpen,
  onClose,
  type,
  products,
  agents = [],
  trucks = [],
  selectedAgentId = '',
  selectedTruckId = '',
  onAgentChange,
  onTruckChange,
  onSuccess
}: StockLoadUnloadModalProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [notes, setNotes] = useState('');
  const [agentId, setAgentId] = useState(selectedAgentId);
  const [truckId, setTruckId] = useState(selectedTruckId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => {
    setAgentId(selectedAgentId);
  }, [selectedAgentId]);

  useEffect(() => {
    setTruckId(selectedTruckId);
  }, [selectedTruckId]);

  const addStockItem = () => {
    if (products.length === 0) return;
    
    const firstProduct = products[0];
    setStockItems([
      ...stockItems,
      {
        product_id: firstProduct.id,
        product_name: firstProduct.name,
        quantity: 1
      }
    ]);
  };

  const removeStockItem = (index: number) => {
    setStockItems(stockItems.filter((_, i) => i !== index));
  };

  const updateStockItem = (index: number, field: keyof StockItem, value: any) => {
    const newItems = [...stockItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].product_name = product.name;
      }
    }
    
    setStockItems(newItems);
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentId = e.target.value;
    setAgentId(newAgentId);
    if (onAgentChange) {
      onAgentChange(newAgentId);
    }
  };

  const handleTruckChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTruckId = e.target.value;
    setTruckId(newTruckId);
    if (onTruckChange) {
      onTruckChange(newTruckId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stockItems.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (!agentId) {
      setError('Please select a sales agent');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create stock movements
      const movements = stockItems.map(item => ({
        profile_id: agentId,
        product_id: item.product_id,
        movement_type: type,
        quantity: type === 'unload' ? -item.quantity : item.quantity,
        notes: notes || `${type === 'load' ? 'Loaded' : 'Unloaded'} ${item.quantity} units of ${item.product_name}${truckId ? ` to truck ${trucks.find(t => t.id === truckId)?.name || truckId}` : ''}`
      }));

      const { error: movementsError } = await supabase
        .from('van_stock_movements')
        .insert(movements);

      if (movementsError) throw movementsError;

      // Reset form
      setStockItems([]);
      setNotes('');
      onSuccess();
    } catch (err) {
      console.error('Error processing stock movement:', err);
      setError('Failed to process stock movement');
    } finally {
      setIsLoading(false);
    }
  };

  const Icon = type === 'load' ? TrendingUp : TrendingDown;
  const title = type === 'load' ? 'Load Stock onto Van' : 'Unload Stock from Van';
  const buttonText = type === 'load' ? 'Load Stock' : 'Unload Stock';
  const buttonColor = type === 'load' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
          <Icon className="h-5 w-5" />
          <span>
            {type === 'load' 
              ? 'Add products to your van inventory from the warehouse'
              : 'Remove products from your van inventory back to the warehouse'
            }
          </span>
        </div>

        {/* Agent and Truck Selection */}
        {agents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent_id" className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-2" />
                Sales Agent
              </label>
              <select
                id="agent_id"
                value={agentId}
                onChange={handleAgentChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="truck_id" className="block text-sm font-medium text-gray-700 mb-1">
                <Truck className="h-4 w-4 inline mr-2" />
                Truck/Van
              </label>
              <select
                id="truck_id"
                value={truckId}
                onChange={handleTruckChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Stock Items
            </label>
            <button
              type="button"
              onClick={addStockItem}
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>
          
          <div className="space-y-2">
            {stockItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start border rounded-md p-2">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateStockItem(index, 'product_id', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (${product.price})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateStockItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    min="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStockItem(index)}
                  className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Add any notes about this stock movement..."
          />
        </div>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            disabled={isLoading || stockItems.length === 0 || !agentId}
            className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50 ${buttonColor}`}
          >
            {isLoading ? 'Processing...' : buttonText}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}