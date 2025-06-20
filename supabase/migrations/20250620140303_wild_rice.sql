/*
  # Marketing Module Schema

  1. New Tables
    - `promotional_content` - Stores marketing materials (text, images, videos)
    - `campaigns` - Defines marketing campaigns
    - `campaign_promotional_content` - Links campaigns to promotional content
    - `campaign_customer_segments` - Links campaigns to target customers
    - `whatsapp_messages` - Logs all WhatsApp communication
    - `whatsapp_sessions` - Tracks ongoing WhatsApp conversations
    
  2. Changes to Existing Tables
    - Add `source` column to `orders` table to track order origin
    
  3. Security
    - Enable RLS on all new tables
    - Add policies for tenant isolation
    - Add role-based access control
*/

-- Add source column to orders table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'source'
  ) THEN
    ALTER TABLE orders ADD COLUMN source text DEFAULT 'web';
  END IF;
END $$;

-- Create promotional_content table
CREATE TABLE IF NOT EXISTS promotional_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'image', 'video')),
  content_text text,
  content_url text,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id)
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')) DEFAULT 'draft',
  target_audience text NOT NULL CHECK (target_audience IN ('all_customers', 'new_customers', 'specific_customers', 'customer_segment')),
  ai_notes jsonb,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campaign_promotional_content junction table
CREATE TABLE IF NOT EXISTS campaign_promotional_content (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  promotional_content_id uuid NOT NULL REFERENCES promotional_content(id) ON DELETE CASCADE,
  sequence_number integer DEFAULT 0,
  PRIMARY KEY (campaign_id, promotional_content_id)
);

-- Create campaign_customer_segments table
CREATE TABLE IF NOT EXISTS campaign_customer_segments (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, customer_id)
);

-- Create whatsapp_messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_number text NOT NULL,
  to_number text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'other')),
  content text,
  media_url text,
  timestamp timestamptz DEFAULT now(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL CHECK (status IN ('sent', 'received', 'read', 'failed')),
  customer_id uuid REFERENCES customers(id),
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create whatsapp_sessions table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  phone_number text NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, phone_number)
);

-- Create campaign_metrics table for storing analytics
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  messages_sent integer DEFAULT 0,
  messages_delivered integer DEFAULT 0,
  messages_read integer DEFAULT 0,
  responses_received integer DEFAULT 0,
  orders_placed integer DEFAULT 0,
  revenue_generated numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

-- Create whatsapp_orders view for easy querying
CREATE OR REPLACE VIEW whatsapp_orders AS
SELECT o.*, c.name as customer_name, c.phone as customer_phone
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.source = 'whatsapp';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotional_content_tenant_id ON promotional_content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotional_content_type ON promotional_content(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_id ON whatsapp_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer_id ON whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_id ON whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_tenant_id ON whatsapp_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_customer_id ON whatsapp_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone_number ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_id ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

-- Enable Row Level Security
ALTER TABLE promotional_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_promotional_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotional_content
CREATE POLICY "Users can view promotional content in their tenant"
  ON promotional_content
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Marketing staff can manage promotional content"
  ON promotional_content
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  );

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns in their tenant"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Marketing staff can manage campaigns"
  ON campaigns
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  );

-- RLS Policies for campaign_promotional_content
CREATE POLICY "Users can view campaign promotional content"
  ON campaign_promotional_content
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Marketing staff can manage campaign promotional content"
  ON campaign_promotional_content
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      campaign_id IN (
        SELECT id FROM campaigns
        WHERE tenant_id = get_user_tenant_id(auth.uid())
      ) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      campaign_id IN (
        SELECT id FROM campaigns
        WHERE tenant_id = get_user_tenant_id(auth.uid())
      ) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  );

-- RLS Policies for campaign_customer_segments
CREATE POLICY "Users can view campaign customer segments"
  ON campaign_customer_segments
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Marketing staff can manage campaign customer segments"
  ON campaign_customer_segments
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      campaign_id IN (
        SELECT id FROM campaigns
        WHERE tenant_id = get_user_tenant_id(auth.uid())
      ) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      campaign_id IN (
        SELECT id FROM campaigns
        WHERE tenant_id = get_user_tenant_id(auth.uid())
      ) AND
      get_user_role(auth.uid()) IN ('admin', 'sales')
    )
  );

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view whatsapp messages in their tenant"
  ON whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "System can insert whatsapp messages"
  ON whatsapp_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- RLS Policies for whatsapp_sessions
CREATE POLICY "Users can view whatsapp sessions in their tenant"
  ON whatsapp_sessions
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "System can manage whatsapp sessions"
  ON whatsapp_sessions
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  )
  WITH CHECK (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

-- RLS Policies for campaign_metrics
CREATE POLICY "Users can view campaign metrics in their tenant"
  ON campaign_metrics
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "System can manage campaign metrics"
  ON campaign_metrics
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  )
  WITH CHECK (
    is_superadmin() OR
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Create function to update campaign updated_at timestamp
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_campaign_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_updated_at();

-- Create function to update campaign metrics
CREATE OR REPLACE FUNCTION update_campaign_metrics()
RETURNS TRIGGER AS $$
DECLARE
  campaign_tenant_id uuid;
BEGIN
  -- Get the tenant_id for the campaign
  SELECT tenant_id INTO campaign_tenant_id
  FROM campaigns
  WHERE id = NEW.campaign_id;
  
  -- Insert or update campaign metrics for today
  INSERT INTO campaign_metrics (
    campaign_id,
    metric_date,
    messages_sent,
    updated_at
  )
  VALUES (
    NEW.campaign_id,
    CURRENT_DATE,
    1,
    now()
  )
  ON CONFLICT (campaign_id, metric_date)
  DO UPDATE SET
    messages_sent = campaign_metrics.messages_sent + 1,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update campaign metrics when a message is sent
CREATE TRIGGER trigger_update_campaign_metrics
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.direction = 'outbound')
  EXECUTE FUNCTION update_campaign_metrics();

-- Create storage bucket for marketing media
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-media', 'marketing-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for marketing media
CREATE POLICY "Users can upload marketing media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-media' AND (
  is_superadmin() OR
  (
    get_user_role(auth.uid()) IN ('admin', 'sales')
  )
));

CREATE POLICY "Users can view marketing media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'marketing-media');

CREATE POLICY "Users can update their marketing media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing-media' AND (
  is_superadmin() OR
  (
    get_user_role(auth.uid()) IN ('admin', 'sales')
  )
));

CREATE POLICY "Users can delete their marketing media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-media' AND (
  is_superadmin() OR
  (
    get_user_role(auth.uid()) IN ('admin', 'sales')
  )
));