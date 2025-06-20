/*
  # Database Performance Optimization for Multi-tenant Architecture

  1. Changes
    - Add missing tenant_id columns to child tables
    - Create indexes on tenant_id columns
    - Create composite indexes for common query patterns
    - Update RLS policies to use tenant_id directly
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper tenant isolation
*/

-- Add missing tenant_id columns to tables that need them
DO $$ 
BEGIN
  -- order_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from parent orders table
    UPDATE order_items oi
    SET tenant_id = o.tenant_id
    FROM orders o
    WHERE oi.order_id = o.id;
  END IF;

  -- stock_transfer_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_transfer_items' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE stock_transfer_items ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from parent stock_transfers table
    UPDATE stock_transfer_items sti
    SET tenant_id = st.tenant_id
    FROM stock_transfers st
    WHERE sti.transfer_id = st.id;
  END IF;

  -- location_inventory
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'location_inventory' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE location_inventory ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from locations table
    UPDATE location_inventory li
    SET tenant_id = l.tenant_id
    FROM locations l
    WHERE li.location_id = l.id;
  END IF;

  -- applied_promotions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'applied_promotions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE applied_promotions ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE applied_promotions ap
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE ap.promotion_id = p.id;
  END IF;

  -- promotion_rules
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_rules' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_rules ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_rules pr
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE pr.promotion_id = p.id;
  END IF;

  -- promotion_actions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_actions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_actions ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_actions pa
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE pa.promotion_id = p.id;
  END IF;

  -- promotion_product_eligibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_product_eligibility' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_product_eligibility ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_product_eligibility ppe
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE ppe.promotion_id = p.id;
  END IF;

  -- promotion_category_eligibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_category_eligibility' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_category_eligibility ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_category_eligibility pce
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE pce.promotion_id = p.id;
  END IF;

  -- promotion_customer_eligibility
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_customer_eligibility' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_customer_eligibility ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_customer_eligibility pce
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE pce.promotion_id = p.id;
  END IF;

  -- promotion_usage_limits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'promotion_usage_limits' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE promotion_usage_limits ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from promotions table
    UPDATE promotion_usage_limits pul
    SET tenant_id = p.tenant_id
    FROM promotions p
    WHERE pul.promotion_id = p.id;
  END IF;

  -- user_activity_logs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_activity_logs' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE user_activity_logs ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from profiles table
    UPDATE user_activity_logs ual
    SET tenant_id = p.tenant_id
    FROM profiles p
    WHERE ual.user_id = p.id;
  END IF;

  -- supplier_order_items
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_order_items' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE supplier_order_items ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    
    -- Populate tenant_id from supplier_orders table
    UPDATE supplier_order_items soi
    SET tenant_id = so.tenant_id
    FROM supplier_orders so
    WHERE soi.supplier_order_id = so.id;
  END IF;
END $$;

-- Create missing indexes on tenant_id columns
DO $$ 
BEGIN
  -- Basic tenant_id indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_tenant_id') THEN
    CREATE INDEX idx_order_items_tenant_id ON order_items(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stock_transfer_items_tenant_id') THEN
    CREATE INDEX idx_stock_transfer_items_tenant_id ON stock_transfer_items(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_location_inventory_tenant_id') THEN
    CREATE INDEX idx_location_inventory_tenant_id ON location_inventory(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_applied_promotions_tenant_id') THEN
    CREATE INDEX idx_applied_promotions_tenant_id ON applied_promotions(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_rules_tenant_id') THEN
    CREATE INDEX idx_promotion_rules_tenant_id ON promotion_rules(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_actions_tenant_id') THEN
    CREATE INDEX idx_promotion_actions_tenant_id ON promotion_actions(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_product_eligibility_tenant_id') THEN
    CREATE INDEX idx_promotion_product_eligibility_tenant_id ON promotion_product_eligibility(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_category_eligibility_tenant_id') THEN
    CREATE INDEX idx_promotion_category_eligibility_tenant_id ON promotion_category_eligibility(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_customer_eligibility_tenant_id') THEN
    CREATE INDEX idx_promotion_customer_eligibility_tenant_id ON promotion_customer_eligibility(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotion_usage_limits_tenant_id') THEN
    CREATE INDEX idx_promotion_usage_limits_tenant_id ON promotion_usage_limits(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_activity_logs_tenant_id') THEN
    CREATE INDEX idx_user_activity_logs_tenant_id ON user_activity_logs(tenant_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_supplier_order_items_tenant_id') THEN
    CREATE INDEX idx_supplier_order_items_tenant_id ON supplier_order_items(tenant_id);
  END IF;

  -- Composite indexes for common query patterns
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_tenant_status') THEN
    CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_tenant_date') THEN
    CREATE INDEX idx_orders_tenant_date ON orders(tenant_id, order_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_deliveries_tenant_status') THEN
    CREATE INDEX idx_deliveries_tenant_status ON deliveries(tenant_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_tenant_category') THEN
    CREATE INDEX idx_products_tenant_category ON products(tenant_id, category);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_tenant_email') THEN
    CREATE INDEX idx_customers_tenant_email ON customers(tenant_id, email);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_transactions_tenant_type') THEN
    CREATE INDEX idx_inventory_transactions_tenant_type ON inventory_transactions(tenant_id, transaction_type);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stock_transfers_tenant_status') THEN
    CREATE INDEX idx_stock_transfers_tenant_status ON stock_transfers(tenant_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_visits_tenant_outcome') THEN
    CREATE INDEX idx_visits_tenant_outcome ON visits(tenant_id, outcome);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_visits_tenant_date') THEN
    CREATE INDEX idx_visits_tenant_date ON visits(tenant_id, visit_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotions_tenant_active') THEN
    CREATE INDEX idx_promotions_tenant_active ON promotions(tenant_id, is_active);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promotions_tenant_dates') THEN
    CREATE INDEX idx_promotions_tenant_dates ON promotions(tenant_id, start_date, end_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_supplier_orders_tenant_status') THEN
    CREATE INDEX idx_supplier_orders_tenant_status ON supplier_orders(tenant_id, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_supplier_orders_tenant_date') THEN
    CREATE INDEX idx_supplier_orders_tenant_date ON supplier_orders(tenant_id, order_date);
  END IF;
END $$;

-- Create helper function to get user role if it doesn't exist
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = user_id LIMIT 1;
$$;

-- Update RLS policies for order_items to use tenant_id directly
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_items' AND policyname = 'Users can view order items in their tenant'
  ) THEN
    DROP POLICY "Users can view order items in their tenant" ON order_items;
  END IF;
END $$;

CREATE POLICY "Users can view order items in their tenant"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Database performance optimization for multi-tenant architecture completed successfully';
END $$;