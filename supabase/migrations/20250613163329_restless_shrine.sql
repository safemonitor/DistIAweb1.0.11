-- Create delivery_notices table if it doesn't exist
CREATE TABLE IF NOT EXISTS delivery_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('unread', 'read')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) NOT NULL
);

-- Create indexes for delivery_notices
CREATE INDEX IF NOT EXISTS idx_delivery_notices_delivery_id ON delivery_notices(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notices_tenant_id ON delivery_notices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notices_status ON delivery_notices(status);
CREATE INDEX IF NOT EXISTS idx_delivery_notices_created_by ON delivery_notices(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_notices_created_at ON delivery_notices(created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_notices_tenant_status ON delivery_notices(tenant_id, status);

-- Enable RLS on delivery_notices
ALTER TABLE delivery_notices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for delivery_notices
CREATE POLICY "Users can view delivery notices in their tenant"
  ON delivery_notices
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can create delivery notices in their tenant"
  ON delivery_notices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can update their own delivery notices"
  ON delivery_notices
  FOR UPDATE
  TO authenticated
  USING (
    is_superadmin() OR
    created_by = auth.uid()
  )
  WITH CHECK (
    is_superadmin() OR
    created_by = auth.uid()
  );

-- Create function to mark all notices as read for a delivery
CREATE OR REPLACE FUNCTION mark_delivery_notices_read(delivery_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE delivery_notices
  SET status = 'read'
  WHERE delivery_id = delivery_id_param
  AND status = 'unread';
END;
$$;

-- Create function to count unread notices for a user
CREATE OR REPLACE FUNCTION count_unread_notices(user_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count integer;
  user_tenant_id uuid;
BEGIN
  -- Get the user's tenant_id
  SELECT tenant_id INTO user_tenant_id
  FROM profiles
  WHERE id = user_id_param;
  
  -- Count unread notices for the user's tenant
  SELECT COUNT(*) INTO unread_count
  FROM delivery_notices
  WHERE tenant_id = user_tenant_id
  AND status = 'unread';
  
  RETURN unread_count;
END;
$$;

-- Log the migration using DO block instead of bare RAISE NOTICE
DO $$
BEGIN
  RAISE NOTICE 'Delivery notices table created successfully';
END $$;