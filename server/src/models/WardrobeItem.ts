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
  image_data: Buffer; // Store image as binary data in PostgreSQL
  image_mime_type: string;
  image_filename: string;
  tags: string[];
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
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

// Simple in-memory storage for development
// TODO: Replace with PostgreSQL implementation
class WardrobeStore {
  private items: Map<string, WardrobeItem> = new Map();
  private userItems: Map<string, string[]> = new Map();

  async create(item: Omit<WardrobeItem, 'id' | 'created_at' | 'updated_at'>): Promise<WardrobeItem> {
    const newItem: WardrobeItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date(),
      updated_at: new Date()
    };

    this.items.set(newItem.id, newItem);
    
    // Add to user's items
    const userItemIds = this.userItems.get(item.user_id) || [];
    userItemIds.push(newItem.id);
    this.userItems.set(item.user_id, userItemIds);

    return newItem;
  }

  async findByUserId(userId: string): Promise<WardrobeItem[]> {
    const userItemIds = this.userItems.get(userId) || [];
    return userItemIds.map(id => this.items.get(id)!).filter(Boolean);
  }

  async findByUserIdAndCategory(userId: string, category: ClothingCategory): Promise<WardrobeItem[]> {
    const userItems = await this.findByUserId(userId);
    return userItems.filter(item => item.category === category);
  }

  async findById(id: string): Promise<WardrobeItem | null> {
    return this.items.get(id) || null;
  }

  async update(id: string, updates: Partial<WardrobeItem>): Promise<WardrobeItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const updatedItem = {
      ...item,
      ...updates,
      updated_at: new Date()
    };

    this.items.set(id, updatedItem);
    return updatedItem;
  }

  async delete(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    this.items.delete(id);
    
    // Remove from user's items
    const userItemIds = this.userItems.get(item.user_id) || [];
    const filteredIds = userItemIds.filter(itemId => itemId !== id);
    this.userItems.set(item.user_id, filteredIds);

    return true;
  }

  async getStatsByUserId(userId: string): Promise<Record<ClothingCategory, number>> {
    const userItems = await this.findByUserId(userId);
    const stats: Record<ClothingCategory, number> = {
      [ClothingCategory.OUTERWEAR]: 0,
      [ClothingCategory.TOPS]: 0,
      [ClothingCategory.BOTTOMS]: 0,
      [ClothingCategory.FOOTWEAR]: 0,
      [ClothingCategory.ACCESSORIES]: 0
    };

    userItems.forEach(item => {
      stats[item.category]++;
    });

    return stats;
  }
}

export const wardrobeStore = new WardrobeStore();