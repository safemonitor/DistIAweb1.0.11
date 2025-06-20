import { useState, useEffect } from 'react';
import { 
  User, 
  Truck, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  Link as LinkIcon,
  Unlink,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';
import { useAuthStore } from '../store/authStore';
import type { Profile, Location } from '../types/database';

interface AgentVehicleManagementProps {
  moduleType: 'presales' | 'sales' | 'delivery';
}

export function AgentVehicleManagement({ moduleType }: AgentVehicleManagementProps) {
  // State for agents and vehicles
  const [agents, setAgents] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<Location[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'agents' | 'vehicles'>('agents');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAssignUserModalOpen, setIsAssignUserModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Profile | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Location | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedVehicleForNewAgent, setSelectedVehicleForNewAgent] = useState<string>('');
  
  // Form state
  const [agentForm, setAgentForm] = useState({
    first_name: '',
    last_name: '',
    role: moduleType === 'presales' ? 'presales' : moduleType === 'sales' ? 'sales' : 'delivery'
  });
  
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    description: '',
    location_type: 'van',
    address: '',
    is_active: true,
    immatriculation: '',
    assigned_agent_id: ''
  });

  const { profile: currentUserProfile } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, [moduleType]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch agents based on module type
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', moduleType === 'presales' ? 'presales' : moduleType === 'sales' ? 'sales' : 'delivery')
        .order('first_name');
      
      if (agentsError) throw agentsError;
      
      // Fetch vehicles (locations with type 'van')
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('locations')
        .select('*')
        .eq('location_type', 'van')
        .order('name');
      
      if (vehiclesError) throw vehiclesError;
      
      // Fetch agent-vehicle assignments
      const assignmentsMap: Record<string, string> = {};
      
      for (const agent of agentsData || []) {
        if (agent.assigned_location_id) {
          assignmentsMap[agent.id] = agent.assigned_location_id;
        }
      }
      
      // Fetch available users (users in the same tenant who are not already agents)
      // Only apply tenant_id filter if currentUserProfile.tenant_id is not null
      let usersQuery = supabase
        .from('profiles')
        .select('*')
        .not('role', 'eq', 'presales')
        .not('role', 'eq', 'sales')
        .not('role', 'eq', 'delivery')
        .order('first_name');
      
      // Only filter by tenant_id if it's not null (for non-superadmin users)
      if (currentUserProfile?.tenant_id) {
        usersQuery = usersQuery.eq('tenant_id', currentUserProfile.tenant_id);
      }
      
      const { data: usersData, error: usersError } = await usersQuery;
      
      if (usersError) throw usersError;
      
      setAgents(agentsData || []);
      setVehicles(vehiclesData || []);
      setAssignments(assignmentsMap);
      setAvailableUsers(usersData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;
    
    try {
      setIsLoading(true);
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: agentForm.first_name,
          last_name: agentForm.last_name,
        })
        .eq('id', selectedAgent.id);
      
      if (profileError) throw profileError;
      
      // Reset form and close modal
      setAgentForm({
        first_name: '',
        last_name: '',
        role: moduleType === 'presales' ? 'presales' : moduleType === 'sales' ? 'sales' : 'delivery'
      });
      
      setIsAgentModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error updating agent:', err);
      setError('Failed to update agent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignUserAsAgent = async () => {
    if (!selectedUserId) return;
    
    try {
      setIsLoading(true);
      
      // Update the user's role to make them an agent
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: moduleType === 'presales' ? 'presales' : moduleType === 'sales' ? 'sales' : 'delivery'
        })
        .eq('id', selectedUserId);
      
      if (updateError) throw updateError;
      
      // If a vehicle was selected, assign it to the agent
      if (selectedVehicleForNewAgent) {
        const { error: assignError } = await supabase
          .from('profiles')
          .update({ assigned_location_id: selectedVehicleForNewAgent })
          .eq('id', selectedUserId);
        
        if (assignError) throw assignError;
      }
      
      setIsAssignUserModalOpen(false);
      setSelectedUserId('');
      setSelectedVehicleForNewAgent('');
      fetchData();
    } catch (err) {
      console.error('Error assigning user as agent:', err);
      setError('Failed to assign user as agent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAgent = async (agent: Profile) => {
    if (!confirm(`Are you sure you want to delete ${agent.first_name} ${agent.last_name}?`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', agent.id);
      
      if (profileError) throw profileError;
      
      fetchData();
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVehicle = async () => {
    try {
      setIsLoading(true);
      
      // Create location
      const { data: newVehicle, error: locationError } = await supabase
        .from('locations')
        .insert([{
          name: vehicleForm.name,
          description: vehicleForm.description,
          location_type: 'van',
          address: vehicleForm.address,
          is_active: vehicleForm.is_active,
          immatriculation: vehicleForm.immatriculation
        }])
        .select()
        .single();
      
      if (locationError) throw locationError;
      
      // If an agent was selected, assign the vehicle to them
      if (vehicleForm.assigned_agent_id && newVehicle) {
        const { error: assignError } = await supabase
          .from('profiles')
          .update({ assigned_location_id: newVehicle.id })
          .eq('id', vehicleForm.assigned_agent_id);
        
        if (assignError) throw assignError;
      }
      
      // Reset form and close modal
      setVehicleForm({
        name: '',
        description: '',
        location_type: 'van',
        address: '',
        is_active: true,
        immatriculation: '',
        assigned_agent_id: ''
      });
      
      setIsVehicleModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error creating vehicle:', err);
      setError('Failed to create vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!selectedVehicle) return;
    
    try {
      setIsLoading(true);
      
      // Update location
      const { error: locationError } = await supabase
        .from('locations')
        .update({
          name: vehicleForm.name,
          description: vehicleForm.description,
          address: vehicleForm.address,
          is_active: vehicleForm.is_active,
          immatriculation: vehicleForm.immatriculation
        })
        .eq('id', selectedVehicle.id);
      
      if (locationError) throw locationError;
      
      // If an agent was selected, assign the vehicle to them
      if (vehicleForm.assigned_agent_id) {
        // First, unassign any existing agents from this vehicle
        const assignedAgents = agents.filter(agent => agent.assigned_location_id === selectedVehicle.id);
        for (const agent of assignedAgents) {
          if (agent.id !== vehicleForm.assigned_agent_id) {
            await supabase
              .from('profiles')
              .update({ assigned_location_id: null })
              .eq('id', agent.id);
          }
        }
        
        // Then assign the vehicle to the selected agent
        const { error: assignError } = await supabase
          .from('profiles')
          .update({ assigned_location_id: selectedVehicle.id })
          .eq('id', vehicleForm.assigned_agent_id);
        
        if (assignError) throw assignError;
      }
      
      // Reset form and close modal
      setVehicleForm({
        name: '',
        description: '',
        location_type: 'van',
        address: '',
        is_active: true,
        immatriculation: '',
        assigned_agent_id: ''
      });
      
      setIsVehicleModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error updating vehicle:', err);
      setError('Failed to update vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Location) => {
    if (!confirm(`Are you sure you want to delete ${vehicle.name}?`)) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Check if any agents are assigned to this vehicle
      const assignedAgents = Object.entries(assignments)
        .filter(([_, vehicleId]) => vehicleId === vehicle.id)
        .map(([agentId, _]) => agentId);
      
      if (assignedAgents.length > 0) {
        // Unassign all agents from this vehicle
        for (const agentId of assignedAgents) {
          await supabase
            .from('profiles')
            .update({ assigned_location_id: null })
            .eq('id', agentId);
        }
      }
      
      // Delete location
      const { error: locationError } = await supabase
        .from('locations')
        .delete()
        .eq('id', vehicle.id);
      
      if (locationError) throw locationError;
      
      fetchData();
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      setError('Failed to delete vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignVehicle = async (agent: Profile, vehicle: Location) => {
    try {
      setIsLoading(true);
      
      // Update profile with assigned_location_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ assigned_location_id: vehicle.id })
        .eq('id', agent.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setAssignments(prev => ({
        ...prev,
        [agent.id]: vehicle.id
      }));
      
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error assigning vehicle:', err);
      setError('Failed to assign vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignVehicle = async (agent: Profile) => {
    try {
      setIsLoading(true);
      
      // Update profile to remove assigned_location_id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ assigned_location_id: null })
        .eq('id', agent.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      const newAssignments = { ...assignments };
      delete newAssignments[agent.id];
      setAssignments(newAssignments);
      
      fetchData();
    } catch (err) {
      console.error('Error unassigning vehicle:', err);
      setError('Failed to unassign vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAgentModal = (agent?: Profile) => {
    if (agent) {
      setSelectedAgent(agent);
      setAgentForm({
        first_name: agent.first_name,
        last_name: agent.last_name,
        role: agent.role
      });
    } else {
      setSelectedAgent(null);
      setAgentForm({
        first_name: '',
        last_name: '',
        role: moduleType === 'presales' ? 'presales' : moduleType === 'sales' ? 'sales' : 'delivery'
      });
    }
    
    setIsAgentModalOpen(true);
  };

  const openVehicleModal = (vehicle?: Location) => {
    if (vehicle) {
      setSelectedVehicle(vehicle);
      
      // Find the agent assigned to this vehicle
      const assignedAgentId = Object.entries(assignments)
        .find(([_, vehicleId]) => vehicleId === vehicle.id)?.[0] || '';
      
      setVehicleForm({
        name: vehicle.name,
        description: vehicle.description || '',
        location_type: 'van',
        address: vehicle.address || '',
        is_active: vehicle.is_active,
        immatriculation: vehicle.immatriculation || '',
        assigned_agent_id: assignedAgentId
      });
    } else {
      setSelectedVehicle(null);
      setVehicleForm({
        name: '',
        description: '',
        location_type: 'van',
        address: '',
        is_active: true,
        immatriculation: '',
        assigned_agent_id: ''
      });
    }
    
    setIsVehicleModalOpen(true);
  };

  const openAssignModal = (agent: Profile) => {
    setSelectedAgent(agent);
    setIsAssignModalOpen(true);
  };

  const openAssignUserModal = () => {
    setIsAssignUserModalOpen(true);
  };

  const getModuleTitle = () => {
    switch (moduleType) {
      case 'presales':
        return 'Presales Agents & Vehicles';
      case 'sales':
        return 'Sales Agents & Vehicles';
      case 'delivery':
        return 'Delivery Agents & Vehicles';
      default:
        return 'Agents & Vehicles';
    }
  };

  const getModuleDescription = () => {
    switch (moduleType) {
      case 'presales':
        return 'Manage presales agents and assign vehicles for route planning';
      case 'sales':
        return 'Manage sales agents and assign vehicles for van sales operations';
      case 'delivery':
        return 'Manage delivery agents and assign vehicles for delivery operations';
      default:
        return 'Manage agents and vehicles';
    }
  };

  const getAgentRoleName = () => {
    switch (moduleType) {
      case 'presales':
        return 'Presales Agent';
      case 'sales':
        return 'Sales Agent';
      case 'delivery':
        return 'Delivery Agent';
      default:
        return 'Agent';
    }
  };

  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      agent.first_name.toLowerCase().includes(searchLower) ||
      agent.last_name.toLowerCase().includes(searchLower) ||
      agent.id.toLowerCase().includes(searchLower)
    );
  });

  const filteredVehicles = vehicles.filter(vehicle => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      vehicle.name.toLowerCase().includes(searchLower) ||
      (vehicle.description && vehicle.description.toLowerCase().includes(searchLower)) ||
      (vehicle.address && vehicle.address.toLowerCase().includes(searchLower)) ||
      (vehicle.immatriculation && vehicle.immatriculation.toLowerCase().includes(searchLower))
    );
  });

  const getVehicleForAgent = (agentId: string) => {
    const vehicleId = assignments[agentId];
    return vehicleId ? vehicles.find(v => v.id === vehicleId) : null;
  };

  const getAgentsForVehicle = (vehicleId: string) => {
    return agents.filter(agent => assignments[agent.id] === vehicleId);
  };

  if (isLoading && agents.length === 0 && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{getModuleTitle()}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {getModuleDescription()}
          </p>
        </div>
      </div>

      {/* Error display */}
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('agents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'agents'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="h-5 w-5" />
            <span>Agents</span>
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'vehicles'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Truck className="h-5 w-5" />
            <span>Vehicles</span>
          </button>
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div className="relative max-w-md w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          />
        </div>
        
        {activeTab === 'agents' ? (
          <button
            onClick={openAssignUserModal}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Assign User as {getAgentRoleName()}
          </button>
        ) : (
          <button
            onClick={() => openVehicleModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </button>
        )}
      </div>

      {/* Agents Tab Content */}
      {activeTab === 'agents' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Vehicle
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm 
                        ? 'No agents found matching your search.' 
                        : `No ${moduleType} agents found. Click "Assign User as ${getAgentRoleName()}" to assign a user.`
                      }
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const assignedVehicle = getVehicleForAgent(agent.id);
                    
                    return (
                      <tr key={agent.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <span className="text-indigo-800 font-medium">
                                {agent.first_name.charAt(0)}{agent.last_name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {agent.first_name} {agent.last_name}
                              </div>
                              <div className="text-sm text-gray-500 capitalize">
                                {agent.role}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {agent.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {assignedVehicle ? (
                            <div className="flex items-center">
                              <Truck className="h-4 w-4 text-green-500 mr-2" />
                              <div>
                                <span className="text-sm text-gray-900">{assignedVehicle.name}</span>
                                {assignedVehicle.immatriculation && (
                                  <div className="text-xs text-gray-500">
                                    <CreditCard className="h-3 w-3 inline mr-1" />
                                    {assignedVehicle.immatriculation}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No vehicle assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => openAgentModal(agent)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit Agent"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {assignedVehicle ? (
                              <button
                                onClick={() => handleUnassignVehicle(agent)}
                                className="text-orange-600 hover:text-orange-900"
                                title="Unassign Vehicle"
                              >
                                <Unlink className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => openAssignModal(agent)}
                                className="text-green-600 hover:text-green-900"
                                title="Assign Vehicle"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAgent(agent)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Agent"
                            >
                              <Trash2 className="h-4 w-4" />
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
      )}

      {/* Vehicles Tab Content */}
      {activeTab === 'vehicles' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Immatriculation
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Agents
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm 
                        ? 'No vehicles found matching your search.' 
                        : 'No vehicles found. Click "Add Vehicle" to create one.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const assignedAgents = getAgentsForVehicle(vehicle.id);
                    
                    return (
                      <tr key={vehicle.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Truck className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {vehicle.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {vehicle.address || 'No address'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {vehicle.immatriculation || 'Not specified'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {vehicle.description || 'No description'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            vehicle.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {vehicle.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {assignedAgents.length === 0 ? (
                            <span>No agents assigned</span>
                          ) : (
                            <div className="flex flex-col space-y-1">
                              {assignedAgents.map(agent => (
                                <div key={agent.id} className="flex items-center">
                                  <User className="h-3 w-3 text-gray-400 mr-1" />
                                  <span>{agent.first_name} {agent.last_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => openVehicleModal(vehicle)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit Vehicle"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVehicle(vehicle)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Vehicle"
                            >
                              <Trash2 className="h-4 w-4" />
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
      )}

      {/* Agent Modal */}
      <Modal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        title={selectedAgent ? 'Edit Agent' : `Add ${getAgentRoleName()}`}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          handleUpdateAgent();
        }}>
          <div className="space-y-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                First Name
              </label>
              <input
                type="text"
                id="first_name"
                value={agentForm.first_name}
                onChange={(e) => setAgentForm(prev => ({ ...prev, first_name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                Last Name
              </label>
              <input
                type="text"
                id="last_name"
                value={agentForm.last_name}
                onChange={(e) => setAgentForm(prev => ({ ...prev, last_name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <input
                type="text"
                id="role"
                value={agentForm.role}
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                disabled
              />
            </div>
          </div>
          
          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setIsAgentModalOpen(false)}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Vehicle Modal */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        title={selectedVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          selectedVehicle ? handleUpdateVehicle() : handleCreateVehicle();
        }}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Vehicle Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={vehicleForm.name}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="immatriculation" className="block text-sm font-medium text-gray-700">
                Immatriculation
              </label>
              <input
                type="text"
                id="immatriculation"
                name="immatriculation"
                value={vehicleForm.immatriculation}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, immatriculation: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Vehicle registration number"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={vehicleForm.description}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address/Location
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={vehicleForm.address}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="assigned_agent_id" className="block text-sm font-medium text-gray-700">
                Assign to Agent (Optional)
              </label>
              <select
                id="assigned_agent_id"
                name="assigned_agent_id"
                value={vehicleForm.assigned_agent_id}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, assigned_agent_id: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">No assignment</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.first_name} {agent.last_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This will assign the vehicle to the selected agent. If the agent already has a vehicle assigned, it will be replaced.
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={vehicleForm.is_active}
                onChange={(e) => setVehicleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>
          </div>
          
          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {selectedVehicle ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setIsVehicleModalOpen(false)}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Vehicle Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Vehicle"
      >
        <div className="space-y-4">
          {selectedAgent && (
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-800 font-medium">
                    {selectedAgent.first_name.charAt(0)}{selectedAgent.last_name.charAt(0)}
                  </span>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {selectedAgent.first_name} {selectedAgent.last_name}
                  </div>
                  <div className="text-sm text-gray-500 capitalize">
                    {selectedAgent.role}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Vehicle
            </label>
            
            {vehicles.length === 0 ? (
              <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                No vehicles available. Please create a vehicle first.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {vehicles.filter(v => v.is_active).map((vehicle) => {
                  const isAssigned = Object.values(assignments).includes(vehicle.id);
                  
                  return (
                    <div 
                      key={vehicle.id} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        isAssigned 
                          ? 'border-gray-300 bg-gray-50' 
                          : 'border-indigo-300 hover:bg-indigo-50'
                      }`}
                      onClick={() => {
                        if (!isAssigned && selectedAgent) {
                          handleAssignVehicle(selectedAgent, vehicle);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Truck className="h-5 w-5 text-indigo-500 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{vehicle.name}</div>
                            {vehicle.immatriculation && (
                              <div className="text-xs text-gray-500">
                                <CreditCard className="h-3 w-3 inline mr-1" />
                                {vehicle.immatriculation}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">{vehicle.address || 'No address'}</div>
                          </div>
                        </div>
                        
                        {isAssigned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Assigned
                          </span>
                        ) : (
                          <CheckCircle className="h-5 w-5 text-indigo-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="mt-5 sm:mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign User as Agent Modal */}
      <Modal
        isOpen={isAssignUserModalOpen}
        onClose={() => setIsAssignUserModalOpen(false)}
        title={`Assign User as ${getAgentRoleName()}`}
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          handleAssignUserAsAgent();
        }}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Select an existing user to assign as a {getAgentRoleName().toLowerCase()}. This will change their role in the system.
            </p>
            
            <div>
              <label htmlFor="user_id" className="block text-sm font-medium text-gray-700">
                Select User
              </label>
              <select
                id="user_id"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select a user</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="vehicle_id" className="block text-sm font-medium text-gray-700">
                Assign Vehicle (Optional)
              </label>
              <select
                id="vehicle_id"
                value={selectedVehicleForNewAgent}
                onChange={(e) => setSelectedVehicleForNewAgent(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">No vehicle</option>
                {vehicles.filter(v => v.is_active).map((vehicle) => {
                  const isAssigned = Object.values(assignments).includes(vehicle.id);
                  return (
                    <option key={vehicle.id} value={vehicle.id} disabled={isAssigned}>
                      {vehicle.name} {vehicle.immatriculation ? `(${vehicle.immatriculation})` : ''} 
                      {isAssigned ? ' - Already assigned' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                You can optionally assign a vehicle to this agent immediately.
              </p>
            </div>
            
            {availableUsers.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      No available users found. Please add users in the User Management section first.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              disabled={!selectedUserId || availableUsers.length === 0}
              className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Assign as {getAgentRoleName()}
            </button>
            <button
              type="button"
              onClick={() => setIsAssignUserModalOpen(false)}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}