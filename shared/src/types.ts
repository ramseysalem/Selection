export type ClothingCategory = 
  | 'shirt'
  | 'pants'
  | 'dress'
  | 'jacket'
  | 'shoes'
  | 'accessory';

export type OccasionType = 
  | 'general'
  | 'work'
  | 'late_night'
  | 'relaxed'
  | 'creative'
  | 'formal'
  | 'athletic';

export type RuleType = 
  | 'color_combo'
  | 'style_mix'
  | 'never_together';

export interface User {
  id: string;
  email: string;
  stylePreferences?: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
}

export interface ClothingItem {
  id: string;
  userId: string;
  category: ClothingCategory;
  subcategory?: string;
  colorPrimary: string;
  colorSecondary?: string;
  pattern?: string;
  material: string[];
  styleTags: string[];
  warmthRating: number;
  formalityLevel: number;
  imageUrl: string;
  thumbnailUrl: string;
  aiDescription?: string;
  brand?: string;
  purchaseDate?: Date;
  lastWorn?: Date;
  wearCount: number;
  inLaundry: boolean;
  createdAt: Date;
}

export interface Outfit {
  id: string;
  userId: string;
  name?: string;
  occasionType: OccasionType;
  weatherTempMin?: number;
  weatherTempMax?: number;
  weatherConditions: string[];
  rating?: number;
  wornDate?: Date;
  createdAt: Date;
  items?: ClothingItem[];
}

export interface StyleRule {
  id: string;
  userId: string;
  ruleType: RuleType;
  item1Attributes: Record<string, unknown>;
  item2Attributes: Record<string, unknown>;
  confidenceScore: number;
  createdAt: Date;
}

export interface WeatherOutfitLog {
  id: string;
  userId: string;
  outfitId: string;
  temperature: number;
  humidity: number;
  weatherCondition: string;
  userComfortRating: number;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Weather Profile Types
export interface WeatherProfile {
  colors: string[];
  avoidColors?: string[];
  materials: string[];
  avoidItems?: string[];
  suggestItems: string[];
  requireItems?: string[];
}
