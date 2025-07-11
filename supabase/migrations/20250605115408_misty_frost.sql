/*
  # Route Management Schema

  1. New Tables
    - `routes`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, references tenants)
      - `name` (text)
      - `description` (text, nullable)
      - `type` (text, enum: delivery/sales/mixed)
      - `created_at` (timestamptz)

  2. Changes
    - Add route_id and sequence_number to deliveries table
    - Add indexes for performance
    - Add trigger for automatic sequence numbering

  3. Security
    - Enable RLS on routes table
    - Add policies for viewing and managing routes
*/

-- Create routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('delivery', 'sales', 'mixed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Create policies with existence check
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'routes' AND policyname = 'Users can view routes in their tenant'
  ) THEN
    CREATE POLICY "Users can view routes in their tenant"
      ON routes
      FOR SELECT
      TO authenticated
      USING (tenant_id IN (
        SELECT profiles.tenant_id
        FROM profiles
        WHERE profiles.id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'routes' AND policyname = 'Admins can manage routes in their tenant'
  ) THEN
    CREATE POLICY "Admins can manage routes in their tenant"
      ON routes
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT profiles.tenant_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        ) AND (
          SELECT role
          FROM profiles
          WHERE id = auth.uid()
        ) = 'admin'
      );
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_routes_tenant_id ON routes(tenant_id);

-- Add route management columns to deliveries
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deliveries' AND column_name = 'route_id'
  ) THEN
    ALTER TABLE deliveries
      ADD COLUMN route_id uuid REFERENCES routes(id),
      ADD COLUMN sequence_number integer;
  END IF;
END $$;

-- Create index for route lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_route_id ON deliveries(route_id);

-- Create function to update sequence numbers
CREATE OR REPLACE FUNCTION update_route_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.route_id IS NOT NULL THEN
    NEW.sequence_number := (
      SELECT COALESCE(MAX(sequence_number), 0) + 1
      FROM deliveries
      WHERE route_id = NEW.route_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sequence numbers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_route_sequence'
  ) THEN
    CREATE TRIGGER set_route_sequence
      BEFORE INSERT ON deliveries
      FOR EACH ROW
      EXECUTE FUNCTION update_route_sequence();
  END IF;
END $$;