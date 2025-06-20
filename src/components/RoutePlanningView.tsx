import { useState, useEffect } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  User, 
  CheckCircle, 
  Clock, 
  XCircle, 
  RotateCcw, 
  Ban, 
  Camera, 
  Eye, 
  Route as RouteIcon,
  Users,
  CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RouteModal } from './RouteModal';
import { VisitModal } from './VisitModal';
import { PhotoCapture } from './PhotoCapture';
import { VisitLocationCapture } from './VisitLocationCapture';
import { Modal } from './Modal';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import type { Route, VisitWithDetails, RouteCustomer, RouteAgentAssignment, Customer, Profile } from '../types/database';

interface RoutePlanningViewProps {
  moduleType: 'presales' | 'sales' | 'delivery';
}

export function RoutePlanningView({ moduleType }: RoutePlanningViewProps) {
  // Active tab state
  const [activeTab, setActiveTab] = useState<'routes' | 'visits' | 'schedules'>('routes');
  
  // Routes state
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeCustomers, setRouteCustomers] = useState<RouteCustomer[]>([]);
  const [routeAgents, setRouteAgents] = useState<RouteAgentAssignment[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]);
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const [routeTypeFilter, setRouteTypeFilter] = useState<string>('all');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | undefined>();
  
  // Visits state
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<VisitWithDetails[]>([]);
  const [visitSearchTerm, setVisitSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitWithDetails | undefined>();
  
  // Customers and agents state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  
  // Shared state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [moduleType]);

  useEffect(() => {
    filterRoutes();
  }, [routeSearchTerm, routeTypeFilter, routes]);

  useEffect(() => {
    filterVisits();
  }, [visitSearchTerm, outcomeFilter, visits]);

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);
      
      await Promise.all([
        fetchRoutes(),
        fetchVisits(),
        fetchCustomers(),
        fetchAgents()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchRoutes() {
    try {
      // Fetch routes
      let query = supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Filter routes based on module type
      if (moduleType === 'presales') {
        query = query.eq('type', 'delivery');
      } else if (moduleType === 'sales') {
        query = query.eq('type', 'sales');
      } else if (moduleType === 'delivery') {
        query = query.eq('type', 'delivery');
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch route customers
      const { data: routeCustomersData, error: routeCustomersError } = await supabase
        .from('route_customers')
        .select(`
          *,
          customer:customers (
            id,
            name,
            email,
            phone,
            address
          )
        `);
      
      if (routeCustomersError) throw routeCustomersError;
      
      // Fetch route agent assignments
      const { data: routeAgentsData, error: routeAgentsError } = await supabase
        .from('route_agent_assignments')
        .select(`
          *,
          agent:profiles (
            id,
            first_name,
            last_name,
            role
          )
        `);
      
      if (routeAgentsError) throw routeAgentsError;

      setRoutes(data || []);
      setFilteredRoutes(data || []);
      setRouteCustomers(routeCustomersData || []);
      setRouteAgents(routeAgentsData || []);
    } catch (err) {
      console.error('Error fetching routes:', err);
      throw err;
    }
  }

  async function fetchVisits() {
    try {
      let query = supabase
        .from('visits')
        .select(`
          *,
          customer:customers (
            name,
            email,
            phone,
            address
          ),
          created_by_profile:profiles!created_by (
            first_name,
            last_name,
            role
          ),
          schedule:visit_schedules (
            *,
            route_customer:route_customers (
              *,
              route:routes (*)
            )
          )
        `)
        .order('visit_date', { ascending: false });
      
      // Filter visits based on module type
      if (moduleType === 'presales') {
        // For presales, show visits created by presales staff
        query = query.eq('created_by_profile.role', 'presales');
      } else if (moduleType === 'sales') {
        // For sales, show visits created by sales staff
        query = query.eq('created_by_profile.role', 'sales');
      } else if (moduleType === 'delivery') {
        // For delivery, show visits related to deliveries
        query = query.eq('created_by_profile.role', 'delivery');
      }

      const { data, error } = await query;

      if (error) throw error;
      setVisits(data || []);
      setFilteredVisits(data || []);
    } catch (err) {
      console.error('Error fetching visits:', err);
      throw err;
    }
  }
  
  async function fetchCustomers() {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      throw err;
    }
  }
  
  async function fetchAgents() {
    try {
      let query = supabase
        .from('profiles')
        .select('*');
      
      // Filter agents based on module type
      if (moduleType === 'presales') {
        query = query.eq('role', 'presales');
      } else if (moduleType === 'sales') {
        query = query.eq('role', 'sales');
      } else if (moduleType === 'delivery') {
        query = query.eq('role', 'delivery');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
      throw err;
    }
  }

  function filterRoutes() {
    let filtered = routes;

    // Filter by search term
    if (routeSearchTerm) {
      const term = routeSearchTerm.toLowerCase();
      filtered = filtered.filter(route => 
        route.name.toLowerCase().includes(term) ||
        route.description?.toLowerCase().includes(term)
      );
    }

    // Filter by type
    if (routeTypeFilter !== 'all') {
      filtered = filtered.filter(route => route.type === routeTypeFilter);
    }

    setFilteredRoutes(filtered);
  }

  function filterVisits() {
    let filtered = visits;

    // Filter by search term
    if (visitSearchTerm) {
      const term = visitSearchTerm.toLowerCase();
      filtered = filtered.filter(visit => 
        visit.customer.name.toLowerCase().includes(term) ||
        visit.customer.email.toLowerCase().includes(term) ||
        visit.notes?.toLowerCase().includes(term) ||
        visit.created_by_profile.first_name.toLowerCase().includes(term) ||
        visit.created_by_profile.last_name.toLowerCase().includes(term)
      );
    }

    // Filter by outcome
    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(visit => visit.outcome === outcomeFilter);
    }

    setFilteredVisits(filtered);
  }

  // Route CRUD operations
  const handleAddRoute = () => {
    setSelectedRoute(undefined);
    setIsRouteModalOpen(true);
  };

  const handleEditRoute = (route: Route) => {
    setSelectedRoute(route);
    setIsRouteModalOpen(true);
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!confirm('Are you sure you want to delete this route? This will also delete all associated customers and visits.')) return;

    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', route.id);

      if (error) throw error;
      await fetchRoutes();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete route');
    }
  };

  // Visit CRUD operations
  const handleAddVisit = (routeId?: string, customerId?: string) => {
    setSelectedVisit(undefined);
    setIsVisitModalOpen(true);
  };

  const handleEditVisit = (visit: VisitWithDetails) => {
    setSelectedVisit(visit);
    setIsVisitModalOpen(true);
  };

  const handleViewPhotos = (visit: VisitWithDetails) => {
    setSelectedVisit(visit);
    setIsPhotoModalOpen(true);
  };

  const handleViewLocation = (visit: VisitWithDetails) => {
    setSelectedVisit(visit);
    setIsLocationModalOpen(true);
  };

  const handleDeleteVisit = async (visit: VisitWithDetails) => {
    if (!confirm('Are you sure you want to delete this visit?')) return;

    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visit.id);

      if (error) throw error;
      
      // Log activity
      await logActivity(ActivityTypes.VISIT_DELETED, {
        visit_id: visit.id,
        customer_id: visit.customer_id,
        customer_name: visit.customer.name
      });
      
      await fetchVisits();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete visit');
    }
  };
  
  // Helper functions
  const getRouteCustomers = (routeId: string) => {
    return routeCustomers.filter(rc => rc.route_id === routeId);
  };
  
  const getRouteAgents = (routeId: string) => {
    return routeAgents.filter(ra => ra.route_id === routeId);
  };

  // Utility functions
  const getOutcomeIcon = (outcome?: string) => {
    switch (outcome) {
      case 'successful':
        return CheckCircle;
      case 'unsuccessful':
        return XCircle;
      case 'rescheduled':
        return RotateCcw;
      case 'cancelled':
        return Ban;
      default:
        return Clock;
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'successful':
        return 'text-green-600 bg-green-100';
      case 'unsuccessful':
        return 'text-red-600 bg-red-100';
      case 'rescheduled':
        return 'text-blue-600 bg-blue-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getModuleTitle = () => {
    switch (moduleType) {
      case 'presales':
        return 'Presales Route Planning';
      case 'sales':
        return 'Sales Route Planning';
      case 'delivery':
        return 'Delivery Route Planning';
      default:
        return 'Route Planning';
    }
  };

  const getModuleDescription = () => {
    switch (moduleType) {
      case 'presales':
        return 'Plan and manage presales routes and customer visits';
      case 'sales':
        return 'Organize sales routes and schedule customer visits';
      case 'delivery':
        return 'View and manage delivery routes and schedules';
      default:
        return 'Manage routes and visits';
    }
  };

  const outcomeOptions = [
    { value: 'all', label: 'All Outcomes' },
    { value: 'pending', label: 'Pending' },
    { value: 'successful', label: 'Successful' },
    { value: 'unsuccessful', label: 'Unsuccessful' },
    { value: 'rescheduled', label: 'Rescheduled' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const routeTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'sales', label: 'Sales' },
    { value: 'mixed', label: 'Mixed' },
  ];

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
          <h1 className="text-2xl font-semibold text-gray-900">{getModuleTitle()}</h1>
          <p className="mt-2 text-sm text-gray-700">
            {getModuleDescription()}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'routes'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <RouteIcon className="h-5 w-5" />
            <span>Routes</span>
          </button>
          <button
            onClick={() => setActiveTab('visits')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'visits'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Visits</span>
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeTab === 'schedules'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CalendarDays className="h-5 w-5" />
            <span>Schedules</span>
          </button>
        </nav>
      </div>

      {/* Routes Tab Content */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          {/* Routes Filters */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="route-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Routes
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="route-search"
                    value={routeSearchTerm}
                    onChange={(e) => setRouteSearchTerm(e.target.value)}
                    placeholder="Search by name or description..."
                    className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="route-type-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Type
                </label>
                <select
                  id="route-type-filter"
                  value={routeTypeFilter}
                  onChange={(e) => setRouteTypeFilter(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {routeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddRoute}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Route
                </button>
              </div>
            </div>
          </div>

          {/* Routes Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customers
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agents
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRoutes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                          {routeSearchTerm || routeTypeFilter !== 'all' 
                            ? 'No routes found matching your filters.' 
                            : 'No routes found. Click "Add Route" to get started.'
                          }
                        </td>
                      </tr>
                    ) : (
                      filteredRoutes.map((route) => {
                        const routeCustomersList = getRouteCustomers(route.id);
                        const routeAgentsList = getRouteAgents(route.id);
                        
                        return (
                          <tr key={route.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <RouteIcon className="h-5 w-5 text-gray-400 mr-3" />
                                <div className="text-sm font-medium text-gray-900">{route.name}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                              {route.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Users className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-900">{routeCustomersList.length}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <User className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-900">{routeAgentsList.length}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {route.description || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(route.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center space-x-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleAddVisit(route.id)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="Schedule Visit"
                                >
                                  <Calendar className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditRoute(route)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoute(route)}
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

      {/* Visits Tab Content */}
      {activeTab === 'visits' && (
        <div className="space-y-6">
          {/* Visits Filters */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="visit-search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Visits
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="visit-search"
                    value={visitSearchTerm}
                    onChange={(e) => setVisitSearchTerm(e.target.value)}
                    placeholder="Search by customer, notes, or staff..."
                    className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="outcome-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Outcome
                </label>
                <select
                  id="outcome-filter"
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {outcomeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleAddVisit()}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Visit
                </button>
              </div>
            </div>
          </div>

          {/* Visits Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Visit Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Media
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVisits.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                          {visitSearchTerm || outcomeFilter !== 'all' 
                            ? 'No visits found matching your filters.' 
                            : 'No visits scheduled yet. Click "Schedule Visit" to get started.'
                          }
                        </td>
                      </tr>
                    ) : (
                      filteredVisits.map((visit) => {
                        const OutcomeIcon = getOutcomeIcon(visit.outcome);
                        const outcomeColor = getOutcomeColor(visit.outcome);
                        const photoCount = visit.photos_url?.length || 0;
                        const hasLocation = visit.latitude && visit.longitude;
                        const routeName = visit.schedule?.route_customer?.route?.name || '-';
                        
                        return (
                          <tr key={visit.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <User className="h-5 w-5 text-gray-400 mr-3" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {visit.customer.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {visit.customer.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(visit.visit_date).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeColor}`}>
                                <OutcomeIcon className="h-3 w-3 mr-1" />
                                {visit.outcome || 'pending'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {visit.created_by_profile.first_name} {visit.created_by_profile.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {routeName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-2">
                                {photoCount > 0 && (
                                  <button
                                    onClick={() => handleViewPhotos(visit)}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
                                  >
                                    <Camera className="h-3 w-3 mr-1" />
                                    {photoCount}
                                  </button>
                                )}
                                {hasLocation && (
                                  <button
                                    onClick={() => handleViewLocation(visit)}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                  >
                                    <MapPin className="h-3 w-3 mr-1" />
                                    Map
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {visit.notes || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center space-x-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleEditVisit(visit)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVisit(visit)}
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
      
      {/* Schedules Tab Content */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Visit Schedules</h3>
            <p className="text-sm text-gray-500 mb-4">
              View and manage recurring visit schedules for your routes and customers.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visits
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Visit schedules will be displayed here. Create visits with recurring schedules to see them here.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RouteModal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        route={selectedRoute}
        customers={customers}
        agents={agents.filter(agent => 
          (moduleType === 'presales' && agent.role === 'presales') ||
          (moduleType === 'sales' && agent.role === 'sales') ||
          (moduleType === 'delivery' && agent.role === 'delivery')
        )}
        routeCustomers={routeCustomers}
        routeAgents={routeAgents}
        moduleType={moduleType}
        onSuccess={fetchData}
      />

      <VisitModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        visit={selectedVisit}
        routes={routes}
        routeCustomers={routeCustomers}
        onSuccess={fetchData}
      />

      {/* Photo Viewer Modal */}
      {selectedVisit && (
        <Modal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          title={`Visit Photos - ${selectedVisit.customer.name}`}
        >
          <PhotoCapture
            visitId={selectedVisit.id}
            existingPhotos={selectedVisit.photos_url || []}
            onPhotosUpdate={(photos) => {
              setSelectedVisit(prev => prev ? { ...prev, photos_url: photos } : prev);
              fetchVisits();
            }}
            disabled={true}
          />
        </Modal>
      )}

      {/* Location Viewer Modal */}
      {selectedVisit && (
        <Modal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          title={`Visit Location - ${selectedVisit.customer.name}`}
        >
          <VisitLocationCapture
            visitId={selectedVisit.id}
            existingCoordinates={
              selectedVisit.latitude && selectedVisit.longitude
                ? { latitude: selectedVisit.latitude, longitude: selectedVisit.longitude }
                : null
            }
            onCoordinatesUpdate={(coords) => {
              setSelectedVisit(prev => prev ? { 
                ...prev, 
                latitude: coords.latitude, 
                longitude: coords.longitude 
              } : prev);
              fetchVisits();
            }}
            disabled={true}
          />
        </Modal>
      )}
    </div>
  );
}