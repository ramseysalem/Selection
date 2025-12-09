-- S3 Migration SQL
-- This script migrates from storing images as binary data to S3 URLs

-- Step 1: Add new columns for S3 storage
ALTER TABLE clothing_items 
ADD COLUMN image_url VARCHAR(500),
ADD COLUMN image_s3_key VARCHAR(200),
ADD COLUMN thumbnail_url VARCHAR(500),
ADD COLUMN image_optimized_size INTEGER,
ADD COLUMN storage_type VARCHAR(20) DEFAULT 'database';

-- Step 2: Create indexes for performance
CREATE INDEX idx_clothing_items_storage_type ON clothing_items(storage_type);
CREATE INDEX idx_clothing_items_s3_key ON clothing_items(image_s3_key);

-- Step 3: Add comments for documentation
COMMENT ON COLUMN clothing_items.image_url IS 'Public S3 URL for the optimized main image';
COMMENT ON COLUMN clothing_items.image_s3_key IS 'S3 object key for programmatic access';
COMMENT ON COLUMN clothing_items.thumbnail_url IS 'Public S3 URL for the thumbnail image';
COMMENT ON COLUMN clothing_items.image_optimized_size IS 'Size of optimized image in bytes';
COMMENT ON COLUMN clothing_items.storage_type IS 'Storage method: database, s3, or hybrid';

-- Step 4: Update existing records to mark them as database storage
UPDATE clothing_items 
SET storage_type = 'database' 
WHERE image_data IS NOT NULL;

-- Step 5: Future migration - remove binary columns (run this later after migration)
-- WARNING: Only run these commands after all images are migrated to S3!
-- ALTER TABLE clothing_items DROP COLUMN image_data;
-- ALTER TABLE clothing_items DROP COLUMN image_mime_type;
-- ALTER TABLE clothing_items DROP COLUMN image_filename;

-- View to check migration progress
CREATE OR REPLACE VIEW migration_progress AS
SELECT 
    storage_type,
    COUNT(*) as item_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clothing_items), 2) as percentage
FROM clothing_items 
GROUP BY storage_type
ORDER BY item_count DESC;