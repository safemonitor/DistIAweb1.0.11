/*
  # Create customers table

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key to tenants)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `address` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on customers table
    - Add policy for users to view their tenant's customers
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's customers"
  ON customers
  FOR ALL
  TO public
  USING (tenant_id IN (
    SELECT profiles.tenant_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  ));