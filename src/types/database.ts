import { createClient } from '@supabase/supabase-js';

export interface Tenant {
  id: string;
  name: string;
  created_at: string;
  subscription_plan: string;
  max_users: number;
}

export interface Profile {
  id: string;
  tenant_id: string;
  role: 'admin' | 'sales' | 'presales' | 'delivery' | 'warehouse' | 'superadmin' | 'agent';
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
  assigned_location_id?: string;
}

export interface TenantModule {
  tenant_id: string;
  module_name: 'presales_delivery' | 'van_sales' | 'wms';
  enabled: boolean;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'email' | 'url';
  description?: string;
  tenant_id?: string;
  category: 'general' | 'email' | 'security' | 'features' | 'integrations' | 'appearance' | 'notifications';
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  price: number;
  sku: string;
  stock_quantity: number;
  category: string;
  created_at: string;
  unit?: string;
  min_stock: number;
  max_stock?: number;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_date: string;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  source?: 'web' | 'van_sales' | 'whatsapp' | 'presales';
  customer?: Customer;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  product?: Product;
  products?: {
    name: string;
    category?: string;
  };
}

export interface Invoice {
  id: string;
  tenant_id: string;
  order_id: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  created_at: string;
}

export interface InvoiceWithOrder extends Invoice {
  orders: {
    customer_id: string;
    order_date: string;
  };
}

export interface Delivery {
  id: string;
  order_id: string;
  tenant_id: string;
  delivery_staff_id: string;
  route_id?: string;
  sequence_number?: number;
  tracking_number: string;
  status: 'assigned' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled';
  estimated_delivery: string;
  actual_delivery: string | null;
  delivery_notes?: string;
  shipping_cost: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  signature_url?: string;
  proof_of_delivery_image_url?: string;
  customer_feedback?: string;
  delivery_rating?: number;
  route_number?: string;
  delivery_zone?: string;
}

// New interface for delivery notices
export interface DeliveryNotice {
  id: string;
  delivery_id: string;
  tenant_id: string;
  title: string;
  message: string;
  status: 'unread' | 'read';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  created_by: string;
  delivery?: Delivery;
  created_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface DeliveryMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  averageDeliveryTime: number;
  totalDeliveryCost: number;
  deliveriesByStatus: {
    status: Delivery['status'];
    count: number;
  }[];
  staffPerformance: {
    staff_id: string;
    name: string;
    deliveries: number;
    onTimeRate: number;
    averageTime: number;
  }[];
  routePerformance: {
    route: string;
    deliveries: number;
    averageTime: number;
  }[];
}

export interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueGrowth: number;
  orderGrowth: number;
  topSellingProducts: {
    product_id: string;
    product_name: string;
    total_quantity: number;
    total_revenue: number;
    orders_count: number;
  }[];
  topCustomers: {
    customer_id: string;
    customer_name: string;
    total_orders: number;
    total_spent: number;
    last_order_date: string;
  }[];
  salesByCategory: {
    category: string;
    total_revenue: number;
    total_quantity: number;
    orders_count: number;
  }[];
  revenueByMonth: {
    month: string;
    revenue: number;
    orders: number;
  }[];
  salesByStatus: {
    status: Order['status'];
    count: number;
    revenue: number;
  }[];
}

export interface Route {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  type: 'delivery' | 'sales' | 'mixed';
  created_at: string;
}

// New Route Planning Module Types
export interface RouteCustomer {
  id: string;
  route_id: string;
  customer_id: string;
  sequence_number: number;
  assigned_date: string;
  notes?: string;
  created_at: string;
  route?: Route;
  customer?: Customer;
}

export interface RouteAgentAssignment {
  id: string;
  route_id: string;
  agent_id: string;
  start_date: string;
  end_date?: string;
  assigned_days_of_week: number[];
  is_recurring: boolean;
  notes?: string;
  created_at: string;
  route?: Route;
  agent?: Profile;
}

export interface VisitSchedule {
  id: string;
  route_customer_id: string;
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequency_value: number;
  start_date: string;
  end_date?: string;
  days_of_week?: number[];
  day_of_month?: number;
  exclude_dates?: string[];
  notes?: string;
  created_at: string;
  tenant_id: string;
  route_customer?: RouteCustomer;
}

// Van Sales Module Types
export interface VanInventory {
  id: string;
  profile_id: string;
  product_id: string;
  quantity: number;
  last_updated_at: string;
  product?: Product;
}

export interface VanStockMovement {
  id: string;
  profile_id: string;
  product_id: string;
  movement_type: 'load' | 'unload' | 'sale' | 'adjustment';
  quantity: number;
  reference_order_id?: string;
  notes?: string;
  created_at: string;
  product?: Product;
}

export interface VanSalesOrder extends Order {
  van_sale: boolean;
  sales_rep_id: string;
}

// Visit Management Types
export interface Visit {
  id: string;
  tenant_id: string;
  customer_id: string;
  visit_date: string;
  notes?: string;
  outcome?: 'successful' | 'unsuccessful' | 'rescheduled' | 'cancelled' | 'pending';
  photos_url?: string[];
  created_by: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  schedule_id?: string; // New field to link to visit_schedules
}

export interface VisitWithDetails extends Visit {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  created_by_profile: {
    first_name: string;
    last_name: string;
    role?: string;
  };
  schedule?: VisitSchedule;
}

// Warehouse/Inventory Module Types
export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  location_type: 'warehouse' | 'store' | 'van' | 'supplier' | 'customer';
  address?: string;
  is_active: boolean;
  created_at: string;
  immatriculation?: string; // Added immatriculation field for vehicles
}

export interface InventoryTransaction {
  id: string;
  tenant_id: string;
  product_id: string;
  location_id: string;
  transaction_type: 'in' | 'out' | 'adjustment' | 'transfer_in' | 'transfer_out';
  quantity: number;
  reference_id?: string;
  notes?: string;
  performed_by: string;
  transaction_date: string;
  created_at: string;
  product?: Product;
  location?: Location;
  performed_by_profile?: Profile;
}

export interface StockTransfer {
  id: string;
  tenant_id: string;
  from_location_id: string;
  to_location_id: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  transfer_date: string;
  completed_date?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  from_location?: Location;
  to_location?: Location;
  created_by_profile?: Profile;
  transfer_items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface LocationInventory {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  last_updated_at: string;
  location?: Location;
  product?: Product;
}

export interface InventoryMetrics {
  totalLocations: number;
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  pendingTransfers: number;
  recentTransactions: InventoryTransaction[];
  stockByLocation: {
    location_id: string;
    location_name: string;
    total_items: number;
    total_value: number;
  }[];
  topMovingProducts: {
    product_id: string;
    product_name: string;
    total_movements: number;
    net_change: number;
  }[];
}

// Supplier Orders Module Types
export interface SupplierOrder {
  id: string;
  tenant_id: string;
  supplier_name: string;
  order_number?: string;
  order_date: string;
  expected_date?: string;
  receiving_location_id: string;
  status: 'pending' | 'received' | 'partial' | 'cancelled';
  total_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  receiving_location?: Location;
  created_by_profile?: {
    first_name: string;
    last_name: string;
  };
  order_items?: SupplierOrderItem[];
}

export interface SupplierOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  created_at: string;
  product?: Product;
}

// WMS Module Types - Updated for unified schema
export interface WmsUser {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'picker' | 'receiver';
  warehouse_id?: string;
  created_at: string;
  updated_at: string;
  warehouse?: Location;
}

export interface WmsLocation {
  id: string;
  parent_location_id: string; // References locations table
  zone: string;
  aisle: string;
  shelf: string;
  position: string;
  created_at: string;
  updated_at: string;
  warehouse?: Location; // Parent location
}

export interface WmsProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  min_stock: number;
  max_stock?: number;
  unit_price?: number;
  created_at: string;
  updated_at: string;
}

export interface WmsInventory {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  lot_number?: string;
  expiration_date?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  location?: WmsLocation;
}

export interface WmsReceiving {
  id: string;
  reference_number: string;
  warehouse_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  received_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  warehouse?: Location;
  received_by_user?: WmsUser;
  receiving_items?: WmsReceivingItem[];
}

export interface WmsReceivingItem {
  id: string;
  receiving_id: string;
  product_id: string;
  expected_quantity: number;
  received_quantity?: number;
  lot_number?: string;
  expiration_date?: string;
  location_id?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  location?: WmsLocation;
}

export interface WmsPicking {
  id: string;
  reference_number: string;
  warehouse_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  picked_by?: string;
  picked_at?: string;
  created_at: string;
  updated_at: string;
  warehouse?: Location;
  picked_by_user?: WmsUser;
  picking_items?: WmsPickingItem[];
}

export interface WmsPickingItem {
  id: string;
  picking_id: string;
  product_id: string;
  location_id: string;
  requested_quantity: number;
  picked_quantity?: number;
  lot_number?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  location?: WmsLocation;
}

export interface WmsTransfer {
  id: string;
  reference_number: string;
  from_location_id: string;
  to_location_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  initiated_by: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  from_location?: WmsLocation;
  to_location?: WmsLocation;
  initiated_by_user?: WmsUser;
  completed_by_user?: WmsUser;
  transfer_items?: WmsTransferItem[];
}

export interface WmsTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  lot_number?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface WmsAuditLog {
  id: string;
  user_id?: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  created_at: string;
  user?: WmsUser;
}

export interface WmsMetrics {
  totalWarehouses: number;
  totalProducts: number;
  totalLocations: number;
  totalStockValue: number;
  lowStockItems: number;
  pendingReceivings: number;
  pendingPickings: number;
  pendingTransfers: number;
  recentAuditLogs: WmsAuditLog[];
  stockByWarehouse: {
    warehouse_id: string;
    warehouse_name: string;
    total_items: number;
    total_value: number;
  }[];
  topMovingProducts: {
    product_id: string;
    product_name: string;
    total_movements: number;
    net_change: number;
  }[];
}

// Promotions Module Types
export interface Promotion {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  promotion_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'free_shipping' | 'bundle' | 'tiered' | 'category_discount';
  discount_type: 'percentage' | 'fixed_amount' | 'free_item' | 'free_shipping' | 'buy_x_get_y_free' | 'buy_x_get_y_discount';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount_amount?: number;
  is_active: boolean;
  is_stackable: boolean;
  priority: number;
  start_date: string;
  end_date?: string;
  usage_limit?: number;
  usage_limit_per_customer?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PromotionRule {
  id: string;
  promotion_id: string;
  rule_type: 'order' | 'product' | 'customer' | 'time' | 'quantity' | 'category';
  field_name: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains' | 'in' | 'not_in' | 'between';
  value: string;
  logical_operator: 'AND' | 'OR';
  rule_group: number;
  created_at: string;
}

export interface PromotionAction {
  id: string;
  promotion_id: string;
  action_type: 'discount_percentage' | 'discount_fixed' | 'add_free_item' | 'free_shipping' | 'upgrade_shipping' | 'apply_to_category' | 'apply_to_product';
  target_type: 'order' | 'product' | 'category' | 'shipping' | 'cheapest_item' | 'most_expensive_item' | 'specific_product';
  target_value?: string;
  action_value?: number;
  action_data?: any;
  created_at: string;
}

export interface PromotionProductEligibility {
  id: string;
  promotion_id: string;
  product_id: string;
  is_included: boolean;
  created_at: string;
  product?: Product;
}

export interface PromotionCategoryEligibility {
  id: string;
  promotion_id: string;
  category: string;
  is_included: boolean;
  created_at: string;
}

export interface PromotionCustomerEligibility {
  id: string;
  promotion_id: string;
  customer_group: 'all' | 'new' | 'returning' | 'vip' | 'wholesale' | 'retail' | 'specific';
  customer_id?: string;
  is_included: boolean;
  created_at: string;
  customer?: Customer;
}

export interface AppliedPromotion {
  id: string;
  promotion_id: string;
  order_id: string;
  customer_id: string;
  discount_amount: number;
  applied_at: string;
  applied_by?: string;
  promotion?: Promotion;
}

export interface PromotionUsageLimit {
  id: string;
  promotion_id: string;
  customer_id?: string;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
}

export interface PromotionWithDetails extends Promotion {
  rules: PromotionRule[];
  actions: PromotionAction[];
  product_eligibility: PromotionProductEligibility[];
  category_eligibility: PromotionCategoryEligibility[];
  customer_eligibility: PromotionCustomerEligibility[];
  usage_stats: {
    total_usage: number;
    total_discount_given: number;
    unique_customers: number;
  };
}

export interface PromotionMetrics {
  totalPromotions: number;
  activePromotions: number;
  totalDiscountGiven: number;
  totalOrdersWithPromotions: number;
  averageDiscountPerOrder: number;
  topPerformingPromotions: {
    promotion_id: string;
    promotion_name: string;
    usage_count: number;
    total_discount: number;
    conversion_rate: number;
  }[];
  promotionsByType: {
    type: Promotion['promotion_type'];
    count: number;
    total_discount: number;
  }[];
  recentApplications: AppliedPromotion[];
}

// Payment Module Types
export interface Payment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'credit_card' | 'bank_transfer' | 'check' | 'other';
  payment_reference?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  invoice?: Invoice;
  created_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

// Vehicle Management Types
export interface Vehicle extends Location {
  // Vehicle is just a Location with location_type = 'van'
  // We can add vehicle-specific fields here if needed in the future
}

export interface VehicleAssignment {
  agent_id: string;
  vehicle_id: string;
  assigned_date: string;
  notes?: string;
  created_at: string;
  agent?: Profile;
  vehicle?: Vehicle;
}

// Marketing Module Types
export interface PromotionalContent {
  id: string;
  tenant_id: string;
  name: string;
  type: 'text' | 'image' | 'video';
  content_text?: string;
  content_url?: string;
  created_at: string;
  created_by: string;
  created_by_profile?: Profile;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  target_audience: 'all_customers' | 'new_customers' | 'specific_customers' | 'customer_segment';
  ai_notes?: any;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_profile?: Profile;
  promotional_content?: {
    promotional_content_id: string;
    sequence_number: number;
    promotional_content: PromotionalContent;
  }[];
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  metric_date: string;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  responses_received: number;
  orders_placed: number;
  revenue_generated: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  tenant_id: string;
  from_number: string;
  to_number: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'other';
  content?: string;
  media_url?: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'received' | 'read' | 'failed';
  customer_id?: string;
  session_id?: string;
  created_at: string;
  customer?: Customer;
}

export interface WhatsAppSession {
  id: string;
  tenant_id: string;
  customer_id: string;
  phone_number: string;
  last_message_at: string;
  status: 'active' | 'closed';
  created_at: string;
  customer?: Customer;
  messages?: WhatsAppMessage[];
}

export interface MarketingMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalMessagesSent: number;
  totalOrdersFromWhatsApp: number;
  revenueFromWhatsApp: number;
  campaignPerformance: {
    campaign_id: string;
    campaign_name: string;
    messages_sent: number;
    response_rate: number;
    conversion_rate: number;
    revenue: number;
  }[];
  whatsAppActivity: {
    date: string;
    messages_sent: number;
    messages_received: number;
    orders_placed: number;
  }[];
  topPerformingContent: {
    content_id: string;
    content_name: string;
    content_type: string;
    engagement_rate: number;
    conversion_rate: number;
  }[];
}