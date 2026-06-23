-- Plantcaer: Storage RLS Policies for plant-photos bucket
-- Run this in the Supabase SQL Editor or via `supabase db push`
-- Requires the plant-photos bucket to already exist

-- Allow authenticated users to upload files to plant-photos bucket
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'plant-photos'
  );

-- Allow authenticated users to view files in plant-photos bucket
CREATE POLICY "Authenticated users can view photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'plant-photos');

-- Allow authenticated users to update files in plant-photos bucket
CREATE POLICY "Authenticated users can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'plant-photos')
  WITH CHECK (bucket_id = 'plant-photos');

-- Allow authenticated users to delete files from plant-photos bucket
CREATE POLICY "Authenticated users can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'plant-photos');

-- Allow public (anon) access to read photos from the public bucket
-- This is needed because getPublicUrl returns a publicly accessible URL
-- but the storage API itself still checks RLS
CREATE POLICY "Public can view photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'plant-photos');
