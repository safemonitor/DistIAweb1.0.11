/*
  # Add Superadmin Role and Access

  1. Changes
    - Update profiles table role check constraint to include 'superadmin'
    - Create is_superadmin() function to simplify RLS policies
    - Update RLS policies to grant superadmin unrestricted access
    - Add max_users constraint to tenants table

  2. Security
    - Superadmin bypasses tenant isolation
    - Superadmin has full access to all data
    - Superadmin can manage all tenants and users
*/

-- Update profiles role check constraint to include 'superadmin'
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'sales', 'presales', 'delivery', 'warehouse', 'superadmin'));

-- Create is_superadmin() function
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'superadmin'
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to grant superadmin unrestricted access

-- Tenants table
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Superadmin can manage all tenants"
  ON tenants
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    id = auth.uid() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_superadmin() OR
    id = auth.uid()
  )
  WITH CHECK (
    is_superadmin() OR
    id = auth.uid()
  );

CREATE POLICY "Superadmin can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Customers table
DROP POLICY IF EXISTS "Users can manage their tenant's customers" ON customers;
CREATE POLICY "Users can manage their tenant's customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Products table
DROP POLICY IF EXISTS "Users can view their tenant's products" ON products;
CREATE POLICY "Users can manage their tenant's products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Orders table
DROP POLICY IF EXISTS "Users can view their tenant's orders" ON orders;
CREATE POLICY "Users can manage their tenant's orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Order items table
CREATE POLICY "Superadmin can manage all order items"
  ON order_items
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Invoices table
CREATE POLICY "Superadmin can manage all invoices"
  ON invoices
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Locations table
DROP POLICY IF EXISTS "Users can view locations in their tenant" ON locations;
DROP POLICY IF EXISTS "Admins and warehouse staff can manage locations" ON locations;
CREATE POLICY "Users can view locations in their tenant"
  ON locations
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

CREATE POLICY "Staff can manage locations"
  ON locations
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
    )
  );

-- Inventory transactions table
DROP POLICY IF EXISTS "Users can view inventory transactions in their tenant" ON inventory_transactions;
DROP POLICY IF EXISTS "Warehouse staff can create inventory transactions" ON inventory_transactions;
CREATE POLICY "Users can view inventory transactions"
  ON inventory_transactions
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

CREATE POLICY "Staff can manage inventory transactions"
  ON inventory_transactions
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
    )
  );

-- Stock transfers table
DROP POLICY IF EXISTS "Users can view stock transfers in their tenant" ON stock_transfers;
DROP POLICY IF EXISTS "Warehouse staff can manage stock transfers" ON stock_transfers;
CREATE POLICY "Users can view stock transfers"
  ON stock_transfers
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

CREATE POLICY "Staff can manage stock transfers"
  ON stock_transfers
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'warehouse')
    )
  );

-- Stock transfer items table
CREATE POLICY "Superadmin can manage all stock transfer items"
  ON stock_transfer_items
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Location inventory table
CREATE POLICY "Superadmin can manage all location inventory"
  ON location_inventory
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Deliveries table
DROP POLICY IF EXISTS "Users can view their tenant's deliveries" ON deliveries;
CREATE POLICY "Users can manage deliveries"
  ON deliveries
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  )
  WITH CHECK (
    is_superadmin() OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

-- Visits table
DROP POLICY IF EXISTS "Users can view visits in their tenant" ON visits;
DROP POLICY IF EXISTS "Sales staff can manage their own visits" ON visits;
CREATE POLICY "Users can view visits"
  ON visits
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

CREATE POLICY "Users can manage visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    created_by = auth.uid() OR
    (
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
  )
  WITH CHECK (
    is_superadmin() OR
    created_by = auth.uid() OR
    (
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
  );

-- Promotions table
DROP POLICY IF EXISTS "Users can view promotions in their tenant" ON promotions;
DROP POLICY IF EXISTS "Sales staff can manage promotions in their tenant" ON promotions;
CREATE POLICY "Users can view promotions"
  ON promotions
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

CREATE POLICY "Staff can manage promotions"
  ON promotions
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'sales')
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) IN ('admin', 'sales')
    )
  );

-- Settings table
DROP POLICY IF EXISTS "Users can view tenant settings" ON settings;
DROP POLICY IF EXISTS "Admins can manage settings in their tenant" ON settings;
CREATE POLICY "Users can view settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    (tenant_id IS NULL AND is_public = true) OR
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    )
  );

CREATE POLICY "Admins can manage settings"
  ON settings
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) = 'admin'
      AND
      (
        tenant_id IS NULL OR
        tenant_id = (
          SELECT tenant_id 
          FROM profiles 
          WHERE id = auth.uid() 
          LIMIT 1
        )
      )
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) = 'admin'
      AND
      (
        tenant_id IS NULL OR
        tenant_id = (
          SELECT tenant_id 
          FROM profiles 
          WHERE id = auth.uid() 
          LIMIT 1
        )
      )
    )
  );

-- Van inventories table
DROP POLICY IF EXISTS "Sales staff can manage their own van inventory" ON van_inventories;
CREATE POLICY "Users can manage van inventory"
  ON van_inventories
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    profile_id = auth.uid() OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    is_superadmin() OR
    profile_id = auth.uid() OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

-- Van stock movements table
DROP POLICY IF EXISTS "Sales staff can view their own stock movements" ON van_stock_movements;
DROP POLICY IF EXISTS "Sales staff can create their own stock movements" ON van_stock_movements;
CREATE POLICY "Users can view stock movements"
  ON van_stock_movements
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    profile_id = auth.uid() OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

CREATE POLICY "Users can create stock movements"
  ON van_stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_superadmin() OR
    profile_id = auth.uid() OR
    (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

-- Routes table
DROP POLICY IF EXISTS "Users can view routes in their tenant" ON routes;
DROP POLICY IF EXISTS "Admins can manage routes in their tenant" ON routes;
CREATE POLICY "Users can view routes"
  ON routes
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

CREATE POLICY "Admins can manage routes"
  ON routes
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) = 'admin'
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
      (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid() 
        LIMIT 1
      ) = 'admin'
    )
  );

-- User activity logs table
CREATE POLICY "Superadmin can view all activity logs"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (is_superadmin());

-- Tenant modules table
CREATE POLICY "Superadmin can manage all tenant modules"
  ON tenant_modules
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Modify the tenant user limit trigger to allow superadmin to bypass the limit
CREATE OR REPLACE FUNCTION check_tenant_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  max_allowed integer;
  user_role text;
BEGIN
  -- Get the role of the user being added
  SELECT role INTO user_role FROM auth.users WHERE id = NEW.id;
  
  -- If the user is a superadmin, bypass the check
  IF user_role = 'superadmin' THEN
    RETURN NEW;
  END IF;
  
  -- Get current user count for the tenant
  SELECT COUNT(*) INTO current_count
  FROM profiles
  WHERE tenant_id = NEW.tenant_id;
  
  -- Get max allowed users for the tenant
  SELECT max_users INTO max_allowed
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  -- Check if adding this user would exceed the limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Cannot add user: maximum user limit (%) reached for this tenant', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS enforce_tenant_user_limit ON profiles;
CREATE TRIGGER enforce_tenant_user_limit
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_user_limit();