import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// AWS S3 Configuration
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    // AWS Configuration from environment variables
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'outfit-matcher-images';
    
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    console.log(`🪣 [S3] Initialized S3 service for bucket: ${this.bucketName} in region: ${this.region}`);
  }

  /**
   * Upload image to S3 with automatic optimization
   * @param buffer Image buffer from multer
   * @param filename Original filename
   * @param mimeType Image mime type
   * @param userId User ID for organizing files
   * @returns Object with S3 URL and metadata
   */
  async uploadImage(buffer: Buffer, filename: string, mimeType: string, userId: string): Promise<{
    url: string;
    key: string;
    originalName: string;
    optimizedSize: number;
    thumbnailUrl?: string;
  }> {
    try {
      // Generate unique filename
      const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const uniqueKey = `users/${userId}/images/${uuidv4()}.${fileExtension}`;
      const thumbnailKey = `users/${userId}/thumbnails/${uuidv4()}.${fileExtension}`;

      // Optimize main image using Sharp
      const optimizedBuffer = await this.optimizeImage(buffer);
      console.log(`📸 [S3] Optimized image: ${buffer.length} bytes → ${optimizedBuffer.length} bytes (${Math.round((1 - optimizedBuffer.length/buffer.length) * 100)}% reduction)`);

      // Create thumbnail (300x300 max)
      const thumbnailBuffer = await this.createThumbnail(buffer);
      console.log(`🖼️ [S3] Created thumbnail: ${thumbnailBuffer.length} bytes`);

      // Upload main image to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: uniqueKey,
        Body: optimizedBuffer,
        ContentType: mimeType,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          'original-name': filename,
          'user-id': userId,
          'upload-date': new Date().toISOString()
        }
      });

      await this.s3Client.send(uploadCommand);
      console.log(`✅ [S3] Uploaded main image: ${uniqueKey}`);

      // Upload thumbnail to S3
      const thumbnailCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: mimeType,
        CacheControl: 'max-age=31536000',
        Metadata: {
          'original-name': `thumb_${filename}`,
          'user-id': userId,
          'upload-date': new Date().toISOString()
        }
      });

      await this.s3Client.send(thumbnailCommand);
      console.log(`✅ [S3] Uploaded thumbnail: ${thumbnailKey}`);

      // Generate public URLs (assuming bucket is configured for public read)
      const imageUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${uniqueKey}`;
      const thumbnailUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${thumbnailKey}`;

      return {
        url: imageUrl,
        key: uniqueKey,
        originalName: filename,
        optimizedSize: optimizedBuffer.length,
        thumbnailUrl: thumbnailUrl
      };

    } catch (error) {
      console.error('❌ [S3] Upload failed:', error);
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a signed URL for secure access to private images
   * @param key S3 object key
   * @param expiresIn Expiration time in seconds (default: 1 hour)
   * @returns Signed URL
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      // For now, just return the public URL since we'll configure public read
      // In production, you might want proper signed URLs for security
      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      console.log(`🔗 [S3] Generated URL for: ${key}`);
      return url;
    } catch (error) {
      console.error('❌ [S3] Failed to generate URL:', error);
      throw new Error(`Failed to generate URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete image from S3
   * @param key S3 object key
   */
  async deleteImage(key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(deleteCommand);
      console.log(`🗑️ [S3] Deleted image: ${key}`);
    } catch (error) {
      console.error('❌ [S3] Delete failed:', error);
      throw new Error(`S3 delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimize image using Sharp
   * - Resize large images to max 1920x1920
   * - Compress JPEG to 85% quality
   * - Convert to WebP for better compression (optional)
   */
  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .resize(1920, 1920, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85,
        progressive: true 
      })
      .toBuffer();
  }

  /**
   * Create thumbnail image
   * - Resize to 300x300 max
   * - Maintain aspect ratio
   * - Optimize for web
   */
  private async createThumbnail(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .resize(300, 300, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .jpeg({ 
        quality: 80,
        progressive: true 
      })
      .toBuffer();
  }

  /**
   * Validate S3 configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.AWS_ACCESS_KEY_ID) {
      errors.push('AWS_ACCESS_KEY_ID is missing');
    }

    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      errors.push('AWS_SECRET_ACCESS_KEY is missing');
    }

    if (!process.env.AWS_S3_BUCKET_NAME) {
      errors.push('AWS_S3_BUCKET_NAME is missing');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const s3Service = new S3Service();