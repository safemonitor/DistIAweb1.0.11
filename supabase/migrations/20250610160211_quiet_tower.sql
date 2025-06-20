/*
  # Fix User Limit Trigger Function

  1. Changes
    - Fix the check_tenant_user_limit function to properly handle NULL tenant_id
    - Fix the role check to use NEW.role directly instead of looking in auth.users
    - Ensure superadmin users bypass the tenant user limit check
    - Add proper error handling and logging

  2. Security
    - Maintain existing RLS policies
    - Ensure proper tenant isolation
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS enforce_tenant_user_limit ON profiles;

-- Create an improved version of the function
CREATE OR REPLACE FUNCTION check_tenant_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  max_allowed integer;
BEGIN
  -- Skip the check if tenant_id is NULL (superadmin case)
  IF NEW.tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant ID is NULL, bypassing user limit check';
    RETURN NEW;
  END IF;
  
  -- Skip the check if the user is a superadmin
  IF NEW.role = 'superadmin' THEN
    RAISE NOTICE 'User is superadmin, bypassing user limit check';
    RETURN NEW;
  END IF;
  
  -- Get current user count for the tenant
  SELECT COUNT(*) INTO current_count
  FROM profiles
  WHERE tenant_id = NEW.tenant_id;
  
  -- Get max allowed users for the tenant
  SELECT max_users INTO max_allowed
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  IF max_allowed IS NULL THEN
    RAISE EXCEPTION 'Tenant with ID % not found or max_users not set', NEW.tenant_id;
  END IF;
  
  -- Check if adding this user would exceed the limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Cannot add user: maximum user limit (%) reached for this tenant', max_allowed;
  END IF;
  
  RAISE NOTICE 'User limit check passed: % of % users', current_count, max_allowed;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER enforce_tenant_user_limit
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_user_limit();

-- Log function creation
DO $$
BEGIN
  RAISE NOTICE 'User limit trigger function fixed successfully';
END $$;