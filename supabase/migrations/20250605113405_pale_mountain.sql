/*
  # Enhance delivery tracking system

  1. New Tables
    - `delivery_performance_logs`
      - Tracks individual delivery performance metrics
      - Records delivery times, success rates, and customer feedback
      - Enables detailed staff performance analysis

  2. Changes
    - Add delivery_rating to deliveries table
    - Add customer_feedback to deliveries table
    - Add delivery_zone to deliveries table

  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Add new columns to deliveries table
ALTER TABLE deliveries
  ADD COLUMN delivery_rating integer CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  ADD COLUMN customer_feedback text,
  ADD COLUMN delivery_zone text;

-- Create delivery performance logs table
CREATE TABLE delivery_performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  delivery_staff_id uuid REFERENCES profiles(id) NOT NULL,
  delivery_id uuid REFERENCES deliveries(id) NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  distance_covered numeric(10,2),
  stops_completed integer DEFAULT 0,
  status text NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE delivery_performance_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_delivery_performance_tenant ON delivery_performance_logs(tenant_id);
CREATE INDEX idx_delivery_performance_staff ON delivery_performance_logs(delivery_staff_id);
CREATE INDEX idx_delivery_performance_delivery ON delivery_performance_logs(delivery_id);

-- Create policies
CREATE POLICY "Users can view their tenant's delivery performance"
  ON delivery_performance_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT profiles.tenant_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  ));

-- Create function to calculate average delivery time
CREATE OR REPLACE FUNCTION calculate_avg_delivery_time(staff_id uuid, start_date timestamptz)
RETURNS numeric AS $$
BEGIN
  RETURN (
    SELECT AVG(EXTRACT(EPOCH FROM (d.actual_delivery - d.created_at))/3600)
    FROM deliveries d
    WHERE d.delivery_staff_id = staff_id
    AND d.status = 'delivered'
    AND d.created_at >= start_date
  );
END;
$$ LANGUAGE plpgsql;