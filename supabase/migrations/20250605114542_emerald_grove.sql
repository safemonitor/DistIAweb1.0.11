/*
  # Fix User Management Policies

  1. Changes
    - Add admin management policy
    - Add self-update policy
    - Add performance index
  
  2. Security
    - Maintain existing RLS
    - Add role-based access for admins
    - Allow users to update their own profiles
*/

-- Add admin management policy if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can manage users in their tenant'
  ) THEN
    CREATE POLICY "Admins can manage users in their tenant"
      ON profiles
      FOR ALL
      TO authenticated
      USING (
        tenant_id IN (
          SELECT tenant_id 
          FROM profiles 
          WHERE id = auth.uid()
        ) AND (
          SELECT role 
          FROM profiles 
          WHERE id = auth.uid()
        ) = 'admin'
      );
  END IF;
END $$;

-- Add self-update policy if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Add performance index if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'profiles' 
    AND indexname = 'idx_profiles_tenant_id'
  ) THEN
    CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
  END IF;
END $$;