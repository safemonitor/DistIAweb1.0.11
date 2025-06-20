/*
  # Add ON DELETE CASCADE to Tenant Foreign Keys

  1. Changes
    - Modify foreign key constraints to add ON DELETE CASCADE
    - This allows deleting a tenant and automatically removing all related data
    - Affects all tables with tenant_id foreign keys
    
  2. Security
    - Maintains existing RLS policies
    - Ensures proper data cleanup when tenants are deleted
*/

-- Modify foreign key constraints to add ON DELETE CASCADE

-- profiles table
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey,
ADD CONSTRAINT profiles_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- tenant_modules table
ALTER TABLE tenant_modules
DROP CONSTRAINT IF EXISTS tenant_modules_tenant_id_fkey,
ADD CONSTRAINT tenant_modules_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- products table
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_tenant_id_fkey,
ADD CONSTRAINT products_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- orders table
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_tenant_id_fkey,
ADD CONSTRAINT orders_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- order_items table
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS order_items_tenant_id_fkey,
ADD CONSTRAINT order_items_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- invoices table
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_tenant_id_fkey,
ADD CONSTRAINT invoices_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- customers table
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_tenant_id_fkey,
ADD CONSTRAINT customers_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- deliveries table
ALTER TABLE deliveries
DROP CONSTRAINT IF EXISTS deliveries_tenant_id_fkey,
ADD CONSTRAINT deliveries_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- delivery_performance_logs table
ALTER TABLE delivery_performance_logs
DROP CONSTRAINT IF EXISTS delivery_performance_logs_tenant_id_fkey,
ADD CONSTRAINT delivery_performance_logs_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- delivery_notices table
ALTER TABLE delivery_notices
DROP CONSTRAINT IF EXISTS delivery_notices_tenant_id_fkey,
ADD CONSTRAINT delivery_notices_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- locations table
ALTER TABLE locations
DROP CONSTRAINT IF EXISTS locations_tenant_id_fkey,
ADD CONSTRAINT locations_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- inventory_transactions table
ALTER TABLE inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_tenant_id_fkey,
ADD CONSTRAINT inventory_transactions_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- stock_transfers table
ALTER TABLE stock_transfers
DROP CONSTRAINT IF EXISTS stock_transfers_tenant_id_fkey,
ADD CONSTRAINT stock_transfers_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- stock_transfer_items table
ALTER TABLE stock_transfer_items
DROP CONSTRAINT IF EXISTS stock_transfer_items_tenant_id_fkey,
ADD CONSTRAINT stock_transfer_items_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- location_inventory table
ALTER TABLE location_inventory
DROP CONSTRAINT IF EXISTS location_inventory_tenant_id_fkey,
ADD CONSTRAINT location_inventory_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- visits table
ALTER TABLE visits
DROP CONSTRAINT IF EXISTS visits_tenant_id_fkey,
ADD CONSTRAINT visits_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- routes table
ALTER TABLE routes
DROP CONSTRAINT IF EXISTS routes_tenant_id_fkey,
ADD CONSTRAINT routes_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- visit_schedules table
ALTER TABLE visit_schedules
DROP CONSTRAINT IF EXISTS visit_schedules_tenant_id_fkey,
ADD CONSTRAINT visit_schedules_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- settings table
ALTER TABLE settings
DROP CONSTRAINT IF EXISTS settings_tenant_id_fkey,
ADD CONSTRAINT settings_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotions table
ALTER TABLE promotions
DROP CONSTRAINT IF EXISTS promotions_tenant_id_fkey,
ADD CONSTRAINT promotions_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_rules table
ALTER TABLE promotion_rules
DROP CONSTRAINT IF EXISTS promotion_rules_tenant_id_fkey,
ADD CONSTRAINT promotion_rules_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_actions table
ALTER TABLE promotion_actions
DROP CONSTRAINT IF EXISTS promotion_actions_tenant_id_fkey,
ADD CONSTRAINT promotion_actions_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_product_eligibility table
ALTER TABLE promotion_product_eligibility
DROP CONSTRAINT IF EXISTS promotion_product_eligibility_tenant_id_fkey,
ADD CONSTRAINT promotion_product_eligibility_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_category_eligibility table
ALTER TABLE promotion_category_eligibility
DROP CONSTRAINT IF EXISTS promotion_category_eligibility_tenant_id_fkey,
ADD CONSTRAINT promotion_category_eligibility_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_customer_eligibility table
ALTER TABLE promotion_customer_eligibility
DROP CONSTRAINT IF EXISTS promotion_customer_eligibility_tenant_id_fkey,
ADD CONSTRAINT promotion_customer_eligibility_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- promotion_usage_limits table
ALTER TABLE promotion_usage_limits
DROP CONSTRAINT IF EXISTS promotion_usage_limits_tenant_id_fkey,
ADD CONSTRAINT promotion_usage_limits_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- applied_promotions table
ALTER TABLE applied_promotions
DROP CONSTRAINT IF EXISTS applied_promotions_tenant_id_fkey,
ADD CONSTRAINT applied_promotions_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- user_activity_logs table
ALTER TABLE user_activity_logs
DROP CONSTRAINT IF EXISTS user_activity_logs_tenant_id_fkey,
ADD CONSTRAINT user_activity_logs_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- supplier_orders table
ALTER TABLE supplier_orders
DROP CONSTRAINT IF EXISTS supplier_orders_tenant_id_fkey,
ADD CONSTRAINT supplier_orders_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- supplier_order_items table
ALTER TABLE supplier_order_items
DROP CONSTRAINT IF EXISTS supplier_order_items_tenant_id_fkey,
ADD CONSTRAINT supplier_order_items_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Added ON DELETE CASCADE to all tenant foreign key constraints';
END $$;