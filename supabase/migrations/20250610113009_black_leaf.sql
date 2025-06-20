-- Create storage bucket for visit photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for visit photos
CREATE POLICY "Users can upload visit photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visit-photos');

CREATE POLICY "Users can view visit photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'visit-photos');

CREATE POLICY "Users can update their visit photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'visit-photos');

CREATE POLICY "Users can delete their visit photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'visit-photos');