import { useState, useEffect } from 'react';
import { ArrowUpDown, TrendingUp, TrendingDown, Package, Plus, User, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StockLoadUnloadModal } from './StockLoadUnloadModal';
import type { VanStockMovement, Product, Profile, Location } from '../types/database';

interface VanStockMovementsProps {
  movements: VanStockMovement[];
  products: Product[];
  selectedAgentId?: string;
  selectedTruckId?: string;
  onAgentChange?: (agentId: string) => void;
  onTruckChange?: (truckId: string) => void;
  onMovementCreated: () => void;
}

export function VanStockMovements({ 
  movements, 
  products, 
  selectedAgentId = '',
  selectedTruckId = '',
  onAgentChange,
  onTruckChange,
  onMovementCreated 
}: VanStockMovementsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'load' | 'unload'>('load');
  const [salesAgents, setSalesAgents] = useState<Profile[]>([]);
  const [trucks, setTrucks] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAgentsAndTrucks();
  }, []);

  async function fetchAgentsAndTrucks() {
    try {
      setIsLoading(true);
      
      // Fetch sales agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'sales');

      if (agentsError) throw agentsError;
      setSalesAgents(agentsData || []);

      // Fetch trucks (locations with van type)
      const { data: trucksData, error: trucksError } = await supabase
        .from('locations')
        .select('*')
        .eq('location_type', 'van')
        .eq('is_active', true);

      if (trucksError) throw trucksError;
      setTrucks(trucksData || []);
    } catch (err) {
      console.error('Error fetching agents and trucks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const getMovementIcon = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return TrendingUp;
      case 'unload':
        return TrendingDown;
      case 'sale':
        return Package;
      default:
        return ArrowUpDown;
    }
  };

  const getMovementColor = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return 'text-green-600';
      case 'unload':
        return 'text-blue-600';
      case 'sale':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getMovementBgColor = (type: VanStockMovement['movement_type']) => {
    switch (type) {
      case 'load':
        return 'bg-green-100';
      case 'unload':
        return 'bg-blue-100';
      case 'sale':
        return 'bg-purple-100';
      default:
        return 'bg-gray-100';
    }
  };

  const handleLoadStock = () => {
    setModalType('load');
    setIsModalOpen(true);
  };

  const handleUnloadStock = () => {
    setModalType('unload');
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Stock Movements</h2>
          <p className="mt-1 text-sm text-gray-600">
            Track all stock movements for your van inventory
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex sm:space-x-3">
          <button
            onClick={handleLoadStock}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Load Stock
          </button>
          <button
            onClick={handleUnloadStock}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            Unload Stock
          </button>
        </div>
      </div>

      {/* Agent and Truck Selection (if not provided via props) */}
      {(!selectedAgentId || !selectedTruckId) && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Select Agent and Truck</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="agent_select" className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-2" />
                Sales Agent
              </label>
              <select
                id="agent_select"
                value={selectedAgentId}
                onChange={(e) => onAgentChange && onAgentChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select an agent</option>
                {salesAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="truck_select" className="block text-sm font-medium text-gray-700 mb-1">
                <Truck className="h-4 w-4 inline mr-2" />
                Truck/Van
              </label>
              <select
                id="truck_select"
                value={selectedTruckId}
                onChange={(e) => onTruckChange && onTruckChange(e.target.value)}
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
        </div>
      )}

      {/* Movements List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          {movements.length === 0 ? (
            <div className="text-center py-8">
              <ArrowUpDown className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No stock movements</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start by loading stock onto your van or making sales.
              </p>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8">
                {movements.map((movement, movementIdx) => {
                  const Icon = getMovementIcon(movement.movement_type);
                  const iconColor = getMovementColor(movement.movement_type);
                  const bgColor = getMovementBgColor(movement.movement_type);

                  return (
                    <li key={movement.id}>
                      <div className="relative pb-8">
                        {movementIdx !== movements.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${bgColor}`}>
                              <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900">
                                <span className="font-medium capitalize">{movement.movement_type}</span>
                                {' '}
                                <span className="font-medium">
                                  {Math.abs(movement.quantity)} units
                                </span>
                                {' '}of {movement.product?.name}
                              </p>
                              {movement.notes && (
                                <p className="text-sm text-gray-500">{movement.notes}</p>
                              )}
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time dateTime={movement.created_at}>
                                {new Date(movement.created_at).toLocaleString()}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Stock Load/Unload Modal */}
      <StockLoadUnloadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        products={products}
        agents={salesAgents}
        trucks={trucks}
        selectedAgentId={selectedAgentId}
        selectedTruckId={selectedTruckId}
        onAgentChange={onAgentChange}
        onTruckChange={onTruckChange}
        onSuccess={() => {
          onMovementCreated();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}