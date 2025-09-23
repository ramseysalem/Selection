import pool from '../db/connection';

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
  image_data: Buffer;
  image_mime_type: string;
  image_filename: string;
  tags: string[];
  is_favorite: boolean;
  purchase_date?: string;
  purchase_price?: number;
  care_instructions?: string;
  notes?: string;
  // AI-Enhanced Attributes for Hybrid Architecture
  ai_analyzed: boolean;
  ai_confidence?: number;
  ai_style_tags?: string[];
  ai_formality_score?: number;  // 1-10 scale
  ai_color_palette?: string[];  // All detected colors
  ai_material_properties?: string[];  // breathable, warm, waterproof, etc.
  ai_description?: string;
  ai_analyzed_at?: Date;
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

// PostgreSQL-based wardrobe storage
class WardrobeStore {
  async create(item: Omit<WardrobeItem, 'id' | 'created_at' | 'updated_at'>): Promise<WardrobeItem> {
    const query = `
      INSERT INTO clothing_items (
        user_id, name, category, subcategory, color_primary, color_secondary, 
        brand, size, material, season, occasion, image_data, image_mime_type, 
        image_filename, tags, is_favorite, purchase_date, purchase_price, 
        care_instructions, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `;

    const values = [
      item.user_id,
      item.name,
      item.category,
      item.subcategory || null,
      item.color_primary,
      item.color_secondary || null,
      item.brand || null,
      item.size || null,
      item.material || null,
      item.season,
      item.occasion,
      item.image_data,
      item.image_mime_type,
      item.image_filename,
      item.tags,
      item.is_favorite || false,
      item.purchase_date || null,
      item.purchase_price || null,
      item.care_instructions || null,
      item.notes || null
    ];

    const result = await pool.query(query, values);
    return this.mapRowToItem(result.rows[0]);
  }

  async findByUserId(userId: string): Promise<WardrobeItem[]> {
    const query = 'SELECT * FROM clothing_items WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => this.mapRowToItem(row));
  }

  async findByUserIdAndCategory(userId: string, category: ClothingCategory): Promise<WardrobeItem[]> {
    const query = 'SELECT * FROM clothing_items WHERE user_id = $1 AND category = $2 ORDER BY created_at DESC';
    const result = await pool.query(query, [userId, category]);
    return result.rows.map(row => this.mapRowToItem(row));
  }

  async findById(id: string): Promise<WardrobeItem | null> {
    const query = 'SELECT * FROM clothing_items WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToItem(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<WardrobeItem>): Promise<WardrobeItem | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        setParts.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setParts.length === 0) {
      return this.findById(id);
    }

    setParts.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE clothing_items 
      SET ${setParts.join(', ')} 
      WHERE id = $${paramCount + 1} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows.length > 0 ? this.mapRowToItem(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM clothing_items WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount! > 0;
  }

  async getStatsByUserId(userId: string): Promise<Record<ClothingCategory, number>> {
    const query = `
      SELECT category, COUNT(*) as count 
      FROM clothing_items 
      WHERE user_id = $1 
      GROUP BY category
    `;
    const result = await pool.query(query, [userId]);

    const stats: Record<ClothingCategory, number> = {
      [ClothingCategory.OUTERWEAR]: 0,
      [ClothingCategory.TOPS]: 0,
      [ClothingCategory.BOTTOMS]: 0,
      [ClothingCategory.FOOTWEAR]: 0,
      [ClothingCategory.ACCESSORIES]: 0
    };

    result.rows.forEach(row => {
      stats[row.category as ClothingCategory] = parseInt(row.count);
    });

    return stats;
  }

  private mapRowToItem(row: any): WardrobeItem {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      color_primary: row.color_primary,
      color_secondary: row.color_secondary,
      brand: row.brand,
      size: row.size,
      material: row.material,
      season: row.season || [],
      occasion: row.occasion || [],
      image_data: row.image_data,
      image_mime_type: row.image_mime_type,
      image_filename: row.image_filename,
      tags: row.tags || [],
      is_favorite: row.is_favorite || false,
      purchase_date: row.purchase_date,
      purchase_price: row.purchase_price ? parseFloat(row.purchase_price) : undefined,
      care_instructions: row.care_instructions,
      notes: row.notes,
      ai_analyzed: row.ai_analyzed || false,
      ai_confidence: row.ai_confidence,
      ai_style_tags: row.ai_style_tags || [],
      ai_formality_score: row.ai_formality_score,
      ai_color_palette: row.ai_color_palette || [],
      ai_material_properties: row.ai_material_properties || [],
      ai_description: row.ai_description,
      ai_analyzed_at: row.ai_analyzed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async findUnanalyzedByUserId(userId: string): Promise<WardrobeItem[]> {
    const result = await pool.query(
      `SELECT * FROM clothing_items 
       WHERE user_id = $1 AND (ai_analyzed = false OR ai_analyzed IS NULL)
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(row => this.mapRowToItem(row));
  }

  async updateAIAttributes(id: string, attributes: Partial<WardrobeItem>): Promise<boolean> {
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(attributes)) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }

    if (updateFields.length === 0) return false;

    values.push(id); // Add id as last parameter
    
    const query = `
      UPDATE clothing_items 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
    `;

    const result = await pool.query(query, values);
    return result.rowCount! > 0;
  }
}

export const wardrobeStore = new WardrobeStore();