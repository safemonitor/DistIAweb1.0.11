/*
  # Van Sales Module Database Schema

  1. New Tables
    - `van_inventories`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles.id)
      - `product_id` (uuid, foreign key to products.id)
      - `quantity` (integer)
      - `last_updated_at` (timestamp with time zone)
    - `van_stock_movements`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles.id)
      - `product_id` (uuid, foreign key to products.id)
      - `movement_type` (text: 'load', 'unload', 'sale', 'adjustment')
      - `quantity` (integer)
      - `reference_order_id` (uuid, optional foreign key to orders.id)
      - `notes` (text)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on both tables
    - Add policies for sales staff to manage their own inventory
    - Add policies for admins to view all van inventories

  3. Indexes
    - Index on profile_id for both tables
    - Index on product_id for both tables
    - Composite index on profile_id + product_id for van_inventories
*/

-- Create van_inventories table
CREATE TABLE IF NOT EXISTS van_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, product_id)
);

-- Create van_stock_movements table for tracking all stock movements
CREATE TABLE IF NOT EXISTS van_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('load', 'unload', 'sale', 'adjustment')),
  quantity integer NOT NULL,
  reference_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE van_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE van_stock_movements ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_van_inventories_profile_id ON van_inventories(profile_id);
CREATE INDEX IF NOT EXISTS idx_van_inventories_product_id ON van_inventories(product_id);
CREATE INDEX IF NOT EXISTS idx_van_inventories_profile_product ON van_inventories(profile_id, product_id);

CREATE INDEX IF NOT EXISTS idx_van_stock_movements_profile_id ON van_stock_movements(profile_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_movements_product_id ON van_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_movements_created_at ON van_stock_movements(created_at);

-- RLS Policies for van_inventories
CREATE POLICY "Sales staff can view their own van inventory"
  ON van_inventories
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Sales staff can manage their own van inventory"
  ON van_inventories
  FOR ALL
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    profile_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- RLS Policies for van_stock_movements
CREATE POLICY "Sales staff can view their own stock movements"
  ON van_stock_movements
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Sales staff can create their own stock movements"
  ON van_stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Function to update van inventory when stock movements occur
CREATE OR REPLACE FUNCTION update_van_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert van inventory record
  INSERT INTO van_inventories (profile_id, product_id, quantity, last_updated_at)
  VALUES (NEW.profile_id, NEW.product_id, 
    CASE 
      WHEN NEW.movement_type IN ('load', 'adjustment') AND NEW.quantity > 0 THEN NEW.quantity
      WHEN NEW.movement_type IN ('unload', 'sale', 'adjustment') AND NEW.quantity < 0 THEN ABS(NEW.quantity) * -1
      ELSE NEW.quantity
    END, 
    now())
  ON CONFLICT (profile_id, product_id)
  DO UPDATE SET 
    quantity = van_inventories.quantity + 
      CASE 
        WHEN NEW.movement_type IN ('load', 'adjustment') AND NEW.quantity > 0 THEN NEW.quantity
        WHEN NEW.movement_type IN ('unload', 'sale', 'adjustment') AND NEW.quantity < 0 THEN NEW.quantity
        WHEN NEW.movement_type = 'sale' THEN NEW.quantity * -1
        WHEN NEW.movement_type = 'unload' THEN NEW.quantity * -1
        ELSE NEW.quantity
      END,
    last_updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for van inventory updates
DROP TRIGGER IF EXISTS trigger_update_van_inventory ON van_stock_movements;
CREATE TRIGGER trigger_update_van_inventory
  AFTER INSERT ON van_stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_van_inventory();