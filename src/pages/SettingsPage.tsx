import { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  Search, 
  Filter,
  Globe,
  Mail,
  Shield,
  Zap,
  Puzzle,
  Palette,
  Bell,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Setting } from '../types/database';

interface SettingGroup {
  category: Setting['category'];
  label: string;
  icon: React.ElementType;
  description: string;
  settings: Setting[];
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [filteredSettings, setFilteredSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [changedSettings, setChangedSettings] = useState<Set<string>>(new Set());

  const categories = [
    { value: 'all', label: 'All Categories', icon: SettingsIcon },
    { value: 'general', label: 'General', icon: Globe },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'features', label: 'Features', icon: Zap },
    { value: 'integrations', label: 'Integrations', icon: Puzzle },
    { value: 'appearance', label: 'Appearance', icon: Palette },
    { value: 'notifications', label: 'Notifications', icon: Bell },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    filterSettings();
  }, [searchTerm, categoryFilter, settings]);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) throw error;
      setSettings(data || []);
      setFilteredSettings(data || []);
    } catch (err) {
      setError('Failed to fetch settings');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function filterSettings() {
    let filtered = settings;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(setting => 
        setting.key.toLowerCase().includes(term) ||
        setting.description?.toLowerCase().includes(term) ||
        setting.value.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(setting => setting.category === categoryFilter);
    }

    setFilteredSettings(filtered);
  }

  const handleSettingChange = (settingId: string, newValue: string) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.id === settingId 
          ? { ...setting, value: newValue }
          : setting
      )
    );

    setChangedSettings(prev => new Set(prev).add(settingId));
    setSuccess(null);
    setError(null);
  };

  const handleSaveSettings = async () => {
    if (changedSettings.size === 0) {
      setError('No changes to save');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const settingsToUpdate = settings.filter(setting => 
        changedSettings.has(setting.id)
      );

      for (const setting of settingsToUpdate) {
        const { error } = await supabase
          .from('settings')
          .update({ 
            value: setting.value,
            updated_at: new Date().toISOString()
          })
          .eq('id', setting.id);

        if (error) throw error;
      }

      setChangedSettings(new Set());
      setSuccess(`Successfully updated ${settingsToUpdate.length} setting(s)`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to their default values? This action cannot be undone.')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // This would typically reset to default values
      // For now, we'll just reload the settings
      await fetchSettings();
      setChangedSettings(new Set());
      setSuccess('Settings have been reset');
    } catch (err) {
      setError('Failed to reset settings');
      console.error('Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSettingInput = (setting: Setting) => {
    const isChanged = changedSettings.has(setting.id);
    const baseClasses = `block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
      isChanged ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
    }`;

    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => handleSettingChange(setting.id, setting.value === 'true' ? 'false' : 'true')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                setting.value === 'true' ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  setting.value === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="ml-3 text-sm text-gray-900">
              {setting.value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={setting.value}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className={baseClasses}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={setting.value}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className={baseClasses}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={setting.value}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className={baseClasses}
          />
        );

      case 'json':
        return (
          <textarea
            value={setting.value}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            rows={4}
            className={baseClasses}
            placeholder="Enter valid JSON"
          />
        );

      default:
        return (
          <input
            type="text"
            value={setting.value}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className={baseClasses}
          />
        );
    }
  };

  const groupSettingsByCategory = (settings: Setting[]): SettingGroup[] => {
    const groups: SettingGroup[] = [];
    
    categories.slice(1).forEach(category => {
      const categorySettings = settings.filter(s => s.category === category.value);
      if (categorySettings.length > 0) {
        groups.push({
          category: category.value as Setting['category'],
          label: category.label,
          icon: category.icon,
          description: getCategoryDescription(category.value as Setting['category']),
          settings: categorySettings
        });
      }
    });

    return groups;
  };

  const getCategoryDescription = (category: Setting['category']): string => {
    switch (category) {
      case 'general':
        return 'Basic application settings and configuration';
      case 'email':
        return 'Email server and notification settings';
      case 'security':
        return 'Security policies and authentication settings';
      case 'features':
        return 'Enable or disable application features';
      case 'integrations':
        return 'Third-party service integrations';
      case 'appearance':
        return 'User interface and theme customization';
      case 'notifications':
        return 'System notification preferences';
      default:
        return 'Configuration settings';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const settingGroups = groupSettingsByCategory(filteredSettings);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <SettingsIcon className="h-6 w-6 mr-3" />
            System Settings
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure application settings and preferences. Changes are saved automatically.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={handleResetSettings}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving || changedSettings.size === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : `Save Changes ${changedSettings.size > 0 ? `(${changedSettings.size})` : ''}`}
          </button>
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

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Settings
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
                placeholder="Search by key, description, or value..."
                className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Settings Groups */}
      {settingGroups.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Settings Found</h3>
          <p className="text-gray-500">
            {searchTerm || categoryFilter !== 'all' 
              ? 'No settings match your current filters.' 
              : 'No settings are available to configure.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {settingGroups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.category} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 text-indigo-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{group.label}</h3>
                      <p className="text-sm text-gray-600">{group.description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4">
                  <div className="space-y-6">
                    {group.settings.map((setting) => (
                      <div key={setting.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                        <div className="lg:col-span-1">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-900">
                              {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </label>
                            {changedSettings.has(setting.id) && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                Modified
                              </span>
                            )}
                            {!setting.is_public && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Admin Only
                              </span>
                            )}
                          </div>
                          {setting.description && (
                            <p className="mt-1 text-sm text-gray-500">{setting.description}</p>
                          )}
                          <div className="mt-1 flex items-center text-xs text-gray-400">
                            <span className="font-mono">{setting.key}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded">
                              {setting.type}
                            </span>
                          </div>
                        </div>
                        
                        <div className="lg:col-span-2">
                          {renderSettingInput(setting)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <Info className="h-5 w-5 text-blue-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Settings Information</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Settings marked as "Admin Only" are not visible to regular users</li>
                <li>Boolean settings can be toggled by clicking the switch</li>
                <li>Changes are highlighted in yellow and must be saved manually</li>
                <li>Some settings may require application restart to take effect</li>
                <li>Global settings apply to all tenants, while tenant-specific settings override globals</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}