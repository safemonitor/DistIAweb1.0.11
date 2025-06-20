import { useState, useEffect } from 'react';
import { 
  Bot, 
  MessageSquare, 
  Settings, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Key, 
  Link, 
  Phone, 
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Setting } from '../types/database';

export function WhatsAppChatbotConfigurationPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    whatsapp_api_key: '',
    whatsapp_api_url: '',
    whatsapp_from_number: '',
    whatsapp_webhook_url: '',
    whatsapp_enabled: 'false',
    whatsapp_auto_reply: 'true',
    whatsapp_greeting_message: 'Hello! Thanks for contacting us. How can I help you today?'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch WhatsApp-related settings
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .or('key.ilike.whatsapp_%,category.eq.integrations')
        .order('key');

      if (error) throw error;

      // Initialize form data with settings
      const newFormData = { ...formData };
      (data || []).forEach(setting => {
        if (Object.prototype.hasOwnProperty.call(formData, setting.key)) {
          newFormData[setting.key as keyof typeof formData] = setting.value;
        }
      });

      setSettings(data || []);
      setFormData(newFormData);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load WhatsApp configuration settings');
    } finally {
      setIsLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked.toString() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

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

      // Update or insert settings
      for (const [key, value] of Object.entries(formData)) {
        const existingSetting = settings.find(s => s.key === key);
        
        if (existingSetting) {
          // Update existing setting
          const { error } = await supabase
            .from('settings')
            .update({ 
              value,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSetting.id);

          if (error) throw error;
        } else {
          // Insert new setting
          const { error } = await supabase
            .from('settings')
            .insert([{
              key,
              value,
              type: key.includes('enabled') || key.includes('auto_reply') ? 'boolean' : 'string',
              description: `WhatsApp chatbot ${key.replace('whatsapp_', '').replace(/_/g, ' ')}`,
              tenant_id,
              category: 'integrations',
              is_public: false
            }]);

          if (error) throw error;
        }
      }

      setSuccess('WhatsApp configuration saved successfully');
      
      // Refresh settings
      await fetchSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call the test endpoint
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-whatsapp-connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            apiKey: formData.whatsapp_api_key,
            apiUrl: formData.whatsapp_api_url,
            fromNumber: formData.whatsapp_from_number
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test WhatsApp connection');
      }

      const result = await response.json();
      setSuccess(`Connection successful! ${result.message}`);
    } catch (err) {
      console.error('Error testing connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to test WhatsApp connection');
    } finally {
      setIsSaving(false);
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
          <h1 className="text-2xl font-semibold text-gray-900">WhatsApp Chatbot Configuration</h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure the WhatsApp Business API integration and chatbot settings
          </p>
        </div>
      </div>

      {/* Status Messages */}
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

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* WhatsApp API Configuration */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">WhatsApp Business API Configuration</h3>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="whatsapp_api_key" className="block text-sm font-medium text-gray-700">
                  <Key className="h-4 w-4 inline mr-2" />
                  API Key
                </label>
                <input
                  type="password"
                  id="whatsapp_api_key"
                  name="whatsapp_api_key"
                  value={formData.whatsapp_api_key}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter your WhatsApp API key"
                />
              </div>

              <div>
                <label htmlFor="whatsapp_api_url" className="block text-sm font-medium text-gray-700">
                  <Link className="h-4 w-4 inline mr-2" />
                  API URL
                </label>
                <input
                  type="text"
                  id="whatsapp_api_url"
                  name="whatsapp_api_url"
                  value={formData.whatsapp_api_url}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="https://api.whatsapp.provider.com/v1"
                />
              </div>

              <div>
                <label htmlFor="whatsapp_from_number" className="block text-sm font-medium text-gray-700">
                  <Phone className="h-4 w-4 inline mr-2" />
                  From Number
                </label>
                <input
                  type="text"
                  id="whatsapp_from_number"
                  name="whatsapp_from_number"
                  value={formData.whatsapp_from_number}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="+1234567890"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This is the WhatsApp Business number that will send messages to customers
                </p>
              </div>

              <div>
                <label htmlFor="whatsapp_webhook_url" className="block text-sm font-medium text-gray-700">
                  <Link className="h-4 w-4 inline mr-2" />
                  Webhook URL
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <input
                    type="text"
                    id="whatsapp_webhook_url"
                    name="whatsapp_webhook_url"
                    value={formData.whatsapp_webhook_url || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.whatsapp_webhook_url || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
                      setSuccess('Webhook URL copied to clipboard');
                    }}
                    className="ml-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Configure this URL in your WhatsApp Business API provider's dashboard
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={testConnection}
                disabled={isSaving || !formData.whatsapp_api_key || !formData.whatsapp_api_url || !formData.whatsapp_from_number}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </button>
            </div>
          </div>
        </div>

        {/* Chatbot Settings */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Chatbot Settings</h3>
            
            <div className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="whatsapp_enabled"
                  name="whatsapp_enabled"
                  checked={formData.whatsapp_enabled === 'true'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    whatsapp_enabled: e.target.checked ? 'true' : 'false'
                  }))}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="whatsapp_enabled" className="ml-2 block text-sm text-gray-900">
                  Enable WhatsApp Chatbot
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="whatsapp_auto_reply"
                  name="whatsapp_auto_reply"
                  checked={formData.whatsapp_auto_reply === 'true'}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    whatsapp_auto_reply: e.target.checked ? 'true' : 'false'
                  }))}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="whatsapp_auto_reply" className="ml-2 block text-sm text-gray-900">
                  Enable Auto-Reply
                </label>
              </div>

              <div>
                <label htmlFor="whatsapp_greeting_message" className="block text-sm font-medium text-gray-700">
                  Greeting Message
                </label>
                <textarea
                  id="whatsapp_greeting_message"
                  name="whatsapp_greeting_message"
                  value={formData.whatsapp_greeting_message}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Hello! Thanks for contacting us. How can I help you today?"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This message will be sent when a customer starts a new conversation
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <Info className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">WhatsApp Integration Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>To complete the WhatsApp integration, you'll need to:</p>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Sign up for a WhatsApp Business API provider (e.g., Twilio, MessageBird)</li>
                  <li>Obtain API credentials and a WhatsApp Business number</li>
                  <li>Configure the webhook URL in your provider's dashboard</li>
                  <li>Test the connection to ensure everything is working properly</li>
                </ol>
                <p className="mt-2">
                  Once configured, customers can interact with your business via WhatsApp, place orders, and receive marketing campaigns.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}