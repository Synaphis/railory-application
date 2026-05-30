-- Migration: Add preview_image column to outfits + storage bucket
-- Run this in the Supabase SQL Editor

-- 1. Add preview_image column to outfits table
ALTER TABLE outfits ADD COLUMN IF NOT EXISTS preview_image text;

-- 2. Create storage bucket for outfit previews (public so images load without signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('outfit-previews', 'outfit-previews', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow authenticated users to read any preview (public bucket)
CREATE POLICY "Anyone can view outfit previews"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'outfit-previews');

-- 4. Allow service role to insert/update previews (edge functions use service key)
CREATE POLICY "Service role can upload outfit previews"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'outfit-previews');

CREATE POLICY "Service role can update outfit previews"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'outfit-previews');
