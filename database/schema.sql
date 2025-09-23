-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create enums
CREATE TYPE clothing_category AS ENUM (
  'shirt', 'pants', 'dress', 'jacket', 'shoes', 'accessory', 'shorts'
);

CREATE TYPE occasion_type AS ENUM (
  'general', 'work', 'late_night', 'relaxed', 'creative', 'formal', 'athletic'
);

CREATE TYPE rule_type AS ENUM (
  'color_combo', 'style_mix', 'never_together'
);

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  style_preferences JSONB,
  location GEOGRAPHY(Point),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create clothing_items table
CREATE TABLE clothing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  color_primary VARCHAR(7) NOT NULL,
  color_secondary VARCHAR(7),
  brand VARCHAR(100),
  size VARCHAR(20),
  material VARCHAR(100),
  season VARCHAR[] DEFAULT '{}',
  occasion VARCHAR[] DEFAULT '{}',
  tags VARCHAR[] DEFAULT '{}',
  image_data BYTEA NOT NULL,
  image_mime_type VARCHAR(50) NOT NULL,
  image_filename VARCHAR(255) NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  care_instructions TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create outfits table
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  occasion_type occasion_type NOT NULL,
  weather_temp_min INTEGER,
  weather_temp_max INTEGER,
  weather_conditions VARCHAR[] DEFAULT '{}',
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  worn_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create outfit_items junction table
CREATE TABLE outfit_items (
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
  PRIMARY KEY (outfit_id, clothing_item_id)
);

-- Create style_rules table
CREATE TABLE style_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rule_type rule_type NOT NULL,
  item1_attributes JSONB NOT NULL,
  item2_attributes JSONB NOT NULL,
  confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create weather_outfit_log table
CREATE TABLE weather_outfit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
  temperature INTEGER NOT NULL,
  humidity INTEGER NOT NULL,
  weather_condition VARCHAR(50) NOT NULL,
  user_comfort_rating INTEGER CHECK (user_comfort_rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_outfits_user_id ON outfits(user_id);
CREATE INDEX idx_style_rules_user_id ON style_rules(user_id);
CREATE INDEX idx_weather_outfit_log_user_id ON weather_outfit_log(user_id);
