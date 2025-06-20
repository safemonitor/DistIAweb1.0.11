/*
  # Supplier Orders Schema

  1. New Tables
    - `supplier_orders` - Main table for orders placed with suppliers
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key to tenants)
      - `supplier_name` (text)
      - `order_date` (timestamp)
      - `expected_delivery_date` (timestamp)
      - `status` (text: pending, partially_received, received, cancelled)
      - `receiving_location_id` (uuid, foreign key to locations)
      - `total_amount` (numeric)
      - `notes` (text)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)
    
    - `supplier_order_items` - Items within supplier orders
      - `id` (uuid, primary key)
      - `supplier_order_id` (uuid, foreign key to supplier_orders)
      - `product_id` (uuid, foreign key to products)
      - `quantity_ordered` (integer)
      - `quantity_received` (integer)
      - `unit_cost` (numeric)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for tenant isolation
    - Add role-based access control
    
  3. Indexes
    - Add performance indexes for common queries
*/

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM profiles WHERE id = user_id LIMIT 1;
$$;

-- Create supplier_orders table
CREATE TABLE IF NOT EXISTS supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  supplier_name text NOT NULL,
  order_date timestamptz DEFAULT now(),
  expected_delivery_date timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'partially_received', 'received', 'cancelled')),
  receiving_location_id uuid NOT NULL REFERENCES locations(id),
  total_amount numeric(10,2),
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create supplier_order_items table
CREATE TABLE IF NOT EXISTS supplier_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity_ordered integer NOT NULL CHECK (quantity_ordered > 0),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost numeric(10,2) NOT NULL CHECK (unit_cost > 0),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_orders_tenant_id ON supplier_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_location_id ON supplier_orders(receiving_location_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_created_by ON supplier_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_date ON supplier_orders(order_date);

CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order_id ON supplier_order_items(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_product_id ON supplier_order_items(product_id);

-- Enable Row Level Security
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_orders
CREATE POLICY "Users can view supplier orders in their tenant"
  ON supplier_orders
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Staff can manage supplier orders"
  ON supplier_orders
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      tenant_id = (
        SELECT tenant_id 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      )
      AND
      get_user_role(auth.uid()) IN ('admin', 'warehouse')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      tenant_id = (
        SELECT tenant_id 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      )
      AND
      get_user_role(auth.uid()) IN ('admin', 'warehouse')
    )
  );

-- RLS Policies for supplier_order_items
CREATE POLICY "Users can view supplier order items in their tenant"
  ON supplier_order_items
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    supplier_order_id IN (
      SELECT id
      FROM supplier_orders
      WHERE tenant_id = (
        SELECT tenant_id 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      )
    )
  );

CREATE POLICY "Staff can manage supplier order items"
  ON supplier_order_items
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      supplier_order_id IN (
        SELECT id
        FROM supplier_orders
        WHERE tenant_id = (
          SELECT tenant_id 
          FROM profiles 
          WHERE id = auth.uid() 
          LIMIT 1
        )
      )
      AND
      get_user_role(auth.uid()) IN ('admin', 'warehouse')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      supplier_order_id IN (
        SELECT id
        FROM supplier_orders
        WHERE tenant_id = (
          SELECT tenant_id 
          FROM profiles 
          WHERE id = auth.uid() 
          LIMIT 1
        )
      )
      AND
      get_user_role(auth.uid()) IN ('admin', 'warehouse')
    )
  );

-- Create function to update inventory when receiving supplier orders
CREATE OR REPLACE FUNCTION process_supplier_order_receipt()
RETURNS TRIGGER AS $$
DECLARE
  tenant_id_val uuid;
  location_id_val uuid;
BEGIN
  -- Only process when status changes to 'received' or 'partially_received'
  IF (NEW.status IN ('received', 'partially_received') AND OLD.status = 'pending') THEN
    -- Get tenant_id and location_id
    SELECT tenant_id, receiving_location_id INTO tenant_id_val, location_id_val
    FROM supplier_orders
    WHERE id = NEW.id;
    
    -- Create inventory transactions for each received item
    INSERT INTO inventory_transactions (
      tenant_id, 
      product_id, 
      location_id, 
      transaction_type, 
      quantity, 
      reference_id, 
      notes, 
      performed_by
    )
    SELECT 
      tenant_id_val,
      soi.product_id,
      location_id_val,
      'in',
      soi.quantity_received,
      NEW.id,
      'Received from supplier: ' || NEW.supplier_name,
      NEW.created_by
    FROM supplier_order_items soi
    WHERE soi.supplier_order_id = NEW.id AND soi.quantity_received > 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for processing supplier order receipts
CREATE TRIGGER trigger_process_supplier_order_receipt
  AFTER UPDATE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION process_supplier_order_receipt();

-- Create function to log supplier order activity
CREATE OR REPLACE FUNCTION log_supplier_order_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action_type,
    details
  ) VALUES (
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'supplier_order_created'
      WHEN TG_OP = 'UPDATE' THEN 'supplier_order_updated'
      WHEN TG_OP = 'DELETE' THEN 'supplier_order_deleted'
    END,
    jsonb_build_object(
      'supplier_order_id', COALESCE(NEW.id, OLD.id),
      'supplier_name', COALESCE(NEW.supplier_name, OLD.supplier_name),
      'status', COALESCE(NEW.status, OLD.status),
      'total_amount', COALESCE(NEW.total_amount, OLD.total_amount)
    )
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging supplier order activity
CREATE TRIGGER trg_supplier_orders_activity
  AFTER INSERT OR UPDATE OR DELETE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_supplier_order_activity();