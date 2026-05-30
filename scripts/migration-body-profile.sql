-- ============================================================
-- 1. Add body profile columns to users table
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_avatar_url text,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS weight_kg integer,
  ADD COLUMN IF NOT EXISTS body_type text,          -- slim, athletic, medium, curvy, plus
  ADD COLUMN IF NOT EXISTS gender_presentation text, -- female, male, androgynous
  ADD COLUMN IF NOT EXISTS skin_tone text,           -- light, medium, olive, brown, dark
  ADD COLUMN IF NOT EXISTS hair_colour text,
  ADD COLUMN IF NOT EXISTS hair_length text,          -- short, medium, long, bald
  ADD COLUMN IF NOT EXISTS age_range text;            -- 18-24, 25-34, 35-44, 45-54, 55+

-- ============================================================
-- 2. Storage policies for user-avatars bucket (private bucket)
--    Each user can only access files in their own folder ({user_id}/*)
-- ============================================================

-- Allow authenticated users to upload/overwrite their own avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (overwrite) their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own avatar
CREATE POLICY "Users can read their own avatar"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
