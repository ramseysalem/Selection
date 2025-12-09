import { s3Service } from './s3Service';
import pool from '../db/connection';

export interface ImageUploadResult {
  url: string;
  thumbnailUrl?: string;
  storageType: 'database' | 's3';
  size: number;
  s3Key?: string;
}

export class ImageStorageService {
  private storageType: 'database' | 's3' | 'hybrid';

  constructor() {
    this.storageType = (process.env.STORAGE_TYPE as 'database' | 's3' | 'hybrid') || 'database';
    console.log(`📁 [STORAGE] Image storage type: ${this.storageType}`);
  }

  /**
   * Upload image to S3 only (database storage deprecated)
   * @param buffer Image buffer from multer
   * @param filename Original filename
   * @param mimeType Image mime type
   * @param userId User ID for organizing files
   * @returns Upload result with URLs and metadata
   */
  async uploadImage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string
  ): Promise<ImageUploadResult> {
    try {
      // All new uploads go to S3
      console.log('☁️ [STORAGE] Using S3 storage (database storage deprecated)');
      return await this.uploadToS3(buffer, filename, mimeType, userId);
    } catch (error) {
      console.error('❌ [STORAGE] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload image to S3
   */
  private async uploadToS3(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string
  ): Promise<ImageUploadResult> {
    const s3Result = await s3Service.uploadImage(buffer, filename, mimeType, userId);
    
    return {
      url: s3Result.url,
      thumbnailUrl: s3Result.thumbnailUrl,
      storageType: 's3',
      size: s3Result.optimizedSize,
      s3Key: s3Result.key
    };
  }

  /**
   * Upload image to database (legacy method)
   */
  private async uploadToDatabase(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    userId: string
  ): Promise<ImageUploadResult> {
    // For database storage, we need to generate a URL that points to our API
    const baseUrl = process.env.FRONTEND_URL?.replace(':5173', ':3000') || 'http://localhost:3000';
    
    return {
      url: `${baseUrl}/api/wardrobe/placeholder/image`, // This will be replaced with actual item ID
      storageType: 'database',
      size: buffer.length
    };
  }

  /**
   * Get image URL for a wardrobe item
   * Handles both S3 and database storage
   */
  getImageUrl(item: any): string {
    if (item.storage_type === 's3' && item.image_url) {
      return item.image_url;
    }
    
    // Database storage - construct API endpoint URL
    const baseUrl = process.env.FRONTEND_URL?.replace(':5173', ':3000') || 'http://localhost:3000';
    return `${baseUrl}/api/wardrobe/${item.id}/image`;
  }

  /**
   * Get thumbnail URL for a wardrobe item
   */
  getThumbnailUrl(item: any): string | undefined {
    if (item.storage_type === 's3' && item.thumbnail_url) {
      return item.thumbnail_url;
    }
    
    // For database storage, thumbnails are not supported yet
    return undefined;
  }

  /**
   * Delete image from storage
   */
  async deleteImage(item: any): Promise<void> {
    try {
      if (item.storage_type === 's3' && item.image_s3_key) {
        console.log('🗑️ [STORAGE] Deleting from S3');
        await s3Service.deleteImage(item.image_s3_key);
        
        // Also delete thumbnail if it exists
        if (item.thumbnail_s3_key) {
          await s3Service.deleteImage(item.thumbnail_s3_key);
        }
      } else {
        console.log('🗑️ [STORAGE] Database image will be deleted with record');
        // Database images are deleted automatically when the record is deleted
      }
    } catch (error) {
      console.error('❌ [STORAGE] Delete failed:', error);
      throw error;
    }
  }

  /**
   * Migrate an existing database image to S3
   */
  async migrateToS3(itemId: string): Promise<boolean> {
    try {
      // Get the item with image data
      const result = await pool.query(
        'SELECT id, user_id, image_data, image_filename, image_mime_type FROM clothing_items WHERE id = $1 AND image_data IS NOT NULL',
        [itemId]
      );

      if (result.rows.length === 0) {
        console.log(`⚠️ [MIGRATION] Item ${itemId} not found or has no image data`);
        return false;
      }

      const item = result.rows[0];
      
      // Upload to S3
      const s3Result = await s3Service.uploadImage(
        item.image_data,
        item.image_filename || 'migrated_image.jpg',
        item.image_mime_type || 'image/jpeg',
        item.user_id
      );

      // Update database record
      await pool.query(`
        UPDATE clothing_items 
        SET image_url = $1, 
            image_s3_key = $2, 
            thumbnail_url = $3,
            image_optimized_size = $4,
            storage_type = 's3'
        WHERE id = $5
      `, [
        s3Result.url,
        s3Result.key,
        s3Result.thumbnailUrl,
        s3Result.optimizedSize,
        itemId
      ]);

      console.log(`✅ [MIGRATION] Successfully migrated item ${itemId} to S3`);
      return true;

    } catch (error) {
      console.error(`❌ [MIGRATION] Failed to migrate item ${itemId}:`, error);
      return false;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    total: number;
    database: number;
    s3: number;
    percentage: number;
  }> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN storage_type = 'database' OR storage_type IS NULL THEN 1 ELSE 0 END) as database,
        SUM(CASE WHEN storage_type = 's3' THEN 1 ELSE 0 END) as s3
      FROM clothing_items
    `);

    const row = result.rows[0];
    const total = parseInt(row.total);
    const database = parseInt(row.database);
    const s3 = parseInt(row.s3);

    return {
      total,
      database,
      s3,
      percentage: total > 0 ? Math.round((s3 / total) * 100) : 0
    };
  }
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();