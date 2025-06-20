/*
  # Add Max Users to Tenants

  1. Changes
    - Add `max_users` column to tenants table
    - Set default value to 5 users
    - Add check constraint to ensure max_users is positive
    
  2. Purpose
    - Enable tenant seat management
    - Allow limiting the number of users per tenant
    - Support SaaS subscription tiers with different user limits
*/

-- Add max_users column to tenants table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'max_users'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN max_users integer NOT NULL DEFAULT 5;
      
    -- Add check constraint to ensure max_users is positive
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_max_users_check
      CHECK (max_users > 0);
  END IF;
END $$;

-- Create function to check user count against max_users
CREATE OR REPLACE FUNCTION check_tenant_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  max_allowed integer;
BEGIN
  -- Get current user count for the tenant
  SELECT COUNT(*) INTO current_count
  FROM profiles
  WHERE tenant_id = NEW.tenant_id;
  
  -- Get max allowed users for the tenant
  SELECT max_users INTO max_allowed
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  -- Check if adding this user would exceed the limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Cannot add user: maximum user limit (%) reached for this tenant', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce user limit
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'enforce_tenant_user_limit'
  ) THEN
    CREATE TRIGGER enforce_tenant_user_limit
      BEFORE INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION check_tenant_user_limit();
  END IF;
END $$;