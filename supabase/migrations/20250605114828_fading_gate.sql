/*
  # Add Routes Management

  1. New Tables
    - `routes`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, references tenants)
      - `name` (text)
      - `description` (text)
      - `type` (text: 'delivery', 'sales', 'mixed')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `routes` table
    - Add policies for viewing and managing routes
    - Add index for tenant_id lookups

  3. Changes
    - Modify `deliveries` table to use route_id instead of route_number
*/

-- Create routes table
CREATE TABLE routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('delivery', 'sales', 'mixed')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view routes in their tenant"
  ON routes
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT profiles.tenant_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  ));

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

-- Create index
CREATE INDEX idx_routes_tenant_id ON routes(tenant_id);

-- Modify deliveries table
ALTER TABLE deliveries
  ADD COLUMN route_id uuid REFERENCES routes(id),
  ADD COLUMN sequence_number integer;

-- Create index for route lookups
CREATE INDEX idx_deliveries_route_id ON deliveries(route_id);

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
CREATE TRIGGER set_route_sequence
  BEFORE INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_route_sequence();