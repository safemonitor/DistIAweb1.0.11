import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Users, 
  Image, 
  Trash2, 
  Edit, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock,
  Bot,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';
import { CampaignModal } from '../components/CampaignModal';
import type { Campaign, PromotionalContent, Customer } from '../types/database';

export function CampaignManagementPage() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const campaignIdFromUrl = queryParams.get('id');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [promotionalContent, setPromotionalContent] = useState<PromotionalContent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | undefined>();
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (campaignIdFromUrl) {
      const campaign = campaigns.find(c => c.id === campaignIdFromUrl);
      if (campaign) {
        setSelectedCampaign(campaign);
        setIsModalOpen(true);
      }
    }
  }, [campaignIdFromUrl, campaigns]);

  useEffect(() => {
    filterCampaigns();
  }, [searchTerm, statusFilter, campaigns]);

  async function fetchData() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select(`
          *,
          created_by_profile:profiles!created_by (
            first_name,
            last_name
          ),
          promotional_content:campaign_promotional_content (
            promotional_content_id,
            sequence_number,
            promotional_content:promotional_content (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch promotional content
      const { data: contentData, error: contentError } = await supabase
        .from('promotional_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (contentError) throw contentError;

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (customersError) throw customersError;

      setCampaigns(campaignsData || []);
      setFilteredCampaigns(campaignsData || []);
      setPromotionalContent(contentData || []);
      setCustomers(customersData || []);
    } catch (err) {
      console.error('Error fetching campaign data:', err);
      setError('Failed to load campaign data');
    } finally {
      setIsLoading(false);
    }
  }

  function filterCampaigns() {
    let filtered = campaigns;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.name.toLowerCase().includes(term) ||
        campaign.description?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === statusFilter);
    }

    setFilteredCampaigns(filtered);
  }

  const handleAddCampaign = () => {
    setSelectedCampaign(undefined);
    setIsModalOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsModalOpen(true);
  };

  const handleDeleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Are you sure you want to delete the campaign "${campaign.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      alert('Failed to delete campaign');
    }
  };

  const handleStatusChange = async (campaign: Campaign, newStatus: Campaign['status']) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaign.id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error updating campaign status:', err);
      alert('Failed to update campaign status');
    }
  };

  const handleLaunchCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsLaunchModalOpen(true);
    setIsTestMode(true);
    setLaunchResult(null);
  };

  const executeCampaignLaunch = async () => {
    if (!selectedCampaign) return;
    
    setIsLaunching(true);
    setLaunchResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-launcher`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            campaignId: selectedCampaign.id,
            testMode: isTestMode
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to launch campaign');
      }
      
      const result = await response.json();
      setLaunchResult(result);
      
      // If not in test mode and successful, update campaign status to active
      if (!isTestMode && result.success) {
        await handleStatusChange(selectedCampaign, 'active');
      }
    } catch (err) {
      console.error('Error launching campaign:', err);
      setLaunchResult({
        success: false,
        error: err.message || 'Failed to launch campaign'
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const getStatusBadgeColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'paused':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return Play;
      case 'draft':
        return Clock;
      case 'paused':
        return Pause;
      case 'completed':
        return CheckCircle;
      case 'cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaign Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Create and manage marketing campaigns for WhatsApp
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleAddCampaign}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Campaigns
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or description..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Audience
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No campaigns found matching your filters.' 
                      : 'No campaigns found. Click "Create Campaign" to get started.'
                    }
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const StatusIcon = getStatusIcon(campaign.status);
                  const contentCount = campaign.promotional_content?.length || 0;
                  
                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Megaphone className="h-5 w-5 text-indigo-600 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                            <div className="text-xs text-gray-500 max-w-xs truncate">
                              {campaign.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(campaign.status)}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="capitalize">
                            {campaign.target_audience.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <div>{new Date(campaign.start_date).toLocaleDateString()}</div>
                            {campaign.end_date && (
                              <div>to {new Date(campaign.end_date).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Image className="h-4 w-4 text-gray-400 mr-2" />
                          <span>{contentCount} item{contentCount !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaign.created_by_profile 
                          ? `${campaign.created_by_profile.first_name} ${campaign.created_by_profile.last_name}`
                          : 'Unknown'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleLaunchCampaign(campaign)}
                              className="text-green-600 hover:text-green-900"
                              title="Launch Campaign"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          {campaign.status === 'active' && (
                            <button
                              onClick={() => handleStatusChange(campaign, 'paused')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Pause Campaign"
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          )}
                          {campaign.status === 'paused' && (
                            <button
                              onClick={() => handleStatusChange(campaign, 'active')}
                              className="text-green-600 hover:text-green-900"
                              title="Resume Campaign"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Campaign"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(campaign)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Campaign"
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

      {/* Campaign Modal */}
      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaign={selectedCampaign}
        promotionalContent={promotionalContent}
        customers={customers}
        onSuccess={fetchData}
      />

      {/* Launch Campaign Modal */}
      {selectedCampaign && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${isLaunchModalOpen ? 'block' : 'hidden'}`}>
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsLaunchModalOpen(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                  onClick={() => setIsLaunchModalOpen(false)}
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-xl font-semibold leading-6 text-gray-900 mb-4">
                    Launch Campaign: {selectedCampaign.name}
                  </h3>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <MessageSquare className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Launch Information</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            This will send WhatsApp messages to the target audience defined in your campaign.
                            {isTestMode ? ' In test mode, only one customer will receive the messages.' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center">
                      <input
                        id="test-mode"
                        name="test-mode"
                        type="checkbox"
                        checked={isTestMode}
                        onChange={(e) => setIsTestMode(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="test-mode" className="ml-2 block text-sm text-gray-900">
                        Test Mode (send to one customer only)
                      </label>
                    </div>
                  </div>
                  
                  {launchResult && (
                    <div className={`mb-4 p-4 rounded-md ${launchResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex">
                        <div className="flex-shrink-0">
                          {launchResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                        <div className="ml-3">
                          <h3 className={`text-sm font-medium ${launchResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {launchResult.success ? 'Campaign Launched Successfully' : 'Launch Failed'}
                          </h3>
                          <div className={`mt-2 text-sm ${launchResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            <p>{launchResult.message || launchResult.error}</p>
                            {launchResult.success && (
                              <ul className="list-disc list-inside mt-2">
                                <li>Target Customers: {launchResult.targetCustomers}</li>
                                <li>Messages Sent: {launchResult.messagesSent}</li>
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={executeCampaignLaunch}
                      disabled={isLaunching}
                      className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                    >
                      {isLaunching ? 'Launching...' : isTestMode ? 'Test Campaign' : 'Launch Campaign'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLaunchModalOpen(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}