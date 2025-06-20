/*
  # Add delivery tracking

  1. New Tables
    - `deliveries`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `carrier` (text)
      - `tracking_number` (text)
      - `status` (text)
      - `estimated_delivery` (timestamptz)
      - `actual_delivery` (timestamptz)
      - `shipping_cost` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `deliveries` table
    - Add policy for authenticated users to read their tenant's deliveries
*/

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  carrier text NOT NULL,
  tracking_number text,
  status text NOT NULL CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')),
  estimated_delivery timestamptz,
  actual_delivery timestamptz,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id)
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's deliveries"
  ON deliveries
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT profiles.tenant_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  ));

CREATE INDEX idx_deliveries_tenant_id ON deliveries(tenant_id);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);