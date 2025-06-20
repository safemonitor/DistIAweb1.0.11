/*
  # Create visits table for Sales/Presales Module

  1. New Tables
    - `visits`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key to tenants)
      - `customer_id` (uuid, foreign key to customers)
      - `visit_date` (timestamp with time zone)
      - `notes` (text, optional)
      - `outcome` (text, optional with check constraint)
      - `photos_url` (text array, optional)
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `visits` table
    - Add policy for users to view visits in their tenant
    - Add policy for sales/presales staff to manage their own visits
    - Add policy for admins to manage all visits in their tenant
*/

CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  visit_date timestamptz NOT NULL,
  notes text,
  outcome text,
  photos_url text[],
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for outcome values
ALTER TABLE visits ADD CONSTRAINT visits_outcome_check 
CHECK (outcome IS NULL OR outcome IN ('successful', 'unsuccessful', 'rescheduled', 'cancelled', 'pending'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_customer_id ON visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_by ON visits(created_by);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);

-- Enable Row Level Security
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Policy for users to view visits in their tenant
CREATE POLICY "Users can view visits in their tenant"
  ON visits
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Policy for sales/presales staff to manage their own visits
CREATE POLICY "Sales staff can manage their own visits"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() OR
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  )
  WITH CHECK (
    created_by = auth.uid() OR
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- Policy for admins to manage all visits in their tenant
CREATE POLICY "Admins can manage all visits in their tenant"
  ON visits
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );