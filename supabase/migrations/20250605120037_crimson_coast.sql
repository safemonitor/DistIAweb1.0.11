/*
  # Add coordinates to deliveries table

  1. Changes
    - Add latitude and longitude columns to deliveries table
    - Set default values to null to allow for deliveries without coordinates
    - Add index on coordinates for better query performance

  2. Notes
    - Coordinates are stored as decimal numbers
    - Index will improve performance of location-based queries
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deliveries' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE deliveries 
    ADD COLUMN latitude numeric(10,6),
    ADD COLUMN longitude numeric(10,6);

    CREATE INDEX idx_deliveries_coordinates 
    ON deliveries (latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;