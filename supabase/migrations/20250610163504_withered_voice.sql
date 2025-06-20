/*
  # Force Superadmin Role for All Users
  
  1. Changes
    - Create a trigger to automatically set all new users to superadmin role
    - Bypass tenant_id requirement for all users
    - Update existing users to superadmin role
    
  2. Security
    - This is a temporary solution for development purposes
    - In production, you would want proper role-based access control
*/

-- Create a trigger function to force superadmin role
CREATE OR REPLACE FUNCTION force_superadmin_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Force superadmin role and null tenant_id
  NEW.role = 'superadmin';
  NEW.tenant_id = NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to apply this to all new profiles
DROP TRIGGER IF EXISTS force_superadmin_role_trigger ON profiles;
CREATE TRIGGER force_superadmin_role_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION force_superadmin_role();

-- Update all existing users to superadmin role
UPDATE profiles
SET role = 'superadmin', tenant_id = NULL;

-- Disable the tenant user limit trigger
DROP TRIGGER IF EXISTS enforce_tenant_user_limit ON profiles;

-- Create a simplified version of the auth.signUp function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, tenant_id)
  VALUES (NEW.id, 'superadmin', 'New', 'User', NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger on auth.users to automatically create profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();