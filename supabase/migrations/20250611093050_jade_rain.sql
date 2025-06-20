/*
  # Fix Supplier Orders Foreign Key Relationships

  1. Changes
    - Add proper foreign key constraint between supplier_orders and locations
    - Ensure the receiving_location_id column references the locations table
    - Update RLS policies to maintain proper security

  2. Security
    - Maintain existing RLS policies
    - Ensure proper tenant isolation
*/

-- First check if the supplier_orders table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'supplier_orders'
  ) THEN
    -- Create the supplier_orders table if it doesn't exist
    CREATE TABLE supplier_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) NOT NULL,
      supplier_name text NOT NULL,
      order_date timestamptz DEFAULT now(),
      expected_delivery_date timestamptz,
      status text NOT NULL CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
      total_amount numeric(10,2) NOT NULL DEFAULT 0,
      receiving_location_id uuid,
      notes text,
      created_by uuid REFERENCES profiles(id) NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

    -- Create indexes
    CREATE INDEX idx_supplier_orders_tenant_id ON supplier_orders(tenant_id);
    CREATE INDEX idx_supplier_orders_status ON supplier_orders(status);
    CREATE INDEX idx_supplier_orders_created_by ON supplier_orders(created_by);
  END IF;

  -- Create the supplier_order_items table if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'supplier_order_items'
  ) THEN
    CREATE TABLE supplier_order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE NOT NULL,
      product_id uuid REFERENCES products(id) NOT NULL,
      quantity integer NOT NULL CHECK (quantity > 0),
      unit_price numeric(10,2) NOT NULL,
      received_quantity integer DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

    -- Create indexes
    CREATE INDEX idx_supplier_order_items_order_id ON supplier_order_items(supplier_order_id);
    CREATE INDEX idx_supplier_order_items_product_id ON supplier_order_items(product_id);
  END IF;

  -- Now fix the foreign key relationship if it doesn't exist
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'supplier_orders' 
    AND column_name = 'receiving_location_id'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'supplier_orders' 
    AND ccu.column_name = 'id'
    AND ccu.table_name = 'locations'
    AND tc.constraint_name = 'supplier_orders_receiving_location_id_fkey'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE supplier_orders 
    ADD CONSTRAINT supplier_orders_receiving_location_id_fkey 
    FOREIGN KEY (receiving_location_id) REFERENCES locations(id);
  END IF;

  -- Create RLS policies if they don't exist
  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'supplier_orders' 
    AND policyname = 'Users can manage their tenant supplier orders'
  ) THEN
    CREATE POLICY "Users can manage their tenant supplier orders"
      ON supplier_orders
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
  END IF;

  IF NOT EXISTS (
    SELECT FROM pg_policies 
    WHERE tablename = 'supplier_order_items' 
    AND policyname = 'Users can manage their tenant supplier order items'
  ) THEN
    CREATE POLICY "Users can manage their tenant supplier order items"
      ON supplier_order_items
      FOR ALL
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
      )
      WITH CHECK (
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
  END IF;
END $$;