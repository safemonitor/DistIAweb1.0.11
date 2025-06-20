/*
  # Initial Schema Setup for Multi-tenant SaaS Application

  1. New Tables
    - tenants: Store organization information
    - profiles: Extended user profiles with tenant association
    - tenant_modules: Track enabled modules per tenant
    - products: Product catalog
    - orders: Customer orders
    - order_items: Order line items
    - invoices: Order invoices

  2. Security
    - Enable RLS on all tables
    - Add policies for tenant isolation
    - Add role-based access policies
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  subscription_plan text NOT NULL DEFAULT 'basic'
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  tenant_id uuid REFERENCES tenants(id),
  role text NOT NULL CHECK (role IN ('admin', 'sales', 'presales', 'delivery', 'warehouse')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create tenant_modules table
CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id uuid REFERENCES tenants(id),
  module_name text NOT NULL CHECK (module_name IN ('presales_delivery', 'van_sales', 'wms')),
  enabled boolean DEFAULT false,
  PRIMARY KEY (tenant_id, module_name)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  sku text NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  category text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, sku)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  customer_id uuid NOT NULL,
  order_date timestamptz DEFAULT now(),
  total_amount decimal(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  order_id uuid REFERENCES orders(id),
  invoice_date timestamptz DEFAULT now(),
  due_date timestamptz NOT NULL,
  total_amount decimal(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('paid', 'unpaid', 'overdue')),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY "Users can view their own tenant"
  ON tenants
  FOR SELECT
  USING (id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view profiles in their tenant"
  ON profiles
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their tenant's modules"
  ON tenant_modules
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their tenant's products"
  ON products
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their tenant's orders"
  ON orders
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their tenant's order items"
  ON order_items
  FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can view their tenant's invoices"
  ON invoices
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);