import { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import pool from '../db/connection';

export enum OutfitOccasion {
  CASUAL = 'casual',
  BUSINESS = 'business',
  FORMAL = 'formal',
  PARTY = 'party',
  DATE = 'date',
  SPORTS = 'sports',
  TRAVEL = 'travel',
  WEEKEND = 'weekend'
}

export interface SavedOutfit {
  id: string;
  user_id: string;
  name: string;
  top_item_id: string;
  bottom_item_id: string;
  occasion: OutfitOccasion;
  weather_temp?: number;
  weather_description?: string;
  notes?: string;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

const createSavedOutfitSchema = z.object({
  name: z.string().min(1).max(100),
  top_item_id: z.string().uuid(),
  bottom_item_id: z.string().uuid(),
  occasion: z.nativeEnum(OutfitOccasion),
  weather_temp: z.number().optional(),
  weather_description: z.string().optional(),
  notes: z.string().max(500).optional(),
  is_favorite: z.boolean().default(false)
});

class SavedOutfitStore {
  private async getClient(): Promise<PoolClient> {
    return await pool.connect();
  }

  async initializeTables(): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS saved_outfits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          top_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
          bottom_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
          occasion VARCHAR(20) NOT NULL CHECK (occasion IN ('casual', 'business', 'formal', 'party', 'date', 'sports', 'travel', 'weekend')),
          weather_temp INTEGER,
          weather_description TEXT,
          notes TEXT CHECK (LENGTH(notes) <= 500),
          is_favorite BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_saved_outfits_user_id ON saved_outfits(user_id);
        CREATE INDEX IF NOT EXISTS idx_saved_outfits_occasion ON saved_outfits(occasion);
        CREATE INDEX IF NOT EXISTS idx_saved_outfits_created_at ON saved_outfits(created_at DESC);
      `);

      console.log('✅ Saved outfits table initialized');
    } catch (error) {
      console.error('❌ Error initializing saved outfits table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async create(data: z.infer<typeof createSavedOutfitSchema> & { user_id: string }): Promise<SavedOutfit> {
    const validatedData = createSavedOutfitSchema.parse(data);
    const client = await this.getClient();

    try {
      const result = await client.query(
        `INSERT INTO saved_outfits (user_id, name, top_item_id, bottom_item_id, occasion, weather_temp, weather_description, notes, is_favorite)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.user_id,
          validatedData.name,
          validatedData.top_item_id,
          validatedData.bottom_item_id,
          validatedData.occasion,
          validatedData.weather_temp || null,
          validatedData.weather_description || null,
          validatedData.notes || null,
          validatedData.is_favorite
        ]
      );

      return result.rows[0] as SavedOutfit;
    } catch (error) {
      console.error('Error creating saved outfit:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string): Promise<SavedOutfit[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM saved_outfits WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows as SavedOutfit[];
    } catch (error) {
      console.error('Error finding saved outfits by user ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserIdAndOccasion(userId: string, occasion: OutfitOccasion): Promise<SavedOutfit[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM saved_outfits WHERE user_id = $1 AND occasion = $2 ORDER BY created_at DESC`,
        [userId, occasion]
      );
      return result.rows as SavedOutfit[];
    } catch (error) {
      console.error('Error finding saved outfits by occasion:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<SavedOutfit | null> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT * FROM saved_outfits WHERE id = $1`,
        [id]
      );
      return result.rows[0] as SavedOutfit || null;
    } catch (error) {
      console.error('Error finding saved outfit by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<Omit<SavedOutfit, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<SavedOutfit | null> {
    const client = await this.getClient();
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      
      if (fields.length === 0) return null;

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      
      const result = await client.query(
        `UPDATE saved_outfits SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, ...values]
      );

      return result.rows[0] as SavedOutfit || null;
    } catch (error) {
      console.error('Error updating saved outfit:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `DELETE FROM saved_outfits WHERE id = $1`,
        [id]
      );
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting saved outfit:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStatsByUserId(userId: string): Promise<Record<OutfitOccasion, number>> {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `SELECT occasion, COUNT(*) as count 
         FROM saved_outfits 
         WHERE user_id = $1 
         GROUP BY occasion`,
        [userId]
      );

      const stats: Record<OutfitOccasion, number> = {
        [OutfitOccasion.CASUAL]: 0,
        [OutfitOccasion.BUSINESS]: 0,
        [OutfitOccasion.FORMAL]: 0,
        [OutfitOccasion.PARTY]: 0,
        [OutfitOccasion.DATE]: 0,
        [OutfitOccasion.SPORTS]: 0,
        [OutfitOccasion.TRAVEL]: 0,
        [OutfitOccasion.WEEKEND]: 0
      };

      result.rows.forEach(row => {
        stats[row.occasion as OutfitOccasion] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      console.error('Error getting saved outfit stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const savedOutfitStore = new SavedOutfitStore();
export { createSavedOutfitSchema };