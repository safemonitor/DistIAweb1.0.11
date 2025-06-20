/*
  # Add Foreign Key Constraint to Orders Table

  1. Changes
    - Add foreign key constraint from orders.customer_id to customers.id
    - This enables proper joins between orders and customers tables
    - Fixes the error: "Could not find a relationship between 'orders' and 'customers' in the schema cache"

  2. Security
    - Maintains existing RLS policies
    - Ensures proper data integrity between orders and customers
*/

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'orders' 
    AND ccu.table_name = 'customers'
    AND ccu.column_name = 'id'
    AND tc.constraint_name = 'orders_customer_id_fkey'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id);
    
    RAISE NOTICE 'Foreign key constraint added between orders.customer_id and customers.id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Create index for better performance if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'orders' AND indexname = 'idx_orders_customer_id'
  ) THEN
    CREATE INDEX idx_orders_customer_id ON orders(customer_id);
    RAISE NOTICE 'Index created on orders.customer_id';
  ELSE
    RAISE NOTICE 'Index already exists on orders.customer_id';
  END IF;
END $$;