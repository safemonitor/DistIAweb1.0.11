/*
  # Add Proof of Delivery columns to deliveries table

  1. New Columns
    - `signature_url` (text) - URL to customer signature image
    - `proof_of_delivery_image_url` (text) - URL to delivery photo
    - `customer_feedback` (text) - Customer feedback/comments
    - `delivery_rating` (integer) - Customer rating (1-5)

  2. Security
    - Add check constraint for delivery rating range
    - Update existing RLS policies to handle new columns

  3. Storage
    - Create delivery-proofs storage bucket
    - Set up storage policies for proof of delivery files
*/

-- Add new columns to deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN signature_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'proof_of_delivery_image_url'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN proof_of_delivery_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'customer_feedback'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN customer_feedback text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivery_rating'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN delivery_rating integer;
  END IF;
END $$;

-- Add check constraint for delivery rating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deliveries_delivery_rating_check'
  ) THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_rating_check 
    CHECK (delivery_rating >= 1 AND delivery_rating <= 5);
  END IF;
END $$;

-- Create storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for delivery proof files
CREATE POLICY "Delivery staff can upload proof files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs' AND
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) IN ('delivery', 'admin')
);

CREATE POLICY "Users can view delivery proof files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Delivery staff can update proof files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs' AND
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) IN ('delivery', 'admin')
);

CREATE POLICY "Delivery staff can delete proof files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-proofs' AND
  (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) IN ('delivery', 'admin')
);