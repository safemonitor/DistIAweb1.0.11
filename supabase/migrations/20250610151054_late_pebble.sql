/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Several RLS policies on various tables are causing infinite recursion
    - The policies reference the profiles table in subqueries that create circular dependencies
    - This happens when policies check user roles by querying the profiles table

  2. Solution
    - Simplify policies to avoid recursive profile lookups
    - Use auth.uid() directly where possible
    - Remove complex subqueries that reference profiles table recursively
    - Create more efficient policies that don't cause circular references

  3. Tables affected
    - tenants
    - profiles  
    - customers
    - products
    - orders
    - locations
    - inventory_transactions
    - stock_transfers
    - deliveries
    - visits
    - promotions
    - settings
    - van_inventories
    - van_stock_movements
    - routes
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Admins can manage users in their tenant" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON profiles;
DROP POLICY IF EXISTS "Users can view their tenant's customers" ON customers;
DROP POLICY IF EXISTS "Users can view their tenant's products" ON products;
DROP POLICY IF EXISTS "Users can view their tenant's orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage locations in their tenant" ON locations;
DROP POLICY IF EXISTS "Users can view locations in their tenant" ON locations;
DROP POLICY IF EXISTS "Users can view inventory transactions in their tenant" ON inventory_transactions;
DROP POLICY IF EXISTS "Warehouse staff can create inventory transactions" ON inventory_transactions;
DROP POLICY IF EXISTS "Users can view stock transfers in their tenant" ON stock_transfers;
DROP POLICY IF EXISTS "Warehouse staff can manage stock transfers" ON stock_transfers;
DROP POLICY IF EXISTS "Users can view their tenant's deliveries" ON deliveries;
DROP POLICY IF EXISTS "Admins can manage all visits in their tenant" ON visits;
DROP POLICY IF EXISTS "Sales staff can manage their own visits" ON visits;
DROP POLICY IF EXISTS "Users can view visits in their tenant" ON visits;
DROP POLICY IF EXISTS "Admins can manage promotions in their tenant" ON promotions;
DROP POLICY IF EXISTS "Users can view promotions in their tenant" ON promotions;
DROP POLICY IF EXISTS "Admins can manage settings in their tenant" ON settings;
DROP POLICY IF EXISTS "Users can view public settings" ON settings;
DROP POLICY IF EXISTS "Users can view tenant settings" ON settings;
DROP POLICY IF EXISTS "Sales staff can manage their own van inventory" ON van_inventories;
DROP POLICY IF EXISTS "Sales staff can view their own van inventory" ON van_inventories;
DROP POLICY IF EXISTS "Sales staff can create their own stock movements" ON van_stock_movements;
DROP POLICY IF EXISTS "Sales staff can view their own stock movements" ON van_stock_movements;
DROP POLICY IF EXISTS "Admins can manage routes in their tenant" ON routes;
DROP POLICY IF EXISTS "Users can view routes in their tenant" ON routes;

-- Create new simplified policies for tenants
CREATE POLICY "Users can view their own tenant"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create new simplified policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create new simplified policies for customers
CREATE POLICY "Users can manage their tenant's customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create new simplified policies for products
CREATE POLICY "Users can view their tenant's products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create new simplified policies for orders
CREATE POLICY "Users can view their tenant's orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create new simplified policies for locations
CREATE POLICY "Users can view locations in their tenant"
  ON locations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Admins and warehouse staff can manage locations"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'warehouse')
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'warehouse')
  );

-- Create new simplified policies for inventory_transactions
CREATE POLICY "Users can view inventory transactions in their tenant"
  ON inventory_transactions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Warehouse staff can create inventory transactions"
  ON inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'warehouse')
  );

-- Create new simplified policies for stock_transfers
CREATE POLICY "Users can view stock transfers in their tenant"
  ON stock_transfers
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Warehouse staff can manage stock transfers"
  ON stock_transfers
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'warehouse')
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'warehouse')
  );

-- Create new simplified policies for deliveries
CREATE POLICY "Users can view their tenant's deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Create new simplified policies for visits
CREATE POLICY "Users can view visits in their tenant"
  ON visits
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Sales staff can manage their own visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

-- Create new simplified policies for promotions
CREATE POLICY "Users can view promotions in their tenant"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Sales staff can manage promotions in their tenant"
  ON promotions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'sales')
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) IN ('admin', 'sales')
  );

-- Create new simplified policies for settings
CREATE POLICY "Users can view tenant settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND is_public = true)
    OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Admins can manage settings in their tenant"
  ON settings
  FOR ALL
  TO authenticated
  USING (
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
    AND
    (
      tenant_id IS NULL
      OR
      tenant_id = (
        SELECT tenant_id 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      )
    )
  )
  WITH CHECK (
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
    AND
    (
      tenant_id IS NULL
      OR
      tenant_id = (
        SELECT tenant_id 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      )
    )
  );

-- Create new simplified policies for van_inventories
CREATE POLICY "Sales staff can manage their own van inventory"
  ON van_inventories
  FOR ALL
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    profile_id = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

-- Create new simplified policies for van_stock_movements
CREATE POLICY "Sales staff can view their own stock movements"
  ON van_stock_movements
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

CREATE POLICY "Sales staff can create their own stock movements"
  ON van_stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

-- Create new simplified policies for routes
CREATE POLICY "Users can view routes in their tenant"
  ON routes
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Admins can manage routes in their tenant"
  ON routes
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
    AND
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );