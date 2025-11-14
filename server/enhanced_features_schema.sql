-- Enhanced schema for wardrobe analytics and usage tracking

-- Add usage tracking columns to clothing_items
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS wear_count INTEGER DEFAULT 0;
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS last_worn_date TIMESTAMP;
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS size VARCHAR(20);
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE clothing_items ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'good'; -- excellent, good, fair, poor

-- Outfit wear history table for detailed analytics
CREATE TABLE IF NOT EXISTS outfit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES saved_outfits(id) ON DELETE SET NULL,
  items_worn JSONB NOT NULL, -- Array of item IDs worn together
  date_worn DATE NOT NULL DEFAULT CURRENT_DATE,
  occasion VARCHAR(100),
  weather_conditions JSONB,
  location VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wardrobe analytics and insights
CREATE TABLE IF NOT EXISTS wardrobe_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  analysis_date DATE DEFAULT CURRENT_DATE,
  total_items INTEGER,
  items_by_category JSONB,
  most_worn_items JSONB,
  least_worn_items JSONB,
  cost_per_wear JSONB,
  wardrobe_value DECIMAL(12,2),
  utilization_rate DECIMAL(5,2), -- Percentage of wardrobe actively used
  gaps_analysis JSONB, -- Missing categories or types
  suggestions JSONB, -- AI-generated recommendations
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Style preferences and learning
CREATE TABLE IF NOT EXISTS style_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preferred_colors TEXT[],
  preferred_styles TEXT[],
  preferred_brands TEXT[],
  preferred_materials TEXT[],
  body_type VARCHAR(50),
  style_goals TEXT[],
  budget_range VARCHAR(50),
  shopping_frequency VARCHAR(50),
  style_inspiration_ids TEXT[], -- References to public profiles they follow
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outfit sharing and social features
CREATE TABLE IF NOT EXISTS shared_outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  outfit_data JSONB NOT NULL, -- Complete outfit information
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  weather_context JSONB,
  occasion VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outfit likes and interactions
CREATE TABLE IF NOT EXISTS outfit_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_outfit_id UUID REFERENCES shared_outfits(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, shared_outfit_id)
);

-- User follow system for social features
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- Shopping wishlist and recommendations
CREATE TABLE IF NOT EXISTS shopping_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  desired_colors TEXT[],
  desired_materials TEXT[],
  max_price DECIMAL(10,2),
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  notes TEXT,
  is_purchased BOOLEAN DEFAULT FALSE,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wardrobe goals and achievements
CREATE TABLE IF NOT EXISTS wardrobe_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  goal_type VARCHAR(100) NOT NULL, -- cost_per_wear, utilization_rate, item_limit
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  deadline DATE,
  is_achieved BOOLEAN DEFAULT FALSE,
  achieved_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clothing_items_user_category ON clothing_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_clothing_items_wear_count ON clothing_items(user_id, wear_count DESC);
CREATE INDEX IF NOT EXISTS idx_clothing_items_last_worn ON clothing_items(user_id, last_worn_date DESC);
CREATE INDEX IF NOT EXISTS idx_outfit_history_user_date ON outfit_history(user_id, date_worn DESC);
CREATE INDEX IF NOT EXISTS idx_shared_outfits_public ON shared_outfits(is_public, created_at DESC) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_shared_outfits_user ON shared_outfits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id, created_at DESC);