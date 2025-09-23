import { z } from 'zod';

// User validation schema
export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  stylePreferences: z.record(z.unknown()).optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

// Clothing item validation schema
export const clothingItemSchema = z.object({
  category: z.enum(['shirt', 'pants', 'dress', 'jacket', 'shoes', 'accessory']),
  subcategory: z.string().optional(),
  colorPrimary: z.string().regex(/^#[0-9A-F]{6}$/i),
  colorSecondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  pattern: z.string().optional(),
  material: z.array(z.string()),
  styleTags: z.array(z.string()),
  warmthRating: z.number().int().min(1).max(5),
  formalityLevel: z.number().int().min(1).max(5),
  brand: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
});

// Outfit validation schema
export const outfitSchema = z.object({
  name: z.string().optional(),
  occasionType: z.enum([
    'general',
    'work',
    'late_night',
    'relaxed',
    'creative',
    'formal',
    'athletic'
  ]),
  weatherTempMin: z.number().optional(),
  weatherTempMax: z.number().optional(),
  weatherConditions: z.array(z.string()),
  items: z.array(z.string()), // Array of clothing item IDs
});

// Style rule validation schema
export const styleRuleSchema = z.object({
  ruleType: z.enum(['color_combo', 'style_mix', 'never_together']),
  item1Attributes: z.record(z.unknown()),
  item2Attributes: z.record(z.unknown()),
  confidenceScore: z.number().min(0).max(1),
});

// Weather log validation schema
export const weatherLogSchema = z.object({
  temperature: z.number(),
  humidity: z.number(),
  weatherCondition: z.string(),
  userComfortRating: z.number().int().min(1).max(5),
});
