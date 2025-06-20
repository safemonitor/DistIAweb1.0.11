/*
  # Fix Supplier Orders Relationship

  1. Changes
    - Add missing foreign key relationship between supplier_orders and locations
    - Ensure proper column naming for the relationship to work
    - Update constraints to maintain data integrity

  2. Security
    - Maintain existing RLS policies
    - Ensure proper tenant isolation
*/

-- First check if the receiving_location_id column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_orders' AND column_name = 'receiving_location_id'
  ) THEN
    -- Add the receiving_location_id column if it doesn't exist
    ALTER TABLE supplier_orders 
    ADD COLUMN receiving_location_id uuid REFERENCES locations(id);
    
    -- If there's an existing column with a different name, migrate the data
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'supplier_orders' AND column_name = 'location_id'
    ) THEN
      -- Copy data from the old column to the new one
      UPDATE supplier_orders
      SET receiving_location_id = location_id;
      
      -- Drop the old column if needed
      ALTER TABLE supplier_orders DROP COLUMN location_id;
    END IF;
  END IF;
END $$;

-- Create index for the relationship if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'supplier_orders' AND indexname = 'idx_supplier_orders_receiving_location_id'
  ) THEN
    CREATE INDEX idx_supplier_orders_receiving_location_id ON supplier_orders(receiving_location_id);
  END IF;
END $$;

-- Ensure the foreign key constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'supplier_orders' 
    AND ccu.table_name = 'locations'
    AND ccu.column_name = 'id'
  ) THEN
    -- Add the foreign key constraint if it doesn't exist
    ALTER TABLE supplier_orders
    ADD CONSTRAINT supplier_orders_receiving_location_id_fkey
    FOREIGN KEY (receiving_location_id) REFERENCES locations(id);
  END IF;
END $$;