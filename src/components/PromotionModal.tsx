import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { supabase } from '../lib/supabase';
import { logActivity, ActivityTypes } from '../lib/activityLogger';
import { Calendar, DollarSign, Tag, BarChart3, Clock, CheckCircle, XCircle, Users, Package, Layers, FileText, Plus, Minus, AlertTriangle } from 'lucide-react';
import type { PromotionWithDetails, Product, Customer, PromotionRule } from '../types/database';

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion?: PromotionWithDetails;
  onSuccess: () => void;
}

export function PromotionModal({ isOpen, onClose, promotion, onSuccess }: PromotionModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'rules' | 'eligibility'>('details');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotion_type: 'percentage',
    discount_type: 'percentage',
    discount_value: 0,
    minimum_order_amount: 0,
    maximum_discount_amount: 0,
    is_active: true,
    is_stackable: false,
    priority: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    usage_limit: 0,
    usage_limit_per_customer: 0
  });
  
  // Eligibility state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customerGroup, setCustomerGroup] = useState<string>('all');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  
  // Rules state
  const [rules, setRules] = useState<PromotionRule[]>([]);
  const [newRule, setNewRule] = useState<Omit<PromotionRule, 'id' | 'promotion_id' | 'created_at'>>({
    rule_type: 'order',
    field_name: 'total_amount',
    operator: 'greater_than',
    value: '0',
    logical_operator: 'AND',
    rule_group: 1
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      
      if (promotion) {
        setFormData({
          name: promotion.name || '',
          description: promotion.description || '',
          promotion_type: promotion.promotion_type || 'percentage',
          discount_type: promotion.discount_type || 'percentage',
          discount_value: promotion.discount_value || 0,
          minimum_order_amount: promotion.minimum_order_amount || 0,
          maximum_discount_amount: promotion.maximum_discount_amount || 0,
          is_active: promotion.is_active !== undefined ? promotion.is_active : true,
          is_stackable: promotion.is_stackable !== undefined ? promotion.is_stackable : false,
          priority: promotion.priority || 0,
          start_date: promotion.start_date ? new Date(promotion.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          end_date: promotion.end_date ? new Date(promotion.end_date).toISOString().split('T')[0] : '',
          usage_limit: promotion.usage_limit || 0,
          usage_limit_per_customer: promotion.usage_limit_per_customer || 0
        });
        
        // Set eligibility data if editing an existing promotion
        if (promotion.product_eligibility && promotion.product_eligibility.length > 0) {
          const includedProductIds = promotion.product_eligibility
            .filter(pe => pe.is_included)
            .map(pe => pe.product_id);
          setSelectedProducts(includedProductIds);
        }
        
        if (promotion.category_eligibility && promotion.category_eligibility.length > 0) {
          const includedCategories = promotion.category_eligibility
            .filter(ce => ce.is_included)
            .map(ce => ce.category);
          setSelectedCategories(includedCategories);
        }
        
        if (promotion.customer_eligibility && promotion.customer_eligibility.length > 0) {
          // Find the first customer eligibility entry to determine the group
          const firstEntry = promotion.customer_eligibility[0];
          setCustomerGroup(firstEntry.customer_group);
          
          if (firstEntry.customer_group === 'specific') {
            const includedCustomerIds = promotion.customer_eligibility
              .filter(ce => ce.is_included && ce.customer_id)
              .map(ce => ce.customer_id as string);
            setSelectedCustomers(includedCustomerIds);
          }
        }
        
        // Set rules data if editing an existing promotion
        if (promotion.rules && promotion.rules.length > 0) {
          setRules(promotion.rules);
        }
      } else {
        // Reset form for new promotion
        setFormData({
          name: '',
          description: '',
          promotion_type: 'percentage',
          discount_type: 'percentage',
          discount_value: 0,
          minimum_order_amount: 0,
          maximum_discount_amount: 0,
          is_active: true,
          is_stackable: false,
          priority: 0,
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          usage_limit: 0,
          usage_limit_per_customer: 0
        });
        
        // Reset eligibility selections
        setSelectedProducts([]);
        setSelectedCategories([]);
        setCustomerGroup('all');
        setSelectedCustomers([]);
        
        // Reset rules
        setRules([]);
      }
    }
  }, [promotion, isOpen]);

  const fetchData = async () => {
    setIsDataLoading(true);
    try {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (productsError) throw productsError;
      setProducts(productsData || []);
      
      // Extract unique categories from products
      const uniqueCategories = Array.from(
        new Set(productsData?.map(p => p.category) || [])
      ).filter(Boolean) as string[];
      setCategories(uniqueCategories);
      
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (customersError) throw customersError;
      setCustomers(customersData || []);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load products and customers');
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? 0 : parseFloat(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleCustomerToggle = (customerId: string) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };
  
  const handleRuleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setNewRule(prev => ({
        ...prev,
        [name]: value === '' ? '0' : value
      }));
    } else {
      setNewRule(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const addRule = () => {
    setRules(prev => [...prev, { ...newRule, id: `temp-${Date.now()}`, promotion_id: promotion?.id || '', created_at: new Date().toISOString() }]);
    
    // Reset the new rule form to defaults
    setNewRule({
      rule_type: 'order',
      field_name: 'total_amount',
      operator: 'greater_than',
      value: '0',
      logical_operator: 'AND',
      rule_group: 1
    });
  };
  
  const removeRule = (ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
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

      // Prepare the data for insert/update
      const promotionData = {
        name: formData.name,
        description: formData.description,
        promotion_type: formData.promotion_type,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        minimum_order_amount: formData.minimum_order_amount,
        maximum_discount_amount: formData.maximum_discount_amount || null,
        is_active: formData.is_active,
        is_stackable: formData.is_stackable,
        priority: formData.priority,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        usage_limit: formData.usage_limit || null,
        usage_limit_per_customer: formData.usage_limit_per_customer || null,
        tenant_id,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      let promotionId: string;

      if (promotion) {
        // Update existing promotion
        const { error: updateError } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', promotion.id);

        if (updateError) throw updateError;
        promotionId = promotion.id;
        
        // Log activity
        await logActivity(ActivityTypes.PROMOTION_UPDATED, {
          promotion_id: promotion.id,
          promotion_name: formData.name,
          promotion_type: formData.promotion_type,
          discount_value: formData.discount_value
        });
      } else {
        // Create new promotion
        const { data: newPromotion, error: insertError } = await supabase
          .from('promotions')
          .insert([promotionData])
          .select()
          .single();

        if (insertError) throw insertError;
        promotionId = newPromotion.id;
        
        // Log activity
        await logActivity(ActivityTypes.PROMOTION_CREATED, {
          promotion_id: newPromotion.id,
          promotion_name: formData.name,
          promotion_type: formData.promotion_type,
          discount_value: formData.discount_value
        });
      }

      // Handle product eligibility
      if (selectedProducts.length > 0) {
        // First, delete any existing product eligibility records
        if (promotion) {
          const { error: deleteError } = await supabase
            .from('promotion_product_eligibility')
            .delete()
            .eq('promotion_id', promotionId);
          
          if (deleteError) throw deleteError;
        }
        
        // Insert new product eligibility records
        const productEligibilityData = selectedProducts.map(productId => ({
          promotion_id: promotionId,
          product_id: productId,
          is_included: true,
          tenant_id
        }));
        
        const { error: productEligibilityError } = await supabase
          .from('promotion_product_eligibility')
          .insert(productEligibilityData);
        
        if (productEligibilityError) throw productEligibilityError;
      }

      // Handle category eligibility
      if (selectedCategories.length > 0) {
        // First, delete any existing category eligibility records
        if (promotion) {
          const { error: deleteError } = await supabase
            .from('promotion_category_eligibility')
            .delete()
            .eq('promotion_id', promotionId);
          
          if (deleteError) throw deleteError;
        }
        
        // Insert new category eligibility records
        const categoryEligibilityData = selectedCategories.map(category => ({
          promotion_id: promotionId,
          category,
          is_included: true,
          tenant_id
        }));
        
        const { error: categoryEligibilityError } = await supabase
          .from('promotion_category_eligibility')
          .insert(categoryEligibilityData);
        
        if (categoryEligibilityError) throw categoryEligibilityError;
      }

      // Handle customer eligibility
      // First, delete any existing customer eligibility records
      if (promotion) {
        const { error: deleteError } = await supabase
          .from('promotion_customer_eligibility')
          .delete()
          .eq('promotion_id', promotionId);
        
        if (deleteError) throw deleteError;
      }
      
      if (customerGroup === 'specific' && selectedCustomers.length > 0) {
        // Insert specific customer eligibility records
        const customerEligibilityData = selectedCustomers.map(customerId => ({
          promotion_id: promotionId,
          customer_group: 'specific',
          customer_id: customerId,
          is_included: true,
          tenant_id
        }));
        
        const { error: customerEligibilityError } = await supabase
          .from('promotion_customer_eligibility')
          .insert(customerEligibilityData);
        
        if (customerEligibilityError) throw customerEligibilityError;
      } else {
        // Insert a single record for the customer group
        const { error: customerEligibilityError } = await supabase
          .from('promotion_customer_eligibility')
          .insert([{
            promotion_id: promotionId,
            customer_group: customerGroup,
            is_included: true,
            tenant_id
          }]);
        
        if (customerEligibilityError) throw customerEligibilityError;
      }
      
      // Handle promotion rules
      if (rules.length > 0) {
        // First, delete any existing rules
        if (promotion) {
          const { error: deleteRulesError } = await supabase
            .from('promotion_rules')
            .delete()
            .eq('promotion_id', promotionId);
          
          if (deleteRulesError) throw deleteRulesError;
        }
        
        // Insert new rules
        const rulesData = rules.map(rule => ({
          promotion_id: promotionId,
          rule_type: rule.rule_type,
          field_name: rule.field_name,
          operator: rule.operator,
          value: rule.value,
          logical_operator: rule.logical_operator,
          rule_group: rule.rule_group,
          tenant_id
        }));
        
        const { error: rulesError } = await supabase
          .from('promotion_rules')
          .insert(rulesData);
        
        if (rulesError) throw rulesError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving promotion:', err);
      setError(err instanceof Error ? err.message : 'Failed to save promotion');
    } finally {
      setIsLoading(false);
    }
  };

  const promotionTypes = [
    { value: 'percentage', label: 'Percentage Discount' },
    { value: 'fixed_amount', label: 'Fixed Amount' },
    { value: 'buy_x_get_y', label: 'Buy X Get Y' },
    { value: 'free_shipping', label: 'Free Shipping' },
    { value: 'bundle', label: 'Bundle Discount' },
    { value: 'tiered', label: 'Tiered Discount' },
    { value: 'category_discount', label: 'Category Discount' }
  ];

  const discountTypes = [
    { value: 'percentage', label: 'Percentage Off' },
    { value: 'fixed_amount', label: 'Fixed Amount Off' },
    { value: 'free_item', label: 'Free Item' },
    { value: 'free_shipping', label: 'Free Shipping' },
    { value: 'buy_x_get_y_free', label: 'Buy X Get Y Free' },
    { value: 'buy_x_get_y_discount', label: 'Buy X Get Y Discounted' }
  ];

  const customerGroups = [
    { value: 'all', label: 'All Customers' },
    { value: 'new', label: 'New Customers' },
    { value: 'returning', label: 'Returning Customers' },
    { value: 'vip', label: 'VIP Customers' },
    { value: 'wholesale', label: 'Wholesale Customers' },
    { value: 'retail', label: 'Retail Customers' },
    { value: 'specific', label: 'Specific Customers' }
  ];
  
  const ruleTypes = [
    { value: 'order', label: 'Order' },
    { value: 'product', label: 'Product' },
    { value: 'customer', label: 'Customer' },
    { value: 'time', label: 'Time' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'category', label: 'Category' }
  ];
  
  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_equal', label: 'Greater Than or Equal' },
    { value: 'less_equal', label: 'Less Than or Equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not In' },
    { value: 'between', label: 'Between' }
  ];
  
  const logicalOperators = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];
  
  // Field name options based on rule type
  const getFieldNameOptions = (ruleType: string) => {
    switch (ruleType) {
      case 'order':
        return [
          { value: 'total_amount', label: 'Total Amount' },
          { value: 'item_count', label: 'Item Count' },
          { value: 'status', label: 'Status' }
        ];
      case 'product':
        return [
          { value: 'price', label: 'Price' },
          { value: 'category', label: 'Category' },
          { value: 'sku', label: 'SKU' }
        ];
      case 'customer':
        return [
          { value: 'email', label: 'Email' },
          { value: 'order_count', label: 'Order Count' },
          { value: 'total_spent', label: 'Total Spent' }
        ];
      case 'time':
        return [
          { value: 'day_of_week', label: 'Day of Week' },
          { value: 'hour_of_day', label: 'Hour of Day' },
          { value: 'date', label: 'Date' }
        ];
      case 'quantity':
        return [
          { value: 'product_quantity', label: 'Product Quantity' },
          { value: 'category_quantity', label: 'Category Quantity' }
        ];
      case 'category':
        return [
          { value: 'category_name', label: 'Category Name' },
          { value: 'category_count', label: 'Category Count' }
        ];
      default:
        return [];
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={promotion ? 'Edit Promotion' : 'Create Promotion'}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Tag className="h-4 w-4 inline mr-2" />
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('eligibility')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'eligibility'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Eligibility
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rules'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Rules
            </button>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  Basic Information
                </h3>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Promotion Name
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
              </div>

              {/* Discount Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Discount Configuration
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="promotion_type" className="block text-sm font-medium text-gray-700">
                      Promotion Type
                    </label>
                    <select
                      id="promotion_type"
                      name="promotion_type"
                      value={formData.promotion_type}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      {promotionTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="discount_type" className="block text-sm font-medium text-gray-700">
                      Discount Type
                    </label>
                    <select
                      id="discount_type"
                      name="discount_type"
                      value={formData.discount_type}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required
                    >
                      {discountTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="discount_value" className="block text-sm font-medium text-gray-700">
                      Discount Value
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      {formData.discount_type === 'percentage' ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">%</span>
                        </div>
                      ) : (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                      )}
                      <input
                        type="number"
                        id="discount_value"
                        name="discount_value"
                        value={formData.discount_value}
                        onChange={handleChange}
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                          formData.discount_type === 'percentage' ? '' : 'pl-7'
                        }`}
                        min="0"
                        step={formData.discount_type === 'percentage' ? "0.01" : "0.01"}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="minimum_order_amount" className="block text-sm font-medium text-gray-700">
                      Minimum Order Amount
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="minimum_order_amount"
                        name="minimum_order_amount"
                        value={formData.minimum_order_amount}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-7"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="maximum_discount_amount" className="block text-sm font-medium text-gray-700">
                    Maximum Discount Amount (Optional)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      id="maximum_discount_amount"
                      name="maximum_discount_amount"
                      value={formData.maximum_discount_amount}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-7"
                      min="0"
                      step="0.01"
                      placeholder="No maximum"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty for no maximum discount amount
                  </p>
                </div>
              </div>

              {/* Validity Period */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Validity Period
                </h3>
                
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
                    <p className="mt-1 text-xs text-gray-500">
                      Leave empty for no end date
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage Limits */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Usage Limits
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="usage_limit" className="block text-sm font-medium text-gray-700">
                      Total Usage Limit (Optional)
                    </label>
                    <input
                      type="number"
                      id="usage_limit"
                      name="usage_limit"
                      value={formData.usage_limit}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      min="0"
                      placeholder="Unlimited"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Maximum number of times this promotion can be used
                    </p>
                  </div>

                  <div>
                    <label htmlFor="usage_limit_per_customer" className="block text-sm font-medium text-gray-700">
                      Usage Limit Per Customer (Optional)
                    </label>
                    <input
                      type="number"
                      id="usage_limit_per_customer"
                      name="usage_limit_per_customer"
                      value={formData.usage_limit_per_customer}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      min="0"
                      placeholder="Unlimited"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Maximum number of times a customer can use this promotion
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Advanced Settings
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_stackable"
                      name="is_stackable"
                      checked={formData.is_stackable}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_stackable: e.target.checked }))}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_stackable" className="ml-2 block text-sm text-gray-900">
                      Stackable with other promotions
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                    Priority (Higher numbers take precedence)
                  </label>
                  <input
                    type="number"
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    min="0"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    When multiple promotions apply, the one with the highest priority will be used first
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Eligibility Tab */}
          {activeTab === 'eligibility' && (
            <div className="space-y-6">
              {isDataLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <>
                  {/* Product Eligibility */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center">
                      <Package className="h-4 w-4 mr-2" />
                      Product Eligibility
                    </h3>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-4">
                        Select which products are eligible for this promotion. If none are selected, all products are eligible.
                      </p>
                      
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {products.length === 0 ? (
                          <p className="text-sm text-gray-500">No products available</p>
                        ) : (
                          products.map(product => (
                            <div key={product.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`product-${product.id}`}
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => handleProductToggle(product.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <label htmlFor={`product-${product.id}`} className="ml-2 block text-sm text-gray-900">
                                {product.name} - ${product.price.toFixed(2)} ({product.sku})
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category Eligibility */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center">
                      <Layers className="h-4 w-4 mr-2" />
                      Category Eligibility
                    </h3>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-4">
                        Select which product categories are eligible for this promotion. If none are selected, all categories are eligible.
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {categories.length === 0 ? (
                          <p className="text-sm text-gray-500">No categories available</p>
                        ) : (
                          categories.map(category => (
                            <label
                              key={category}
                              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                                selectedCategories.includes(category)
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedCategories.includes(category)}
                                onChange={() => handleCategoryToggle(category)}
                              />
                              <span className="capitalize">{category}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Eligibility */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Customer Eligibility
                    </h3>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-4">
                        Select which customers are eligible for this promotion.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {customerGroups.map(group => (
                            <label
                              key={group.value}
                              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                                customerGroup === group.value
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                name="customerGroup"
                                value={group.value}
                                checked={customerGroup === group.value}
                                onChange={() => setCustomerGroup(group.value)}
                              />
                              {group.label}
                            </label>
                          ))}
                        </div>
                        
                        {customerGroup === 'specific' && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Select specific customers:
                            </p>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {customers.length === 0 ? (
                                <p className="text-sm text-gray-500">No customers available</p>
                              ) : (
                                customers.map(customer => (
                                  <div key={customer.id} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      id={`customer-${customer.id}`}
                                      checked={selectedCustomers.includes(customer.id)}
                                      onChange={() => handleCustomerToggle(customer.id)}
                                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor={`customer-${customer.id}`} className="ml-2 block text-sm text-gray-900">
                                      {customer.name} - {customer.email}
                                    </label>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 flex items-center mb-4">
                  <FileText className="h-4 w-4 mr-2" />
                  Advanced Rules
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Define conditions that must be met for this promotion to apply. Rules in the same group are combined with logical operators.
                </p>
                
                {/* Rule Builder Form */}
                <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="rule_type" className="block text-sm font-medium text-gray-700">
                        Rule Type
                      </label>
                      <select
                        id="rule_type"
                        name="rule_type"
                        value={newRule.rule_type}
                        onChange={handleRuleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {ruleTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="field_name" className="block text-sm font-medium text-gray-700">
                        Field
                      </label>
                      <select
                        id="field_name"
                        name="field_name"
                        value={newRule.field_name}
                        onChange={handleRuleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {getFieldNameOptions(newRule.rule_type).map(field => (
                          <option key={field.value} value={field.value}>{field.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="operator" className="block text-sm font-medium text-gray-700">
                        Operator
                      </label>
                      <select
                        id="operator"
                        name="operator"
                        value={newRule.operator}
                        onChange={handleRuleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="value" className="block text-sm font-medium text-gray-700">
                        Value
                      </label>
                      <input
                        type="text"
                        id="value"
                        name="value"
                        value={newRule.value}
                        onChange={handleRuleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="logical_operator" className="block text-sm font-medium text-gray-700">
                        Logical Operator
                      </label>
                      <select
                        id="logical_operator"
                        name="logical_operator"
                        value={newRule.logical_operator}
                        onChange={handleRuleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        {logicalOperators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="rule_group" className="block text-sm font-medium text-gray-700">
                        Rule Group
                      </label>
                      <input
                        type="number"
                        id="rule_group"
                        name="rule_group"
                        value={newRule.rule_group}
                        onChange={handleRuleChange}
                        min="1"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Rules in the same group are combined with the logical operator
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addRule}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </button>
                  </div>
                </div>
                
                {/* Rules List */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Defined Rules</h4>
                  
                  {rules.length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-gray-300 rounded-md">
                      <p className="text-sm text-gray-500">No rules defined yet. Add rules above.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rules.map((rule, index) => (
                        <div key={rule.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-md">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Rule {index + 1}: {rule.rule_type.charAt(0).toUpperCase() + rule.rule_type.slice(1)} - Group {rule.rule_group}
                            </p>
                            <p className="text-xs text-gray-500">
                              {rule.field_name} {rule.operator.replace(/_/g, ' ')} {rule.value}
                              {index < rules.length - 1 && ` ${rule.logical_operator}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRule(rule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5 text-blue-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">Rule Evaluation</h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>
                            Rules are evaluated in groups. Rules within the same group are combined using the specified logical operator (AND/OR).
                            Different groups are always combined with OR logic.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <XCircle className="h-5 w-5 text-red-400" />
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
              {isLoading ? 'Saving...' : promotion ? 'Update Promotion' : 'Create Promotion'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}