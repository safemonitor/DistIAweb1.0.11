/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem Analysis
    - The current RLS policies on the `profiles` table contain recursive references
    - Policies are querying the `profiles` table within their own conditions
    - This creates infinite loops when Supabase tries to evaluate the policies

  2. Solution
    - Replace recursive policies with simpler, direct conditions
    - Use auth.uid() directly instead of subqueries to profiles table
    - Ensure policies don't reference the same table they're protecting

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that avoid recursion
    - Maintain the same security model without circular references
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Superadmin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Create new simplified policies without recursion

-- Superadmin policy (simple and direct)
CREATE POLICY "Superadmin can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_superadmin())
  WITH CHECK (is_superadmin());

-- Users can update their own profile (direct comparison with auth.uid())
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can view their own profile (direct comparison)
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Separate policy for viewing profiles in same tenant (using a function to avoid recursion)
CREATE OR REPLACE FUNCTION get_user_tenant_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM profiles WHERE id = user_id LIMIT 1;
$$;

CREATE POLICY "Users can view profiles in same tenant"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR 
    tenant_id = get_user_tenant_id(auth.uid())
  );