-- Make image columns nullable for S3 storage compatibility
-- This allows items to be stored without binary image data when using S3

ALTER TABLE clothing_items 
ALTER COLUMN image_data DROP NOT NULL;

ALTER TABLE clothing_items 
ALTER COLUMN image_mime_type DROP NOT NULL;

ALTER TABLE clothing_items 
ALTER COLUMN image_filename DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clothing_items' 
  AND column_name IN ('image_data', 'image_mime_type', 'image_filename')
ORDER BY column_name;