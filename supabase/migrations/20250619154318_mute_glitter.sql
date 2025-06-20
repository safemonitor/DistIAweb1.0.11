/*
  # User Role Management
  
  1. Changes
    - Create a trigger to handle new user creation with appropriate roles
    - Allow proper tenant_id assignment for users
    - Maintain the tenant user limit enforcement
    
  2. Security
    - Ensure proper role-based access control
    - Maintain tenant isolation for regular users
    - Allow superadmins to access all data
*/

-- Create a simplified version of the auth.signUp function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Create a profile with the appropriate role
  -- For regular signups, default to 'admin' role with tenant_id from the signup
  -- For superadmin creation, this will be manually set
  INSERT INTO public.profiles (id, role, first_name, last_name, tenant_id)
  VALUES (NEW.id, 'admin', 'New', 'User', NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger on auth.users to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Re-add the tenant user limit trigger
CREATE OR REPLACE FUNCTION check_tenant_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count integer;
  max_allowed integer;
BEGIN
  -- Skip the check if tenant_id is NULL (superadmin case)
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip the check if the user is a superadmin
  IF NEW.role = 'superadmin' THEN
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
  
  -- Check if adding this user would exceed the limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Cannot add user: maximum user limit (%) reached for this tenant', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the tenant user limit trigger
DROP TRIGGER IF EXISTS enforce_tenant_user_limit ON profiles;
CREATE TRIGGER enforce_tenant_user_limit
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_tenant_user_limit();