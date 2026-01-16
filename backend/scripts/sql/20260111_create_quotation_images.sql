-- Create table quotation_images
CREATE TABLE IF NOT EXISTS quotation_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_quotation_images_quotation_id ON quotation_images(quotation_id);

-- Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation_images', 'quotation_images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Enable RLS on storage.objects if not already enabled (it usually is)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Policy for Reading Images (Public)
DROP POLICY IF EXISTS "Public Access Quotation Images" ON storage.objects;
CREATE POLICY "Public Access Quotation Images" ON storage.objects
FOR SELECT USING ( bucket_id = 'quotation_images' );

-- 3. Policy for Uploading Images (Authenticated users)
DROP POLICY IF EXISTS "Authenticated Upload Quotation Images" ON storage.objects;
CREATE POLICY "Authenticated Upload Quotation Images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'quotation_images' 
    AND auth.role() = 'authenticated'
);

-- 4. Policy for Deleting Images (Users can delete their own or Admins)
DROP POLICY IF EXISTS "Users Delete Own Images" ON storage.objects;
CREATE POLICY "Users Delete Own Images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'quotation_images'
    AND (auth.uid() = owner OR auth.jwt() ->> 'role' = 'service_role')
);
