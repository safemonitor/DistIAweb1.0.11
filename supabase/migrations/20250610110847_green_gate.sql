/*
  # Add Proof of Delivery Columns

  1. New Columns
    - `signature_url` (text) - URL to the captured signature image
    - `proof_of_delivery_image_url` (text) - URL to the proof of delivery photo
    - `customer_feedback` (text) - Customer feedback/comments
    - `delivery_rating` (integer) - Customer rating (1-5)

  2. Security
    - Add check constraint for delivery rating range
*/

DO $$
BEGIN
  -- Add signature_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN signature_url text;
  END IF;

  -- Add proof_of_delivery_image_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'proof_of_delivery_image_url'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN proof_of_delivery_image_url text;
  END IF;

  -- Add customer_feedback column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'customer_feedback'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN customer_feedback text;
  END IF;

  -- Add delivery_rating column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deliveries' AND column_name = 'delivery_rating'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN delivery_rating integer;
  END IF;

  -- Add check constraint for delivery rating if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'deliveries' AND constraint_name = 'deliveries_delivery_rating_check'
  ) THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_rating_check 
    CHECK (delivery_rating >= 1 AND delivery_rating <= 5);
  END IF;
END $$;