-- Create user_activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  action_type text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid REFERENCES tenants(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_tenant_id ON user_activity_logs(tenant_id);

-- Enable Row Level Security
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Check if they exist first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_activity_logs' AND policyname = 'Users can view their own activity logs'
  ) THEN
    CREATE POLICY "Users can view their own activity logs"
      ON user_activity_logs
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_activity_logs' AND policyname = 'Users can insert their own activity logs'
  ) THEN
    CREATE POLICY "Users can insert their own activity logs"
      ON user_activity_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_activity_logs' AND policyname = 'Admins can view all activity logs in their tenant'
  ) THEN
    CREATE POLICY "Admins can view all activity logs in their tenant"
      ON user_activity_logs
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
        AND
        user_id IN (
          SELECT id FROM profiles 
          WHERE tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_activity_logs' AND policyname = 'Superadmin can view all activity logs'
  ) THEN
    CREATE POLICY "Superadmin can view all activity logs"
      ON user_activity_logs
      FOR SELECT
      TO authenticated
      USING (is_superadmin());
  END IF;
END $$;