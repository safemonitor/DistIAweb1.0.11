/*
  # Admin Panel Configuration Settings

  1. New Tables
    - `settings`
      - `id` (uuid, primary key)
      - `key` (text, unique setting name)
      - `value` (text, setting value)
      - `type` (text, data type indicator)
      - `description` (text, setting description)
      - `tenant_id` (uuid, nullable for global/tenant-specific settings)
      - `category` (text, grouping settings)
      - `is_public` (boolean, whether setting is visible to non-admins)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `settings` table
    - Add policies for admin access and tenant isolation
    - Add policies for public setting access

  3. Default Settings
    - Insert common configuration settings
    - Include both global and tenant-specific examples
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  type text NOT NULL DEFAULT 'string',
  description text,
  tenant_id uuid REFERENCES tenants(id),
  category text NOT NULL DEFAULT 'general',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for setting types
ALTER TABLE settings ADD CONSTRAINT settings_type_check 
CHECK (type IN ('string', 'number', 'boolean', 'json', 'email', 'url'));

-- Add check constraint for categories
ALTER TABLE settings ADD CONSTRAINT settings_category_check 
CHECK (category IN ('general', 'email', 'security', 'features', 'integrations', 'appearance', 'notifications'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_public ON settings(is_public);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage all settings in their tenant
CREATE POLICY "Admins can manage settings in their tenant"
  ON settings
  FOR ALL
  TO authenticated
  USING (
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin' AND
    (
      tenant_id IS NULL OR 
      tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin' AND
    (
      tenant_id IS NULL OR 
      tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Policy for authenticated users to view public settings
CREATE POLICY "Users can view public settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (
    is_public = true AND
    (
      tenant_id IS NULL OR 
      tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Policy for authenticated users to view settings in their tenant
CREATE POLICY "Users can view tenant settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- Insert default global settings
INSERT INTO settings (key, value, type, description, category, is_public) VALUES
  ('app_name', 'SalesApp', 'string', 'Application name displayed in the interface', 'general', true),
  ('app_version', '1.0.0', 'string', 'Current application version', 'general', true),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode to restrict access', 'general', false),
  ('max_file_upload_size', '10485760', 'number', 'Maximum file upload size in bytes (10MB)', 'general', false),
  ('session_timeout', '3600', 'number', 'User session timeout in seconds', 'security', false),
  ('password_min_length', '8', 'number', 'Minimum password length requirement', 'security', false),
  ('require_email_verification', 'false', 'boolean', 'Require email verification for new accounts', 'security', false),
  ('enable_two_factor_auth', 'false', 'boolean', 'Enable two-factor authentication option', 'security', false),
  ('smtp_host', '', 'string', 'SMTP server hostname for email delivery', 'email', false),
  ('smtp_port', '587', 'number', 'SMTP server port', 'email', false),
  ('smtp_username', '', 'string', 'SMTP authentication username', 'email', false),
  ('smtp_use_tls', 'true', 'boolean', 'Use TLS encryption for SMTP', 'email', false),
  ('from_email', 'noreply@salesapp.com', 'email', 'Default from email address', 'email', false),
  ('support_email', 'support@salesapp.com', 'email', 'Support contact email', 'general', true),
  ('enable_notifications', 'true', 'boolean', 'Enable system notifications', 'notifications', true),
  ('notification_sound', 'true', 'boolean', 'Enable notification sounds', 'notifications', true),
  ('theme_primary_color', '#4F46E5', 'string', 'Primary theme color (hex)', 'appearance', true),
  ('theme_secondary_color', '#6B7280', 'string', 'Secondary theme color (hex)', 'appearance', true),
  ('enable_dark_mode', 'false', 'boolean', 'Enable dark mode option', 'appearance', true),
  ('google_maps_api_key', '', 'string', 'Google Maps API key for location features', 'integrations', false),
  ('enable_barcode_scanning', 'true', 'boolean', 'Enable barcode scanning features', 'features', true),
  ('enable_van_sales', 'true', 'boolean', 'Enable van sales module', 'features', true),
  ('enable_delivery_tracking', 'true', 'boolean', 'Enable delivery tracking features', 'features', true),
  ('enable_warehouse_management', 'true', 'boolean', 'Enable warehouse management module', 'features', true),
  ('auto_backup_enabled', 'true', 'boolean', 'Enable automatic data backups', 'general', false),
  ('backup_retention_days', '30', 'number', 'Number of days to retain backups', 'general', false)
ON CONFLICT (key) DO NOTHING;