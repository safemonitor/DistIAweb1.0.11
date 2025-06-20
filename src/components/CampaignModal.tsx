import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Calendar, 
  Users, 
  Image, 
  Plus, 
  Minus, 
  Bot, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import type { Campaign, PromotionalContent, Customer } from '../types/database';

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  promotionalContent: PromotionalContent[];
  customers: Customer[];
  onSuccess: () => void;
}

interface CampaignContentItem {
  promotional_content_id: string;
  sequence_number: number;
}

export function CampaignModal({ 
  isOpen, 
  onClose, 
  campaign, 
  promotionalContent,
  customers,
  onSuccess 
}: CampaignModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    target_audience: 'all_customers',
  });
  
  const [selectedContent, setSelectedContent] = useState<CampaignContentItem[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        start_date: new Date(campaign.start_date).toISOString().split('T')[0],
        end_date: campaign.end_date ? new Date(campaign.end_date).toISOString().split('T')[0] : '',
        status: campaign.status,
        target_audience: campaign.target_audience,
      });
      
      // Set selected content
      if (campaign.promotional_content) {
        setSelectedContent(
          campaign.promotional_content.map(item => ({
            promotional_content_id: item.promotional_content_id,
            sequence_number: item.sequence_number
          }))
        );
      }
      
      // Fetch selected customers if target_audience is 'specific_customers'
      if (campaign.target_audience === 'specific_customers') {
        fetchSelectedCustomers(campaign.id);
      }
    } else {
      resetForm();
    }
  }, [campaign, isOpen]);

  const resetForm = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setFormData({
      name: '',
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      status: 'draft',
      target_audience: 'all_customers',
    });
    setSelectedContent([]);
    setSelectedCustomers([]);
    setAiSuggestion(null);
  };

  const fetchSelectedCustomers = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_customer_segments')
        .select('customer_id')
        .eq('campaign_id', campaignId);
        
      if (error) throw error;
      
      setSelectedCustomers(data?.map(item => item.customer_id) || []);
    } catch (err) {
      console.error('Error fetching selected customers:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContentSelect = (contentId: string) => {
    // Check if content is already selected
    const isSelected = selectedContent.some(item => item.promotional_content_id === contentId);
    
    if (isSelected) {
      // Remove content
      setSelectedContent(prev => prev.filter(item => item.promotional_content_id !== contentId));
    } else {
      // Add content with the next sequence number
      const nextSequence = selectedContent.length > 0 
        ? Math.max(...selectedContent.map(item => item.sequence_number)) + 1 
        : 0;
        
      setSelectedContent(prev => [
        ...prev, 
        { 
          promotional_content_id: contentId, 
          sequence_number: nextSequence 
        }
      ]);
    }
  };

  const handleContentMove = (contentId: string, direction: 'up' | 'down') => {
    const contentIndex = selectedContent.findIndex(item => item.promotional_content_id === contentId);
    if (contentIndex === -1) return;
    
    const newContent = [...selectedContent];
    
    if (direction === 'up' && contentIndex > 0) {
      // Swap with the previous item
      const temp = newContent[contentIndex].sequence_number;
      newContent[contentIndex].sequence_number = newContent[contentIndex - 1].sequence_number;
      newContent[contentIndex - 1].sequence_number = temp;
    } else if (direction === 'down' && contentIndex < newContent.length - 1) {
      // Swap with the next item
      const temp = newContent[contentIndex].sequence_number;
      newContent[contentIndex].sequence_number = newContent[contentIndex + 1].sequence_number;
      newContent[contentIndex + 1].sequence_number = temp;
    }
    
    // Sort by sequence number
    newContent.sort((a, b) => a.sequence_number - b.sequence_number);
    setSelectedContent(newContent);
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const handleSelectAllCustomers = () => {
    if (selectedCustomers.length === customers.length) {
      // Deselect all
      setSelectedCustomers([]);
    } else {
      // Select all
      setSelectedCustomers(customers.map(c => c.id));
    }
  };

  const generateAiDescription = async () => {
    setIsAiGenerating(true);
    setAiSuggestion(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            message: `Generate a marketing campaign description for a campaign named "${formData.name}" that will be sent via WhatsApp. The target audience is ${formData.target_audience.replace(/_/g, ' ')}. Keep it concise, professional, and engaging.`
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate description');
      }
      
      const data = await response.json();
      setAiSuggestion(data.content);
    } catch (err) {
      console.error('Error generating AI description:', err);
      setError('Failed to generate AI description');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      if (campaign) {
        // Update existing campaign
        const { error } = await supabase
          .from('campaigns')
          .update({
            name: formData.name,
            description: formData.description,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            target_audience: formData.target_audience,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        if (error) throw error;

        // Delete existing content associations
        const { error: deleteContentError } = await supabase
          .from('campaign_promotional_content')
          .delete()
          .eq('campaign_id', campaign.id);

        if (deleteContentError) throw deleteContentError;

        // Insert new content associations
        if (selectedContent.length > 0) {
          const { error: insertContentError } = await supabase
            .from('campaign_promotional_content')
            .insert(
              selectedContent.map(item => ({
                campaign_id: campaign.id,
                promotional_content_id: item.promotional_content_id,
                sequence_number: item.sequence_number
              }))
            );

          if (insertContentError) throw insertContentError;
        }

        // If target audience is 'specific_customers', update customer segments
        if (formData.target_audience === 'specific_customers') {
          // Delete existing customer segments
          const { error: deleteSegmentsError } = await supabase
            .from('campaign_customer_segments')
            .delete()
            .eq('campaign_id', campaign.id);

          if (deleteSegmentsError) throw deleteSegmentsError;

          // Insert new customer segments
          if (selectedCustomers.length > 0) {
            const { error: insertSegmentsError } = await supabase
              .from('campaign_customer_segments')
              .insert(
                selectedCustomers.map(customerId => ({
                  campaign_id: campaign.id,
                  customer_id: customerId
                }))
              );

            if (insertSegmentsError) throw insertSegmentsError;
          }
        }
      } else {
        // Create new campaign
        const { data: newCampaign, error } = await supabase
          .from('campaigns')
          .insert([{
            tenant_id: tenant_id,
            name: formData.name,
            description: formData.description,
            start_date: formData.start_date,
            end_date: formData.end_date || null,
            status: formData.status,
            target_audience: formData.target_audience,
            created_by: user.id
          }])
          .select()
          .single();

        if (error || !newCampaign) throw error || new Error('Failed to create campaign');

        // Insert content associations
        if (selectedContent.length > 0) {
          const { error: insertContentError } = await supabase
            .from('campaign_promotional_content')
            .insert(
              selectedContent.map(item => ({
                campaign_id: newCampaign.id,
                promotional_content_id: item.promotional_content_id,
                sequence_number: item.sequence_number
              }))
            );

          if (insertContentError) throw insertContentError;
        }

        // If target audience is 'specific_customers', insert customer segments
        if (formData.target_audience === 'specific_customers' && selectedCustomers.length > 0) {
          const { error: insertSegmentsError } = await supabase
            .from('campaign_customer_segments')
            .insert(
              selectedCustomers.map(customerId => ({
                campaign_id: newCampaign.id,
                customer_id: customerId
              }))
            );

          if (insertSegmentsError) throw insertSegmentsError;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={campaign ? 'Edit Campaign' : 'Create Campaign'}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Campaign Name
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
          <div className="flex items-center justify-between">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <button
              type="button"
              onClick={generateAiDescription}
              disabled={isAiGenerating || !formData.name}
              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50"
            >
              {isAiGenerating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Bot className="h-3 w-3 mr-1" />
              )}
              Generate with AI
            </button>
          </div>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          
          {aiSuggestion && (
            <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
              <div className="flex items-start">
                <Bot className="h-5 w-5 text-indigo-500 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm text-indigo-700">{aiSuggestion}</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, description: aiSuggestion }))}
                    className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Use this suggestion
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
              Start Date
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="end_date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label htmlFor="target_audience" className="block text-sm font-medium text-gray-700">
            Target Audience
          </label>
          <select
            id="target_audience"
            name="target_audience"
            value={formData.target_audience}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          >
            <option value="all_customers">All Customers</option>
            <option value="new_customers">New Customers (last 30 days)</option>
            <option value="specific_customers">Specific Customers</option>
            <option value="customer_segment">Customer Segment (with orders)</option>
          </select>
        </div>

        {formData.target_audience === 'specific_customers' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Customers
              </label>
              <button
                type="button"
                onClick={handleSelectAllCustomers}
                className="text-xs text-indigo-600 hover:text-indigo-500"
              >
                {selectedCustomers.length === customers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {customers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">No customers found</p>
              ) : (
                customers.map((customer) => (
                  <div key={customer.id} className="flex items-center py-1">
                    <input
                      type="checkbox"
                      id={`customer-${customer.id}`}
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={() => handleCustomerSelect(customer.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`customer-${customer.id}`} className="ml-2 block text-sm text-gray-900">
                      {customer.name} ({customer.phone})
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Promotional Content
            </label>
            <a
              href="/marketing/content"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-500"
            >
              Manage Content
            </a>
          </div>
          <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
            {promotionalContent.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">No promotional content found</p>
            ) : (
              <div className="space-y-2">
                {promotionalContent.map((content) => {
                  const isSelected = selectedContent.some(item => item.promotional_content_id === content.id);
                  const contentItem = selectedContent.find(item => item.promotional_content_id === content.id);
                  const sequenceNumber = contentItem?.sequence_number;
                  
                  return (
                    <div 
                      key={content.id} 
                      className={`flex items-center justify-between p-2 rounded-md ${
                        isSelected ? 'bg-indigo-50 border border-indigo-200' : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id={`content-${content.id}`}
                          checked={isSelected}
                          onChange={() => handleContentSelect(content.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <div className="ml-2">
                          <label htmlFor={`content-${content.id}`} className="block text-sm font-medium text-gray-900">
                            {content.name}
                          </label>
                          <span className="text-xs text-gray-500 capitalize">
                            {content.type} {isSelected && `• Sequence: ${sequenceNumber}`}
                          </span>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="flex space-x-1">
                          <button
                            type="button"
                            onClick={() => handleContentMove(content.id, 'up')}
                            className="p-1 text-gray-400 hover:text-gray-500"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleContentMove(content.id, 'down')}
                            className="p-1 text-gray-400 hover:text-gray-500"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {selectedContent.length} item{selectedContent.length !== 1 ? 's' : ''} selected
          </p>
        </div>

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
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : campaign ? 'Update Campaign' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </Modal>
  );
}