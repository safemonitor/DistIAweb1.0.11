/*
  # Promotions and Discount Module

  1. New Tables
    - `promotions` - Main promotion configuration table
    - `promotion_rules` - Flexible rule system for promotion conditions
    - `promotion_actions` - Actions to take when promotion conditions are met
    - `promotion_product_eligibility` - Products eligible for promotions
    - `promotion_category_eligibility` - Categories eligible for promotions
    - `promotion_customer_eligibility` - Customer groups eligible for promotions
    - `applied_promotions` - Track promotion usage and applications
    - `promotion_usage_limits` - Track usage against limits

  2. Security
    - Enable RLS on all promotion tables
    - Add policies for tenant isolation and role-based access

  3. Features
    - Flexible rule-based promotion system
    - Multiple discount types (percentage, fixed amount, BOGO, etc.)
    - Customer group targeting
    - Product/category eligibility
    - Usage limits and tracking
    - Date-based activation
    - Stackable promotions support
*/

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  promotion_type text NOT NULL,
  discount_type text NOT NULL,
  discount_value numeric(10,2) NOT NULL,
  minimum_order_amount numeric(10,2) DEFAULT 0,
  maximum_discount_amount numeric(10,2),
  is_active boolean DEFAULT true,
  is_stackable boolean DEFAULT false,
  priority integer DEFAULT 0,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  usage_limit integer,
  usage_limit_per_customer integer,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraints for promotions
ALTER TABLE promotions ADD CONSTRAINT promotions_type_check 
CHECK (promotion_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping', 'bundle', 'tiered', 'category_discount'));

ALTER TABLE promotions ADD CONSTRAINT promotions_discount_type_check 
CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_item', 'free_shipping', 'buy_x_get_y_free', 'buy_x_get_y_discount'));

-- Create promotion rules table for flexible conditions
CREATE TABLE IF NOT EXISTS promotion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  field_name text NOT NULL,
  operator text NOT NULL,
  value text NOT NULL,
  logical_operator text DEFAULT 'AND',
  rule_group integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Add check constraints for promotion rules
ALTER TABLE promotion_rules ADD CONSTRAINT promotion_rules_type_check 
CHECK (rule_type IN ('order', 'product', 'customer', 'time', 'quantity', 'category'));

ALTER TABLE promotion_rules ADD CONSTRAINT promotion_rules_operator_check 
CHECK (operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'contains', 'in', 'not_in', 'between'));

ALTER TABLE promotion_rules ADD CONSTRAINT promotion_rules_logical_check 
CHECK (logical_operator IN ('AND', 'OR'));

-- Create promotion actions table for flexible actions
CREATE TABLE IF NOT EXISTS promotion_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_value text,
  action_value numeric(10,2),
  action_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add check constraints for promotion actions
ALTER TABLE promotion_actions ADD CONSTRAINT promotion_actions_type_check 
CHECK (action_type IN ('discount_percentage', 'discount_fixed', 'add_free_item', 'free_shipping', 'upgrade_shipping', 'apply_to_category', 'apply_to_product'));

ALTER TABLE promotion_actions ADD CONSTRAINT promotion_actions_target_check 
CHECK (target_type IN ('order', 'product', 'category', 'shipping', 'cheapest_item', 'most_expensive_item', 'specific_product'));

-- Create promotion product eligibility table
CREATE TABLE IF NOT EXISTS promotion_product_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_included boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, product_id)
);

-- Create promotion category eligibility table
CREATE TABLE IF NOT EXISTS promotion_category_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  category text NOT NULL,
  is_included boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, category)
);

-- Create promotion customer eligibility table
CREATE TABLE IF NOT EXISTS promotion_customer_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_group text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  is_included boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for customer groups
ALTER TABLE promotion_customer_eligibility ADD CONSTRAINT promotion_customer_group_check 
CHECK (customer_group IN ('all', 'new', 'returning', 'vip', 'wholesale', 'retail', 'specific'));

-- Create applied promotions table to track usage
CREATE TABLE IF NOT EXISTS applied_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  discount_amount numeric(10,2) NOT NULL,
  applied_at timestamptz DEFAULT now(),
  applied_by uuid REFERENCES profiles(id)
);

-- Create promotion usage limits tracking
CREATE TABLE IF NOT EXISTS promotion_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, customer_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotions_tenant_id ON promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_priority ON promotions(priority DESC);

CREATE INDEX IF NOT EXISTS idx_promotion_rules_promotion_id ON promotion_rules(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_type ON promotion_rules(rule_type);

CREATE INDEX IF NOT EXISTS idx_promotion_actions_promotion_id ON promotion_actions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_actions_type ON promotion_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_promotion_product_eligibility_promotion_id ON promotion_product_eligibility(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_product_eligibility_product_id ON promotion_product_eligibility(product_id);

CREATE INDEX IF NOT EXISTS idx_promotion_category_eligibility_promotion_id ON promotion_category_eligibility(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_category_eligibility_category ON promotion_category_eligibility(category);

CREATE INDEX IF NOT EXISTS idx_promotion_customer_eligibility_promotion_id ON promotion_customer_eligibility(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_customer_eligibility_customer_id ON promotion_customer_eligibility(customer_id);

CREATE INDEX IF NOT EXISTS idx_applied_promotions_promotion_id ON applied_promotions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_applied_promotions_order_id ON applied_promotions(order_id);
CREATE INDEX IF NOT EXISTS idx_applied_promotions_customer_id ON applied_promotions(customer_id);
CREATE INDEX IF NOT EXISTS idx_applied_promotions_date ON applied_promotions(applied_at);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_limits_promotion_id ON promotion_usage_limits(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_limits_customer_id ON promotion_usage_limits(customer_id);

-- Enable Row Level Security
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_product_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_category_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_customer_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotions
CREATE POLICY "Users can view promotions in their tenant"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage promotions in their tenant"
  ON promotions
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for promotion rules
CREATE POLICY "Users can view promotion rules in their tenant"
  ON promotion_rules
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage promotion rules in their tenant"
  ON promotion_rules
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for promotion actions
CREATE POLICY "Users can view promotion actions in their tenant"
  ON promotion_actions
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage promotion actions in their tenant"
  ON promotion_actions
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for promotion product eligibility
CREATE POLICY "Users can view promotion product eligibility in their tenant"
  ON promotion_product_eligibility
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage promotion product eligibility in their tenant"
  ON promotion_product_eligibility
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for promotion category eligibility
CREATE POLICY "Users can view promotion category eligibility in their tenant"
  ON promotion_category_eligibility
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage promotion category eligibility in their tenant"
  ON promotion_category_eligibility
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for promotion customer eligibility
CREATE POLICY "Users can view promotion customer eligibility in their tenant"
  ON promotion_customer_eligibility
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage promotion customer eligibility in their tenant"
  ON promotion_customer_eligibility
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    ) AND
    (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) IN ('admin', 'sales')
  );

-- RLS Policies for applied promotions
CREATE POLICY "Users can view applied promotions in their tenant"
  ON applied_promotions
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create applied promotions in their tenant"
  ON applied_promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for promotion usage limits
CREATE POLICY "Users can view promotion usage limits in their tenant"
  ON promotion_usage_limits
  FOR SELECT
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage promotion usage limits in their tenant"
  ON promotion_usage_limits
  FOR ALL
  TO authenticated
  USING (
    promotion_id IN (
      SELECT id FROM promotions 
      WHERE tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update promotion updated_at timestamp
CREATE OR REPLACE FUNCTION update_promotion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_promotion_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_updated_at();

-- Function to update promotion usage limits
CREATE OR REPLACE FUNCTION update_promotion_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert usage limit record
  INSERT INTO promotion_usage_limits (promotion_id, customer_id, usage_count, last_used_at)
  VALUES (NEW.promotion_id, NEW.customer_id, 1, NEW.applied_at)
  ON CONFLICT (promotion_id, customer_id)
  DO UPDATE SET
    usage_count = promotion_usage_limits.usage_count + 1,
    last_used_at = NEW.applied_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage when promotion is applied
CREATE TRIGGER trigger_update_promotion_usage
  AFTER INSERT ON applied_promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_usage();