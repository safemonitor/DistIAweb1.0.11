/*
  # Fix user activity logs RLS policy

  1. Security Changes
    - Add INSERT policy for `user_activity_logs` table
    - Allow authenticated users to insert their own activity logs
    - Ensure users can only log activities for themselves

  This migration fixes the RLS policy violation that prevents users from logging activities during sign-in and other operations.
*/

-- Add INSERT policy for user_activity_logs table
CREATE POLICY "Users can insert their own activity logs"
  ON user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);