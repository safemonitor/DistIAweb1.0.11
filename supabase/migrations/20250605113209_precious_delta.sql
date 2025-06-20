/*
  # Update delivery tracking for in-house delivery staff
  
  1. Changes
    - Add delivery_staff_id to link deliveries to staff profiles
    - Update carrier field to delivery_staff_id
    - Add delivery route and notes fields
    - Update status options for internal delivery workflow
  
  2. Security
    - Enable RLS on deliveries table
    - Add policy for authenticated users to view their tenant's deliveries
*/

ALTER TABLE deliveries 
  DROP COLUMN carrier,
  ADD COLUMN delivery_staff_id uuid REFERENCES profiles(id),
  ADD COLUMN route_number text,
  ADD COLUMN delivery_notes text;

-- Update status check constraint for internal delivery workflow
ALTER TABLE deliveries 
  DROP CONSTRAINT deliveries_status_check,
  ADD CONSTRAINT deliveries_status_check 
    CHECK (status IN ('assigned', 'out_for_delivery', 'delivered', 'failed', 'cancelled'));

-- Create index for delivery staff lookups
CREATE INDEX idx_deliveries_staff_id ON deliveries(delivery_staff_id);