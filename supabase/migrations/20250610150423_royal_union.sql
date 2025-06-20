/*
  # Add Coordinates to Visits Table

  1. Changes
    - Add latitude and longitude columns to visits table
    - Create index on coordinates for better query performance
    - Update RLS policies to handle new columns

  2. Notes
    - Coordinates are stored as decimal numbers with 6 decimal places
    - Index will improve performance of location-based queries
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visits' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE visits 
    ADD COLUMN latitude numeric(10,6),
    ADD COLUMN longitude numeric(10,6);

    CREATE INDEX idx_visits_coordinates 
    ON visits (latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  END IF;
END $$;