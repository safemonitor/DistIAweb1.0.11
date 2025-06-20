import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  User, Truck, Plus, Pencil, Trash2, Search, Building, MapPin
} from 'lucide-react';
import { LocationModal } from '../components/LocationModal';
import type { Profile, Location } from '../types/database';

export function AgentVehicleManagementPage() {
  const [activeTab, setActiveTab] = useState<'presales' | 'sales' | 'delivery' | 'vehicles'>('presales');
  const [agents, setAgents] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select(`
          *,
          assigned_vehicle:locations!assigned_location_id (
            id,
            name,
            location_type
          )
        `)
        .in('role', ['presales', 'sales', 'delivery'])
        .order('first_name');

      if (agentsError) throw agentsError;
      setAgents(agentsData || []);

      // Fetch vehicles (locations with type 'van')
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('locations')
        .select('*')
        .eq('location_type', 'van')
        .order('name');

      if (vehiclesError) throw vehiclesError;
      setVehicles(vehiclesData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  const handleAssignVehicle = async (agentId: string, vehicleId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ assigned_location_id: vehicleId })
        .eq('id', agentId);

      if (error) throw error;
      await fetchData(); // Refresh data to show updated assignments
    } catch (err) {
      console.error('Error assigning vehicle:', err);
      alert('Failed to assign vehicle');
    }
  };

  const handleAddVehicle = () => {
    setSelectedLocation(undefined);
    setIsLocationModalOpen(true);
  };

  const handleEditVehicle = (vehicle: Location) => {
    setSelectedLocation(vehicle);
    setIsLocationModalOpen(true);
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle? This action cannot be undone.')) return;
    try {
      // First, unassign any agents from this vehicle
      await supabase
        .from('profiles')
        .update({ assigned_location_id: null })
        .eq('assigned_location_id', vehicleId);

      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Failed to delete vehicle');
    }
  };

  const filteredAgents = agents.filter(agent =>
    agent.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (agent.assigned_vehicle?.name && agent.assigned_vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (vehicle.address && vehicle.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderAgentTable = (role: 'presales' | 'sales' | 'delivery') => (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Vehicle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAgents.filter(agent => agent.role === role).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    No {role} agents found.
                  </td>
                </tr>
              ) : (
                filteredAgents.filter(agent => agent.role === role).map(agent => (
                  <tr key={agent.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {agent.first_name} {agent.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {agent.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.assigned_vehicle?.name || 'None'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <select
                        value={agent.assigned_location_id || ''}
                        onChange={(e) => handleAssignVehicle(agent.id, e.target.value || null)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="">Unassign</option>
                        {vehicles.map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent & Vehicle Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage agents and assign them to vehicles for various operations.
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('presales')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'presales'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-5 w-5 inline mr-2" />
            Presales Agents
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sales'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-5 w-5 inline mr-2" />
            Sales Agents
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'delivery'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-5 w-5 inline mr-2" />
            Delivery Agents
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'vehicles'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Truck className="h-5 w-5 inline mr-2" />
            Vehicle Management
          </button>
        </nav>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${activeTab === 'vehicles' ? 'vehicles' : 'agents'}...`}
          className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        />
      </div>

      {activeTab === 'presales' && renderAgentTable('presales')}
      {activeTab === 'sales' && renderAgentTable('sales')}
      {activeTab === 'delivery' && renderAgentTable('delivery')}

      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleAddVehicle}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Vehicle
            </button>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehicle Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                          No vehicles found.
                        </td>
                      </tr>
                    ) : (
                      filteredVehicles.map(vehicle => {
                        const assignedAgent = agents.find(agent => agent.assigned_location_id === vehicle.id);
                        return (
                          <tr key={vehicle.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {vehicle.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {vehicle.address || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {assignedAgent ? `${assignedAgent.first_name} ${assignedAgent.last_name}` : 'Unassigned'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleEditVehicle(vehicle)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteVehicle(vehicle.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </button>
                              </div>
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
      )}

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        location={selectedLocation}
        onSuccess={() => {
          fetchData();
          setIsLocationModalOpen(false);
        }}
      />
    </div>
  );
}