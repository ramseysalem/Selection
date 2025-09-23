export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: ClothingCategory;
  subcategory?: string;
  color_primary: string;
  color_secondary?: string;
  brand?: string;
  size?: string;
  material?: string;
  season: Season[];
  occasion: Occasion[];
  image_filename: string;
  image_mime_type: string;
  tags: string[];
  is_favorite: boolean;
  purchase_date?: string;
  purchase_price?: number;
  care_instructions?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export enum ClothingCategory {
  OUTERWEAR = 'outerwear',
  TOPS = 'tops', 
  BOTTOMS = 'bottoms',
  FOOTWEAR = 'footwear',
  ACCESSORIES = 'accessories'
}

export enum ClothingSubcategory {
  // Outerwear
  COATS = 'coats',
  JACKETS = 'jackets',
  BLAZERS = 'blazers',
  HOODIES = 'hoodies',
  SWEATERS = 'sweaters',
  CARDIGANS = 'cardigans',
  
  // Tops
  TEE_SHIRTS = 'tee_shirts',
  BUTTON_UPS = 'button_ups',
  POLO_SHIRTS = 'polo_shirts',
  TANK_TOPS = 'tank_tops',
  SWEATSHIRTS = 'sweatshirts',
  BLOUSES = 'blouses',
  
  // Bottoms
  JEANS = 'jeans',
  PANTS = 'pants',
  SHORTS = 'shorts',
  SKIRTS = 'skirts',
  LEGGINGS = 'leggings',
  DRESS_PANTS = 'dress_pants',
  
  // Footwear
  SNEAKERS = 'sneakers',
  DRESS_SHOES = 'dress_shoes',
  BOOTS = 'boots',
  SANDALS = 'sandals',
  HEELS = 'heels',
  FLATS = 'flats',
  
  // Accessories
  BELTS = 'belts',
  HATS = 'hats',
  BAGS = 'bags',
  JEWELRY = 'jewelry',
  SCARVES = 'scarves',
  WATCHES = 'watches'
}

export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  FALL = 'fall',
  WINTER = 'winter',
  ALL_SEASONS = 'all_seasons'
}

export enum Occasion {
  CASUAL = 'casual',
  BUSINESS = 'business',
  FORMAL = 'formal',
  ATHLETIC = 'athletic',
  PARTY = 'party',
  DATE = 'date',
  TRAVEL = 'travel',
  LOUNGEWEAR = 'loungewear'
}

export interface CategoryInfo {
  id: ClothingCategory;
  name: string;
  emoji: string;
  description: string;
  subcategories: { id: ClothingSubcategory; name: string; emoji: string }[];
}

export const CLOTHING_CATEGORIES: CategoryInfo[] = [
  {
    id: ClothingCategory.OUTERWEAR,
    name: 'Outerwear',
    emoji: '🧥',
    description: 'Jackets, coats, and outer layers',
    subcategories: [
      { id: ClothingSubcategory.COATS, name: 'Coats', emoji: '🧥' },
      { id: ClothingSubcategory.JACKETS, name: 'Jackets', emoji: '👕' },
      { id: ClothingSubcategory.BLAZERS, name: 'Blazers', emoji: '👔' },
      { id: ClothingSubcategory.HOODIES, name: 'Hoodies', emoji: '👕' },
      { id: ClothingSubcategory.SWEATERS, name: 'Sweaters', emoji: '👚' },
      { id: ClothingSubcategory.CARDIGANS, name: 'Cardigans', emoji: '👘' },
    ]
  },
  {
    id: ClothingCategory.TOPS,
    name: 'Tops',
    emoji: '👕',
    description: 'Shirts, t-shirts, and upper body clothing',
    subcategories: [
      { id: ClothingSubcategory.TEE_SHIRTS, name: 'T-Shirts', emoji: '👕' },
      { id: ClothingSubcategory.BUTTON_UPS, name: 'Button-ups', emoji: '👔' },
      { id: ClothingSubcategory.POLO_SHIRTS, name: 'Polo Shirts', emoji: '👕' },
      { id: ClothingSubcategory.TANK_TOPS, name: 'Tank Tops', emoji: '👚' },
      { id: ClothingSubcategory.SWEATSHIRTS, name: 'Sweatshirts', emoji: '👕' },
      { id: ClothingSubcategory.BLOUSES, name: 'Blouses', emoji: '👚' },
    ]
  },
  {
    id: ClothingCategory.BOTTOMS,
    name: 'Bottoms',
    emoji: '👖',
    description: 'Pants, jeans, shorts, and lower body clothing',
    subcategories: [
      { id: ClothingSubcategory.JEANS, name: 'Jeans', emoji: '👖' },
      { id: ClothingSubcategory.PANTS, name: 'Pants', emoji: '👖' },
      { id: ClothingSubcategory.SHORTS, name: 'Shorts', emoji: '🩳' },
      { id: ClothingSubcategory.SKIRTS, name: 'Skirts', emoji: '👗' },
      { id: ClothingSubcategory.LEGGINGS, name: 'Leggings', emoji: '👖' },
      { id: ClothingSubcategory.DRESS_PANTS, name: 'Dress Pants', emoji: '👔' },
    ]
  },
  {
    id: ClothingCategory.FOOTWEAR,
    name: 'Footwear',
    emoji: '👟',
    description: 'Shoes, boots, and foot accessories',
    subcategories: [
      { id: ClothingSubcategory.SNEAKERS, name: 'Sneakers', emoji: '👟' },
      { id: ClothingSubcategory.DRESS_SHOES, name: 'Dress Shoes', emoji: '👞' },
      { id: ClothingSubcategory.BOOTS, name: 'Boots', emoji: '👢' },
      { id: ClothingSubcategory.SANDALS, name: 'Sandals', emoji: '👡' },
      { id: ClothingSubcategory.HEELS, name: 'Heels', emoji: '👠' },
      { id: ClothingSubcategory.FLATS, name: 'Flats', emoji: '🥿' },
    ]
  },
  {
    id: ClothingCategory.ACCESSORIES,
    name: 'Accessories',
    emoji: '👜',
    description: 'Bags, jewelry, and fashion accessories',
    subcategories: [
      { id: ClothingSubcategory.BELTS, name: 'Belts', emoji: '👔' },
      { id: ClothingSubcategory.HATS, name: 'Hats', emoji: '👒' },
      { id: ClothingSubcategory.BAGS, name: 'Bags', emoji: '👜' },
      { id: ClothingSubcategory.JEWELRY, name: 'Jewelry', emoji: '💍' },
      { id: ClothingSubcategory.SCARVES, name: 'Scarves', emoji: '🧣' },
      { id: ClothingSubcategory.WATCHES, name: 'Watches', emoji: '⌚' },
    ]
  }
];