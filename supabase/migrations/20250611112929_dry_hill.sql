/*
  # Route/Visits Module Schema Enhancements

  1. New Tables
    - `route_customers` - Links customers to routes
    - `route_agent_assignments` - Assigns agents to routes with schedules
    - `visit_schedules` - Defines recurring visit patterns
  
  2. Changes
    - Add `schedule_id` to visits table
    - Add indexes for performance
    - Add RLS policies for security
  
  3. Security
    - Enable RLS on all new tables
    - Add policies for tenant isolation
    - Add role-based access control
*/

-- Create route_customers table
CREATE TABLE IF NOT EXISTS route_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sequence_number integer DEFAULT 0,
  assigned_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(route_id, customer_id)
);

-- Create route_agent_assignments table
CREATE TABLE IF NOT EXISTS route_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  assigned_days_of_week integer[] DEFAULT '{1,2,3,4,5}'::integer[], -- Mon-Fri by default
  is_recurring boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create visit_schedules table
CREATE TABLE IF NOT EXISTS visit_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_customer_id uuid NOT NULL REFERENCES route_customers(id) ON DELETE CASCADE,
  frequency_type text NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'custom')),
  frequency_value integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  end_date date,
  days_of_week integer[],
  day_of_month integer,
  exclude_dates date[],
  notes text,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id)
);

-- Add schedule_id to visits table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visits' AND column_name = 'schedule_id'
  ) THEN
    ALTER TABLE visits ADD COLUMN schedule_id uuid REFERENCES visit_schedules(id);
  END IF;
END $$;

-- Create function to get tenant ID from route
CREATE OR REPLACE FUNCTION get_route_tenant_id(route_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM routes WHERE id = route_id;
$$;

-- Create function to get tenant ID from route_customer
CREATE OR REPLACE FUNCTION get_route_customer_tenant_id(route_customer_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT r.tenant_id 
  FROM route_customers rc
  JOIN routes r ON rc.route_id = r.id
  WHERE rc.id = route_customer_id;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_route_customers_route_id ON route_customers(route_id);
CREATE INDEX IF NOT EXISTS idx_route_customers_customer_id ON route_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_route_agent_assignments_route_id ON route_agent_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_agent_assignments_agent_id ON route_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_route_agent_assignments_dates ON route_agent_assignments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_visit_schedules_route_customer_id ON visit_schedules(route_customer_id);
CREATE INDEX IF NOT EXISTS idx_visit_schedules_tenant_id ON visit_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_schedule_id ON visits(schedule_id);

-- Enable Row Level Security
ALTER TABLE route_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for route_customers
CREATE POLICY "Users can view route customers in their tenant"
  ON route_customers
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Staff can manage route customers"
  ON route_customers
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales', 'presales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales', 'presales')
    )
  );

-- RLS Policies for route_agent_assignments
CREATE POLICY "Users can view route agent assignments in their tenant"
  ON route_agent_assignments
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Admins can manage route agent assignments"
  ON route_agent_assignments
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      get_route_tenant_id(route_id) = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) = 'admin'
    )
  );

-- RLS Policies for visit_schedules
CREATE POLICY "Users can view visit schedules in their tenant"
  ON visit_schedules
  FOR SELECT
  TO authenticated
  USING (
    is_superadmin() OR
    tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Staff can manage visit schedules"
  ON visit_schedules
  FOR ALL
  TO authenticated
  USING (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales', 'presales')
    )
  )
  WITH CHECK (
    is_superadmin() OR
    (
      tenant_id = get_user_tenant_id(auth.uid()) AND
      get_user_role(auth.uid()) IN ('admin', 'sales', 'presales')
    )
  );

-- Create function to generate visits from schedule
CREATE OR REPLACE FUNCTION generate_visits_from_schedule(
  schedule_id uuid,
  generation_start_date date,
  generation_end_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule visit_schedules;
  v_route_customer route_customers;
  v_route routes;
  v_customer customers;
  v_current_date date;
  v_visit_date date;
  v_day_of_week integer;
  v_day_of_month integer;
  v_visits_created integer := 0;
  v_tenant_id uuid;
BEGIN
  -- Get the schedule details
  SELECT * INTO v_schedule FROM visit_schedules WHERE id = schedule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule with ID % not found', schedule_id;
  END IF;
  
  -- Get the route_customer details
  SELECT * INTO v_route_customer FROM route_customers WHERE id = v_schedule.route_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route customer with ID % not found', v_schedule.route_customer_id;
  END IF;
  
  -- Get the route details
  SELECT * INTO v_route FROM routes WHERE id = v_route_customer.route_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route with ID % not found', v_route_customer.route_id;
  END IF;
  
  -- Get the customer details
  SELECT * INTO v_customer FROM customers WHERE id = v_route_customer.customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer with ID % not found', v_route_customer.customer_id;
  END IF;
  
  -- Set tenant_id
  v_tenant_id := v_route.tenant_id;
  
  -- Initialize the current date to the start date of the generation period
  -- or the schedule start date, whichever is later
  v_current_date := GREATEST(generation_start_date, v_schedule.start_date);
  
  -- Loop until we reach the end date of the generation period
  -- or the schedule end date, whichever is earlier
  WHILE v_current_date <= LEAST(generation_end_date, COALESCE(v_schedule.end_date, generation_end_date)) LOOP
    -- Determine if we should create a visit for this date based on the frequency type
    CASE v_schedule.frequency_type
      WHEN 'daily' THEN
        -- For daily frequency, check if the current date is a multiple of frequency_value days from the start date
        IF (v_current_date - v_schedule.start_date) % v_schedule.frequency_value = 0 THEN
          v_visit_date := v_current_date;
        ELSE
          v_visit_date := NULL;
        END IF;
        
      WHEN 'weekly' THEN
        -- For weekly frequency, check if the current date is on one of the specified days of the week
        -- and if it's a multiple of frequency_value weeks from the start date
        v_day_of_week := EXTRACT(DOW FROM v_current_date) + 1; -- PostgreSQL DOW is 0-6 (Sun-Sat), we want 1-7 (Mon-Sun)
        
        IF v_schedule.days_of_week IS NULL OR v_day_of_week = ANY(v_schedule.days_of_week) THEN
          -- Check if it's the right week based on frequency_value
          IF (EXTRACT(WEEK FROM v_current_date) - EXTRACT(WEEK FROM v_schedule.start_date)) % v_schedule.frequency_value = 0 THEN
            v_visit_date := v_current_date;
          ELSE
            v_visit_date := NULL;
          END IF;
        ELSE
          v_visit_date := NULL;
        END IF;
        
      WHEN 'monthly' THEN
        -- For monthly frequency, check if the current date is on the specified day of the month
        -- and if it's a multiple of frequency_value months from the start date
        v_day_of_month := EXTRACT(DAY FROM v_current_date);
        
        IF v_schedule.day_of_month IS NULL OR v_day_of_month = v_schedule.day_of_month THEN
          -- Check if it's the right month based on frequency_value
          IF (EXTRACT(MONTH FROM v_current_date) - EXTRACT(MONTH FROM v_schedule.start_date) + 
              (EXTRACT(YEAR FROM v_current_date) - EXTRACT(YEAR FROM v_schedule.start_date)) * 12) % v_schedule.frequency_value = 0 THEN
            v_visit_date := v_current_date;
          ELSE
            v_visit_date := NULL;
          END IF;
        ELSE
          v_visit_date := NULL;
        END IF;
        
      WHEN 'custom' THEN
        -- For custom frequency, check if the current date is one of the specified days of the week
        v_day_of_week := EXTRACT(DOW FROM v_current_date) + 1; -- PostgreSQL DOW is 0-6 (Sun-Sat), we want 1-7 (Mon-Sun)
        
        IF v_schedule.days_of_week IS NULL OR v_day_of_week = ANY(v_schedule.days_of_week) THEN
          v_visit_date := v_current_date;
        ELSE
          v_visit_date := NULL;
        END IF;
        
      ELSE
        v_visit_date := NULL;
    END CASE;
    
    -- Check if the date is in the exclude_dates array
    IF v_visit_date IS NOT NULL AND v_schedule.exclude_dates IS NOT NULL THEN
      IF v_visit_date = ANY(v_schedule.exclude_dates) THEN
        v_visit_date := NULL;
      END IF;
    END IF;
    
    -- If we have a valid visit date, create a visit
    IF v_visit_date IS NOT NULL THEN
      -- Check if a visit already exists for this schedule and date
      IF NOT EXISTS (
        SELECT 1 FROM visits 
        WHERE schedule_id = v_schedule.id 
        AND DATE(visit_date) = v_visit_date
      ) THEN
        -- Create the visit
        INSERT INTO visits (
          tenant_id,
          customer_id,
          visit_date,
          notes,
          outcome,
          created_by,
          schedule_id
        ) VALUES (
          v_tenant_id,
          v_customer.id,
          v_visit_date + TIME '09:00:00', -- Default to 9 AM
          COALESCE(v_schedule.notes, 'Scheduled visit'),
          'pending',
          auth.uid(),
          v_schedule.id
        );
        
        v_visits_created := v_visits_created + 1;
      END IF;
    END IF;
    
    -- Move to the next day
    v_current_date := v_current_date + 1;
  END LOOP;
  
  RETURN v_visits_created;
END;
$$;

-- Create function to get assigned agent for a route on a specific date
CREATE OR REPLACE FUNCTION get_route_assigned_agent(
  route_id uuid,
  visit_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id uuid;
  v_day_of_week integer;
BEGIN
  -- Get the day of week (1-7, Monday-Sunday)
  v_day_of_week := EXTRACT(DOW FROM visit_date) + 1;
  
  -- Find the assigned agent for this route on this date
  SELECT agent_id INTO v_agent_id
  FROM route_agent_assignments
  WHERE route_id = route_id
    AND start_date <= visit_date
    AND (end_date IS NULL OR end_date >= visit_date)
    AND (
      (is_recurring = true AND v_day_of_week = ANY(assigned_days_of_week))
      OR
      (is_recurring = false)
    )
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_agent_id;
END;
$$;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Route/Visits module schema enhancements completed successfully';
END $$;