import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { Plus, Minus, User, Users, Calendar, Pencil, Trash2 } from 'lucide-react';
import type { Route, Customer, Profile, RouteCustomer, RouteAgentAssignment } from '../types/database';

interface RouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  route?: Route;
  customers: Customer[];
  agents: Profile[];
  routeCustomers: RouteCustomer[];
  routeAgents: RouteAgentAssignment[];
  moduleType: 'presales' | 'sales' | 'delivery';
  onSuccess: () => void;
}

export function RouteModal({ 
  isOpen, 
  onClose, 
  route, 
  customers, 
  agents,
  routeCustomers,
  routeAgents,
  moduleType,
  onSuccess 
}: RouteModalProps) {
  const [formData, setFormData] = useState({
    name: route?.name || '',
    description: route?.description || '',
    type: route?.type || moduleType === 'sales' ? 'sales' : 'delivery',
  });
  
  // State for route customers
  const [selectedCustomers, setSelectedCustomers] = useState<RouteCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // State for route agents
  const [selectedAgents, setSelectedAgents] = useState<RouteAgentAssignment[]>([]);
  const [newAgentData, setNewAgentData] = useState({
    agent_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_recurring: false,
    assigned_days_of_week: [1, 2, 3, 4, 5], // Monday to Friday by default
  });
  
  const [activeTab, setActiveTab] = useState<'details' | 'customers' | 'agents'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing route customers and agents when route changes
  useEffect(() => {
    if (route) {
      // Filter route customers for this route
      const routeCustomersList = routeCustomers.filter(rc => rc.route_id === route.id);
      setSelectedCustomers(routeCustomersList);
      
      // Filter route agents for this route
      const routeAgentsList = routeAgents.filter(ra => ra.route_id === route.id);
      setSelectedAgents(routeAgentsList);
    } else {
      setSelectedCustomers([]);
      setSelectedAgents([]);
    }
  }, [route, routeCustomers, routeAgents]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleAgentDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setNewAgentData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };
  
  const handleDayOfWeekToggle = (day: number) => {
    setNewAgentData(prev => {
      const currentDays = [...prev.assigned_days_of_week];
      if (currentDays.includes(day)) {
        return {
          ...prev,
          assigned_days_of_week: currentDays.filter(d => d !== day)
        };
      } else {
        return {
          ...prev,
          assigned_days_of_week: [...currentDays, day].sort()
        };
      }
    });
  };

  const addCustomerToRoute = async () => {
    if (!selectedCustomerId) return;
    
    // Check if customer is already added
    if (selectedCustomers.some(c => c.customer_id === selectedCustomerId)) {
      setError('This customer is already added to the route');
      return;
    }
    
    // Add customer to local state
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) {
      const newRouteCustomer: RouteCustomer = {
        id: `temp-${Date.now()}`, // Temporary ID until saved
        route_id: route?.id || '',
        customer_id: customer.id,
        sequence_number: selectedCustomers.length + 1,
        assigned_date: new Date().toISOString(),
        notes: '',
        created_at: new Date().toISOString(),
        customer
      };
      
      setSelectedCustomers([...selectedCustomers, newRouteCustomer]);
      setSelectedCustomerId('');
    }
  };
  
  const removeCustomerFromRoute = (customerId: string) => {
    setSelectedCustomers(selectedCustomers.filter(c => c.customer_id !== customerId));
  };
  
  const addAgentToRoute = () => {
    if (!newAgentData.agent_id) return;
    
    // Check if agent is already added with overlapping dates
    const agent = agents.find(a => a.id === newAgentData.agent_id);
    if (!agent) return;
    
    const newRouteAgent: RouteAgentAssignment = {
      id: `temp-${Date.now()}`, // Temporary ID until saved
      route_id: route?.id || '',
      agent_id: agent.id,
      start_date: newAgentData.start_date,
      end_date: newAgentData.end_date || null,
      assigned_days_of_week: newAgentData.assigned_days_of_week,
      is_recurring: newAgentData.is_recurring,
      notes: '',
      created_at: new Date().toISOString(),
      agent
    };
    
    setSelectedAgents([...selectedAgents, newRouteAgent]);
    
    // Reset form
    setNewAgentData({
      agent_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      is_recurring: false,
      assigned_days_of_week: [1, 2, 3, 4, 5],
    });
  };
  
  const removeAgentFromRoute = (assignmentId: string) => {
    setSelectedAgents(selectedAgents.filter(a => a.id !== assignmentId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Get the user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      const tenant_id = userProfile.tenant_id;
      
      let routeId = route?.id;
      
      if (route) {
        // Update existing route
        const { error } = await supabase
          .from('routes')
          .update({
            name: formData.name,
            description: formData.description,
            type: formData.type,
          })
          .eq('id', route.id);

        if (error) throw error;
      } else {
        // Create new route
        const { data, error } = await supabase
          .from('routes')
          .insert([{
            name: formData.name,
            description: formData.description,
            type: formData.type,
            tenant_id: tenant_id, // Ensure tenant_id is set
          }])
          .select();

        if (error) throw error;
        routeId = data[0].id;
      }
      
      if (routeId) {
        // Handle route customers
        
        // Get existing route customers from database
        const { data: existingCustomers, error: customersError } = await supabase
          .from('route_customers')
          .select('*')
          .eq('route_id', routeId);
          
        if (customersError) throw customersError;
        
        // Determine which customers to add and which to remove
        const existingCustomerIds = (existingCustomers || []).map(c => c.customer_id);
        const selectedCustomerIds = selectedCustomers.map(c => c.customer_id);
        
        // Customers to add
        const customersToAdd = selectedCustomers.filter(c => 
          !existingCustomerIds.includes(c.customer_id) || c.id.startsWith('temp-')
        );
        
        // Customers to remove
        const customerIdsToRemove = existingCustomerIds.filter(id => 
          !selectedCustomerIds.includes(id)
        );
        
        // Add new customers
        if (customersToAdd.length > 0) {
          const { error: addError } = await supabase
            .from('route_customers')
            .insert(
              customersToAdd.map(c => ({
                route_id: routeId,
                customer_id: c.customer_id,
                sequence_number: c.sequence_number,
                notes: c.notes,
                tenant_id: tenant_id, // Add tenant_id to route_customers
              }))
            );
            
          if (addError) throw addError;
        }
        
        // Remove customers
        if (customerIdsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('route_customers')
            .delete()
            .eq('route_id', routeId)
            .in('customer_id', customerIdsToRemove);
            
          if (removeError) throw removeError;
        }
        
        // Handle route agents
        
        // Get existing route agents from database
        const { data: existingAgents, error: agentsError } = await supabase
          .from('route_agent_assignments')
          .select('*')
          .eq('route_id', routeId);
          
        if (agentsError) throw agentsError;
        
        // Determine which agents to add and which to remove
        const existingAgentIds = (existingAgents || []).map(a => a.id);
        const selectedAgentIds = selectedAgents.map(a => a.id);
        
        // Agents to add
        const agentsToAdd = selectedAgents.filter(a => a.id.startsWith('temp-'));
        
        // Agents to remove
        const agentIdsToRemove = existingAgentIds.filter(id => 
          !selectedAgentIds.includes(id) || selectedAgentIds.includes(id) && id.startsWith('temp-')
        );
        
        // Add new agents
        if (agentsToAdd.length > 0) {
          const { error: addError } = await supabase
            .from('route_agent_assignments')
            .insert(
              agentsToAdd.map(a => ({
                route_id: routeId,
                agent_id: a.agent_id,
                start_date: a.start_date,
                end_date: a.end_date,
                assigned_days_of_week: a.assigned_days_of_week,
                is_recurring: a.is_recurring,
                notes: a.notes,
                tenant_id: tenant_id, // Add tenant_id to route_agent_assignments
              }))
            );
            
          if (addError) throw addError;
        }
        
        // Remove agents
        if (agentIdsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('route_agent_assignments')
            .delete()
            .eq('route_id', routeId)
            .in('id', agentIdsToRemove);
            
          if (removeError) throw removeError;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to save route');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const getDayName = (day: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={route ? 'Edit Route' : 'Add Route'}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Route Details
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customers'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Customers ({selectedCustomers.length})
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agents'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Agents ({selectedAgents.length})
            </button>
          </nav>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Route Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Route Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="delivery">Delivery</option>
                  <option value="sales">Sales</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          )}
          
          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label htmlFor="customer-select" className="block text-sm font-medium text-gray-700">
                    Add Customer to Route
                  </label>
                  <select
                    id="customer-select"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select a customer</option>
                    {customers
                      .filter(c => !selectedCustomers.some(sc => sc.customer_id === c.id))
                      .map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.email}
                        </option>
                      ))
                    }
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addCustomerToRoute}
                    disabled={!selectedCustomerId}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Customers on this Route</h4>
                {selectedCustomers.length === 0 ? (
                  <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                    No customers added to this route yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
                    {selectedCustomers.map((routeCustomer, index) => (
                      <li key={routeCustomer.id} className="px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {routeCustomer.customer?.name || 'Unknown Customer'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Sequence: {index + 1}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomerFromRoute(routeCustomer.customer_id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          
          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Assign Agent to Route</h4>
                
                <div>
                  <label htmlFor="agent-select" className="block text-sm font-medium text-gray-700">
                    Agent
                  </label>
                  <select
                    id="agent-select"
                    name="agent_id"
                    value={newAgentData.agent_id}
                    onChange={handleAgentDataChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select an agent</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.first_name} {agent.last_name} ({agent.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      name="start_date"
                      value={newAgentData.start_date}
                      onChange={handleAgentDataChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      name="end_date"
                      value={newAgentData.end_date}
                      onChange={handleAgentDataChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is-recurring"
                      name="is_recurring"
                      checked={newAgentData.is_recurring}
                      onChange={handleAgentDataChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is-recurring" className="ml-2 block text-sm font-medium text-gray-700">
                      Recurring Assignment
                    </label>
                  </div>
                </div>
                
                {newAgentData.is_recurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Days of Week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayOfWeekToggle(day)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            newAgentData.assigned_days_of_week.includes(day)
                              ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-300'
                              : 'bg-gray-100 text-gray-800 border-2 border-gray-200'
                          }`}
                        >
                          {getDayName(day).substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addAgentToRoute}
                    disabled={!newAgentData.agent_id}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Assignment
                  </button>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Agent Assignments</h4>
                {selectedAgents.length === 0 ? (
                  <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                    No agents assigned to this route yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
                    {selectedAgents.map((assignment) => (
                      <li key={assignment.id} className="px-4 py-3 bg-white hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {assignment.agent?.first_name} {assignment.agent?.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(assignment.start_date).toLocaleDateString()} 
                                {assignment.end_date ? ` to ${new Date(assignment.end_date).toLocaleDateString()}` : ' (ongoing)'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {assignment.is_recurring && (
                              <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Calendar className="h-3 w-3 mr-1" />
                                Recurring
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeAgentFromRoute(assignment.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {assignment.is_recurring && (
                          <div className="mt-2 ml-11">
                            <p className="text-xs text-gray-500">
                              Days: {assignment.assigned_days_of_week.map(day => getDayName(day).substring(0, 3)).join(', ')}
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          
          {error && (
            <div className="text-sm text-red-600 mt-4">
              {error}
            </div>
          )}

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
            >
              {isLoading ? 'Saving...' : 'Save'}
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
      </div>
    </Modal>
  );
}