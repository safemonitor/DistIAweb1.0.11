import { supabase } from './supabase';

export interface ActivityLogData {
  action_type: string;
  details?: Record<string, any>;
}

export async function logActivity(action_type: string, details?: Record<string, any>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('Cannot log activity: User not authenticated');
      return;
    }

    // Get the user's tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const { error } = await supabase
      .from('user_activity_logs')
      .insert([{
        user_id: user.id,
        tenant_id: profile?.tenant_id || null, // Include tenant_id in the activity log
        action_type,
        details: details || null,
      }]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Predefined action types for consistency
export const ActivityTypes = {
  // Authentication
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_SIGNUP: 'user_signup',
  
  // Products
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
  PRODUCT_IMPORT: 'product_import',
  
  // Customers
  CUSTOMER_CREATED: 'customer_created',
  CUSTOMER_UPDATED: 'customer_updated',
  CUSTOMER_DELETED: 'customer_deleted',
  
  // Orders
  ORDER_CREATED: 'order_created',
  ORDER_UPDATED: 'order_updated',
  ORDER_DELETED: 'order_deleted',
  
  // Invoices
  INVOICE_CREATED: 'invoice_created',
  INVOICE_UPDATED: 'invoice_updated',
  INVOICE_DELETED: 'invoice_deleted',
  
  // Visits
  VISIT_CREATED: 'visit_created',
  VISIT_UPDATED: 'visit_updated',
  VISIT_DELETED: 'visit_deleted',
  
  // Locations
  LOCATION_CREATED: 'location_created',
  LOCATION_UPDATED: 'location_updated',
  LOCATION_DELETED: 'location_deleted',
  
  // Inventory
  INVENTORY_TRANSACTION_CREATED: 'inventory_transaction_created',
  STOCK_TRANSFER_CREATED: 'stock_transfer_created',
  STOCK_TRANSFER_UPDATED: 'stock_transfer_updated',
  
  // Users & Tenants
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  TENANT_CREATED: 'tenant_created',
  TENANT_UPDATED: 'tenant_updated',
  TENANT_DELETED: 'tenant_deleted',
  
  // Routes
  ROUTE_CREATED: 'route_created',
  ROUTE_UPDATED: 'route_updated',
  ROUTE_DELETED: 'route_deleted',
  
  // Deliveries
  DELIVERY_ASSIGNED: 'delivery_assigned',
  DELIVERY_STATUS_UPDATED: 'delivery_status_updated',
  DELIVERY_COMPLETED: 'delivery_completed',
  
  // Van Sales
  VAN_STOCK_LOADED: 'van_stock_loaded',
  VAN_STOCK_UNLOADED: 'van_stock_unloaded',
  VAN_SALE_CREATED: 'van_sale_created',
  
  // Settings
  SETTINGS_UPDATED: 'settings_updated',
  
  // Supplier Orders
  SUPPLIER_ORDER_CREATED: 'supplier_order_created',
  SUPPLIER_ORDER_UPDATED: 'supplier_order_updated',
  SUPPLIER_ORDER_RECEIVED: 'supplier_order_received',
  SUPPLIER_ORDER_CANCELLED: 'supplier_order_cancelled',
} as const;