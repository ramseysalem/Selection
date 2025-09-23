-- Add AI-enhanced columns to clothing_items table for hybrid architecture
ALTER TABLE clothing_items 
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ai_style_tags TEXT[],
ADD COLUMN IF NOT EXISTS ai_formality_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_color_palette TEXT[],
ADD COLUMN IF NOT EXISTS ai_material_properties TEXT[],
ADD COLUMN IF NOT EXISTS ai_description TEXT,
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP;

-- Create index for faster querying of unanalyzed items
CREATE INDEX IF NOT EXISTS idx_clothing_items_ai_analyzed ON clothing_items(ai_analyzed);

-- Update existing items to have ai_analyzed = false
UPDATE clothing_items SET ai_analyzed = FALSE WHERE ai_analyzed IS NULL;