/*
  # Warehouse/Inventory Module - Stock Adjustments & Transfers

  1. New Tables
    - `locations`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `location_type` (text) - warehouse, store, van, etc.
      - `address` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)

    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key)
      - `product_id` (uuid, foreign key)
      - `location_id` (uuid, foreign key)
      - `transaction_type` (text) - in, out, adjustment, transfer_in, transfer_out
      - `quantity` (integer)
      - `reference_id` (uuid) - reference to order, transfer, etc.
      - `notes` (text)
      - `performed_by` (uuid, foreign key to profiles)
      - `transaction_date` (timestamp)
      - `created_at` (timestamp)

    - `stock_transfers`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key)
      - `from_location_id` (uuid, foreign key)
      - `to_location_id` (uuid, foreign key)
      - `status` (text) - pending, in_transit, completed, cancelled
      - `transfer_date` (timestamp)
      - `completed_date` (timestamp)
      - `notes` (text)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp)

    - `stock_transfer_items`
      - `id` (uuid, primary key)
      - `transfer_id` (uuid, foreign key)
      - `product_id` (uuid, foreign key)
      - `quantity` (integer)
      - `created_at` (timestamp)

    - `location_inventory`
      - `id` (uuid, primary key)
      - `location_id` (uuid, foreign key)
      - `product_id` (uuid, foreign key)
      - `quantity` (integer)
      - `last_updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for tenant isolation
    - Add role-based access policies

  3. Indexes
    - Add performance indexes for common queries
*/

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  location_type text NOT NULL DEFAULT 'warehouse',
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for location types
ALTER TABLE locations ADD CONSTRAINT locations_type_check 
CHECK (location_type IN ('warehouse', 'store', 'van', 'supplier', 'customer'));

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL REFERENCES products(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  transaction_type text NOT NULL,
  quantity integer NOT NULL,
  reference_id uuid,
  notes text,
  performed_by uuid NOT NULL REFERENCES profiles(id),
  transaction_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for transaction types
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_type_check 
CHECK (transaction_type IN ('in', 'out', 'adjustment', 'transfer_in', 'transfer_out'));

-- Create stock_transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  from_location_id uuid NOT NULL REFERENCES locations(id),
  to_location_id uuid NOT NULL REFERENCES locations(id),
  status text NOT NULL DEFAULT 'pending',
  transfer_date timestamptz DEFAULT now(),
  completed_date timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for transfer status
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check 
CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled'));

-- Create stock_transfer_items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now()
);

-- Create location_inventory table
CREATE TABLE IF NOT EXISTS location_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_updated_at timestamptz DEFAULT now(),
  UNIQUE(location_id, product_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_tenant_id ON inventory_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_location_id ON inventory_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_id ON stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_location ON stock_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_location ON stock_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer_id ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_product_id ON stock_transfer_items(product_id);

CREATE INDEX IF NOT EXISTS idx_location_inventory_location_id ON location_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_product_id ON location_inventory(product_id);

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations
CREATE POLICY "Users can view locations in their tenant"
  ON locations
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage locations in their tenant"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'warehouse')
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Users can view inventory transactions in their tenant"
  ON inventory_transactions
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Warehouse staff can create inventory transactions"
  ON inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'warehouse')
  );

-- RLS Policies for stock_transfers
CREATE POLICY "Users can view stock transfers in their tenant"
  ON stock_transfers
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Warehouse staff can manage stock transfers"
  ON stock_transfers
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'warehouse')
  );

-- RLS Policies for stock_transfer_items
CREATE POLICY "Users can view stock transfer items in their tenant"
  ON stock_transfer_items
  FOR SELECT
  TO authenticated
  USING (
    transfer_id IN (
      SELECT id FROM stock_transfers 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Warehouse staff can manage stock transfer items"
  ON stock_transfer_items
  FOR ALL
  TO authenticated
  USING (
    transfer_id IN (
      SELECT id FROM stock_transfers 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'warehouse')
  );

-- RLS Policies for location_inventory
CREATE POLICY "Users can view location inventory in their tenant"
  ON location_inventory
  FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT id FROM locations 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Warehouse staff can manage location inventory"
  ON location_inventory
  FOR ALL
  TO authenticated
  USING (
    location_id IN (
      SELECT id FROM locations 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'warehouse')
  );