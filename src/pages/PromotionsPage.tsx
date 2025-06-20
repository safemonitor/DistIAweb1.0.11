import { useState, useEffect } from 'react';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Filter,
  Tag,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  Eye,
  Copy,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PromotionModal } from '../components/PromotionModal';
import { PromotionDetailsModal } from '../components/PromotionDetailsModal';
import type { PromotionWithDetails, PromotionMetrics } from '../types/database';

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<PromotionWithDetails[]>([]);
  const [metrics, setMetrics] = useState<PromotionMetrics>({
    totalPromotions: 0,
    activePromotions: 0,
    totalDiscountGiven: 0,
    totalOrdersWithPromotions: 0,
    averageDiscountPerOrder: 0,
    topPerformingPromotions: [],
    promotionsByType: [],
    recentApplications: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionWithDetails | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchPromotions();
    fetchMetrics();
  }, []);

  useEffect(() => {
    filterPromotions();
  }, [searchTerm, statusFilter, typeFilter, promotions]);

  async function fetchPromotions() {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          rules:promotion_rules (*),
          actions:promotion_actions (*),
          product_eligibility:promotion_product_eligibility (
            *,
            product:products (*)
          ),
          category_eligibility:promotion_category_eligibility (*),
          customer_eligibility:promotion_customer_eligibility (
            *,
            customer:customers (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch usage stats for each promotion
      const promotionsWithStats = await Promise.all(
        (data || []).map(async (promotion) => {
          const { data: usageData, error: usageError } = await supabase
            .from('applied_promotions')
            .select('discount_amount, customer_id')
            .eq('promotion_id', promotion.id);

          if (usageError) {
            console.error('Error fetching usage stats:', usageError);
          }

          const usage_stats = {
            total_usage: usageData?.length || 0,
            total_discount_given: usageData?.reduce((sum, app) => sum + app.discount_amount, 0) || 0,
            unique_customers: new Set(usageData?.map(app => app.customer_id)).size || 0
          };

          return {
            ...promotion,
            usage_stats
          };
        })
      );

      setPromotions(promotionsWithStats);
      setFilteredPromotions(promotionsWithStats);
    } catch (err) {
      setError('Failed to fetch promotions');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchMetrics() {
    try {
      // Fetch basic promotion metrics
      const { data: promotionsData, error: promotionsError } = await supabase
        .from('promotions')
        .select('*');

      if (promotionsError) throw promotionsError;

      // Fetch applied promotions for metrics
      const { data: appliedData, error: appliedError } = await supabase
        .from('applied_promotions')
        .select(`
          *,
          promotion:promotions (name)
        `)
        .order('applied_at', { ascending: false })
        .limit(10);

      if (appliedError) throw appliedError;

      const totalPromotions = promotionsData?.length || 0;
      const activePromotions = promotionsData?.filter(p => p.is_active).length || 0;
      const totalDiscountGiven = appliedData?.reduce((sum, app) => sum + app.discount_amount, 0) || 0;
      const totalOrdersWithPromotions = new Set(appliedData?.map(app => app.order_id)).size || 0;
      const averageDiscountPerOrder = totalOrdersWithPromotions > 0 ? totalDiscountGiven / totalOrdersWithPromotions : 0;

      // Calculate top performing promotions
      const promotionUsage = new Map();
      appliedData?.forEach(app => {
        const existing = promotionUsage.get(app.promotion_id) || {
          promotion_id: app.promotion_id,
          promotion_name: app.promotion?.name || 'Unknown',
          usage_count: 0,
          total_discount: 0
        };
        existing.usage_count += 1;
        existing.total_discount += app.discount_amount;
        promotionUsage.set(app.promotion_id, existing);
      });

      const topPerformingPromotions = Array.from(promotionUsage.values())
        .map(p => ({ ...p, conversion_rate: 0 })) // Would need order data to calculate actual conversion rate
        .sort((a, b) => b.total_discount - a.total_discount)
        .slice(0, 5);

      // Calculate promotions by type
      const typeUsage = new Map();
      promotionsData?.forEach(promotion => {
        const existing = typeUsage.get(promotion.promotion_type) || {
          type: promotion.promotion_type,
          count: 0,
          total_discount: 0
        };
        existing.count += 1;
        typeUsage.set(promotion.promotion_type, existing);
      });

      appliedData?.forEach(app => {
        const promotion = promotionsData?.find(p => p.id === app.promotion_id);
        if (promotion) {
          const existing = typeUsage.get(promotion.promotion_type);
          if (existing) {
            existing.total_discount += app.discount_amount;
          }
        }
      });

      const promotionsByType = Array.from(typeUsage.values());

      setMetrics({
        totalPromotions,
        activePromotions,
        totalDiscountGiven,
        totalOrdersWithPromotions,
        averageDiscountPerOrder,
        topPerformingPromotions,
        promotionsByType,
        recentApplications: appliedData || []
      });
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }

  function filterPromotions() {
    let filtered = promotions;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(promotion => 
        promotion.name.toLowerCase().includes(term) ||
        promotion.description?.toLowerCase().includes(term) ||
        promotion.promotion_type.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(promotion => {
        const startDate = new Date(promotion.start_date);
        const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
        
        switch (statusFilter) {
          case 'active':
            return promotion.is_active && startDate <= now && (!endDate || endDate >= now);
          case 'inactive':
            return !promotion.is_active;
          case 'scheduled':
            return promotion.is_active && startDate > now;
          case 'expired':
            return endDate && endDate < now;
          default:
            return true;
        }
      });
    }

    // Filter by type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(promotion => promotion.promotion_type === typeFilter);
    }

    setFilteredPromotions(filtered);
  }

  const handleEdit = (promotion: PromotionWithDetails) => {
    setSelectedPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleViewDetails = (promotion: PromotionWithDetails) => {
    setSelectedPromotion(promotion);
    setIsDetailsModalOpen(true);
  };

  const handleToggleStatus = async (promotion: PromotionWithDetails) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promotion.is_active })
        .eq('id', promotion.id);

      if (error) throw error;
      await fetchPromotions();
    } catch (err) {
      console.error('Error toggling promotion status:', err);
      alert('Failed to update promotion status');
    }
  };

  const handleDuplicate = async (promotion: PromotionWithDetails) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create duplicate promotion
      const { data: newPromotion, error: promotionError } = await supabase
        .from('promotions')
        .insert([{
          ...promotion,
          id: undefined,
          name: `${promotion.name} (Copy)`,
          is_active: false,
          created_by: user.id,
          created_at: undefined,
          updated_at: undefined
        }])
        .select()
        .single();

      if (promotionError || !newPromotion) throw promotionError;

      // Duplicate rules
      if (promotion.rules.length > 0) {
        const { error: rulesError } = await supabase
          .from('promotion_rules')
          .insert(
            promotion.rules.map(rule => ({
              ...rule,
              id: undefined,
              promotion_id: newPromotion.id,
              created_at: undefined
            }))
          );

        if (rulesError) throw rulesError;
      }

      // Duplicate actions
      if (promotion.actions.length > 0) {
        const { error: actionsError } = await supabase
          .from('promotion_actions')
          .insert(
            promotion.actions.map(action => ({
              ...action,
              id: undefined,
              promotion_id: newPromotion.id,
              created_at: undefined
            }))
          );

        if (actionsError) throw actionsError;
      }

      await fetchPromotions();
    } catch (err) {
      console.error('Error duplicating promotion:', err);
      alert('Failed to duplicate promotion');
    }
  };

  const handleDelete = async (promotion: PromotionWithDetails) => {
    if (!confirm('Are you sure you want to delete this promotion? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotion.id);

      if (error) throw error;
      await fetchPromotions();
      await fetchMetrics();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to delete promotion');
    }
  };

  const handleAddNew = () => {
    setSelectedPromotion(undefined);
    setIsModalOpen(true);
  };

  const getPromotionStatus = (promotion: PromotionWithDetails) => {
    const now = new Date();
    const startDate = new Date(promotion.start_date);
    const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

    if (!promotion.is_active) {
      return { status: 'inactive', color: 'text-gray-600 bg-gray-100', icon: Pause };
    }

    if (startDate > now) {
      return { status: 'scheduled', color: 'text-blue-600 bg-blue-100', icon: Clock };
    }

    if (endDate && endDate < now) {
      return { status: 'expired', color: 'text-red-600 bg-red-100', icon: AlertTriangle };
    }

    return { status: 'active', color: 'text-green-600 bg-green-100', icon: CheckCircle };
  };

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'expired', label: 'Expired' },
  ];

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'percentage', label: 'Percentage Discount' },
    { value: 'fixed_amount', label: 'Fixed Amount' },
    { value: 'buy_x_get_y', label: 'Buy X Get Y' },
    { value: 'free_shipping', label: 'Free Shipping' },
    { value: 'bundle', label: 'Bundle Discount' },
    { value: 'tiered', label: 'Tiered Discount' },
    { value: 'category_discount', label: 'Category Discount' },
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
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Tag className="h-6 w-6 mr-3" />
            Promotions & Discounts
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Create and manage promotional campaigns to boost sales and customer engagement.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Promotion
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Tag className="h-5 w-5 text-blue-500" />
            <span className="ml-2 text-sm font-medium text-blue-900">Total Promotions</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-900">{metrics.totalPromotions}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="ml-2 text-sm font-medium text-green-900">Active</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-green-900">{metrics.activePromotions}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-purple-500" />
            <span className="ml-2 text-sm font-medium text-purple-900">Total Discounts</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-purple-900">
            ${metrics.totalDiscountGiven.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            <span className="ml-2 text-sm font-medium text-orange-900">Orders with Promos</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-orange-900">{metrics.totalOrdersWithPromotions}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-red-500" />
            <span className="ml-2 text-sm font-medium text-red-900">Avg Discount</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-900">
            ${metrics.averageDiscountPerOrder.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Promotions
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
                placeholder="Search by name, description, or type..."
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
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Type
            </label>
            <select
              id="type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Promotions Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promotion
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type & Discount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'No promotions found matching your filters.'
                        : 'No promotions created yet. Click "Create Promotion" to get started.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((promotion) => {
                    const statusInfo = getPromotionStatus(promotion);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <tr key={promotion.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Tag className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {promotion.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {promotion.description || 'No description'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 capitalize">
                            {promotion.promotion_type.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {promotion.discount_type === 'percentage' 
                              ? `${promotion.discount_value}% off`
                              : `$${promotion.discount_value} off`
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{new Date(promotion.start_date).toLocaleDateString()}</div>
                          <div>
                            {promotion.end_date 
                              ? `to ${new Date(promotion.end_date).toLocaleDateString()}`
                              : 'No end date'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{promotion.usage_stats.total_usage} uses</div>
                          <div>{promotion.usage_stats.unique_customers} customers</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="text-green-600 font-medium">
                            ${promotion.usage_stats.total_discount_given.toFixed(2)}
                          </div>
                          <div>total discount</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDetails(promotion)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(promotion)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(promotion)}
                              className={promotion.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                              title={promotion.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {promotion.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDuplicate(promotion)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(promotion)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
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
      </div>

      {/* Promotion Modal */}
      <PromotionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        promotion={selectedPromotion}
        onSuccess={() => {
          fetchPromotions();
          fetchMetrics();
        }}
      />

      {/* Promotion Details Modal */}
      {selectedPromotion && (
        <PromotionDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          promotion={selectedPromotion}
        />
      )}
    </div>
  );
}