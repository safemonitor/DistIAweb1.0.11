import { useState } from 'react';
import { Modal } from './Modal';
import { 
  Tag, 
  DollarSign, 
  Calendar, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  Package, 
  Layers, 
  FileText 
} from 'lucide-react';
import type { PromotionWithDetails } from '../types/database';

interface PromotionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: PromotionWithDetails;
}

export function PromotionDetailsModal({ isOpen, onClose, promotion }: PromotionDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'eligibility' | 'usage'>('overview');

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date set';
    return new Date(dateString).toLocaleDateString();
  };

  const getPromotionTypeLabel = (type: string) => {
    const types = {
      percentage: 'Percentage Discount',
      fixed_amount: 'Fixed Amount',
      buy_x_get_y: 'Buy X Get Y',
      free_shipping: 'Free Shipping',
      bundle: 'Bundle Discount',
      tiered: 'Tiered Discount',
      category_discount: 'Category Discount'
    };
    return types[type as keyof typeof types] || type;
  };

  const getDiscountTypeLabel = (type: string) => {
    const types = {
      percentage: 'Percentage Off',
      fixed_amount: 'Fixed Amount Off',
      free_item: 'Free Item',
      free_shipping: 'Free Shipping',
      buy_x_get_y_free: 'Buy X Get Y Free',
      buy_x_get_y_discount: 'Buy X Get Y Discounted'
    };
    return types[type as keyof typeof types] || type;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Promotion Details"
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rules'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rules
            </button>
            <button
              onClick={() => setActiveTab('eligibility')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'eligibility'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Eligibility
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'usage'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Usage
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Tag className="h-5 w-5 mr-2 text-indigo-600" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Promotion Name</p>
                  <p className="mt-1 text-sm text-gray-900">{promotion.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <div className="mt-1">
                    {promotion.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-500">Description</p>
                  <p className="mt-1 text-sm text-gray-900">{promotion.description || 'No description provided'}</p>
                </div>
              </div>
            </div>

            {/* Discount Configuration */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-indigo-600" />
                Discount Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Promotion Type</p>
                  <p className="mt-1 text-sm text-gray-900">{getPromotionTypeLabel(promotion.promotion_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Discount Type</p>
                  <p className="mt-1 text-sm text-gray-900">{getDiscountTypeLabel(promotion.discount_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Discount Value</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {promotion.discount_type === 'percentage' 
                      ? `${promotion.discount_value}%` 
                      : `$${promotion.discount_value.toFixed(2)}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Minimum Order Amount</p>
                  <p className="mt-1 text-sm text-gray-900">
                    ${promotion.minimum_order_amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Maximum Discount Amount</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {promotion.maximum_discount_amount 
                      ? `$${promotion.maximum_discount_amount.toFixed(2)}` 
                      : 'No maximum'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Stackable</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {promotion.is_stackable ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>

            {/* Validity Period */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                Validity Period
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Start Date</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(promotion.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">End Date</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(promotion.end_date)}</p>
                </div>
              </div>
            </div>

            {/* Usage Limits */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Usage Limits
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Usage Limit</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {promotion.usage_limit || 'Unlimited'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Usage Limit Per Customer</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {promotion.usage_limit_per_customer || 'Unlimited'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Priority</p>
                  <p className="mt-1 text-sm text-gray-900">{promotion.priority}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                Promotion Rules
              </h3>
              
              {promotion.rules && promotion.rules.length > 0 ? (
                <div className="space-y-4">
                  {promotion.rules.map((rule, index) => (
                    <div key={rule.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Rule {index + 1}: {rule.rule_type.charAt(0).toUpperCase() + rule.rule_type.slice(1)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {rule.field_name} {rule.operator.replace(/_/g, ' ')} {rule.value}
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Group {rule.rule_group}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific rules defined for this promotion.</p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Layers className="h-5 w-5 mr-2 text-indigo-600" />
                Promotion Actions
              </h3>
              
              {promotion.actions && promotion.actions.length > 0 ? (
                <div className="space-y-4">
                  {promotion.actions.map((action, index) => (
                    <div key={action.id} className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        Action {index + 1}: {action.action_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        Target: {action.target_type.replace(/_/g, ' ')}
                        {action.target_value ? ` (${action.target_value})` : ''}
                      </p>
                      {action.action_value && (
                        <p className="text-sm text-gray-500">
                          Value: {action.action_value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific actions defined for this promotion.</p>
              )}
            </div>
          </div>
        )}

        {/* Eligibility Tab */}
        {activeTab === 'eligibility' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-indigo-600" />
                Product Eligibility
              </h3>
              
              {promotion.product_eligibility && promotion.product_eligibility.length > 0 ? (
                <div className="space-y-2">
                  {promotion.product_eligibility.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.product?.name || 'Unknown Product'}
                        </p>
                        <p className="text-xs text-gray-500">
                          SKU: {item.product?.sku || 'N/A'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.is_included 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.is_included ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific product eligibility rules defined. All products are eligible.</p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Layers className="h-5 w-5 mr-2 text-indigo-600" />
                Category Eligibility
              </h3>
              
              {promotion.category_eligibility && promotion.category_eligibility.length > 0 ? (
                <div className="space-y-2">
                  {promotion.category_eligibility.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {item.category}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.is_included 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.is_included ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific category eligibility rules defined. All categories are eligible.</p>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-indigo-600" />
                Customer Eligibility
              </h3>
              
              {promotion.customer_eligibility && promotion.customer_eligibility.length > 0 ? (
                <div className="space-y-2">
                  {promotion.customer_eligibility.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                      <div>
                        {item.customer_group === 'specific' ? (
                          <p className="text-sm font-medium text-gray-900">
                            {item.customer?.name || 'Unknown Customer'}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {item.customer_group} Customers
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.is_included 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.is_included ? 'Included' : 'Excluded'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No specific customer eligibility rules defined. All customers are eligible.</p>
              )}
            </div>
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Usage Statistics
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm font-medium text-gray-500">Total Uses</p>
                  <p className="mt-1 text-2xl font-semibold text-indigo-600">
                    {promotion.usage_stats?.total_usage || 0}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm font-medium text-gray-500">Total Discount Given</p>
                  <p className="mt-1 text-2xl font-semibold text-indigo-600">
                    ${promotion.usage_stats?.total_discount_given.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm font-medium text-gray-500">Unique Customers</p>
                  <p className="mt-1 text-2xl font-semibold text-indigo-600">
                    {promotion.usage_stats?.unique_customers || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}