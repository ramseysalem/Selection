#!/usr/bin/env node

/**
 * Complete Migration Script: Database Images → S3
 * This script migrates all clothing items with images from PostgreSQL to AWS S3
 */

require('dotenv').config();
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Or use individual parameters if DATABASE_URL is not set:
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'outfit_matcher',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'outfit-matcher-images';
const REGION = process.env.AWS_REGION || 'us-east-1';

// Stats tracking
let stats = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Optimize image using Sharp
 */
async function optimizeImage(buffer) {
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
 */
async function createThumbnail(buffer) {
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
 * Upload image to S3
 */
async function uploadToS3(buffer, filename, mimeType, userId) {
  const fileExtension = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const uniqueKey = `users/${userId}/images/${uuidv4()}.${fileExtension}`;
  const thumbnailKey = `users/${userId}/thumbnails/${uuidv4()}.${fileExtension}`;

  try {
    // Optimize main image
    const optimizedBuffer = await optimizeImage(buffer);
    console.log(`  📸 Optimized: ${buffer.length} → ${optimizedBuffer.length} bytes`);

    // Create thumbnail
    const thumbnailBuffer = await createThumbnail(buffer);
    console.log(`  🖼️  Thumbnail: ${thumbnailBuffer.length} bytes`);

    // Upload main image
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueKey,
      Body: optimizedBuffer,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
      Metadata: {
        'original-name': filename,
        'user-id': userId,
        'upload-date': new Date().toISOString()
      }
    }));
    console.log(`  ✅ Main image uploaded: ${uniqueKey}`);

    // Upload thumbnail
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: mimeType,
      CacheControl: 'max-age=31536000',
      Metadata: {
        'original-name': `thumb_${filename}`,
        'user-id': userId,
        'upload-date': new Date().toISOString()
      }
    }));
    console.log(`  ✅ Thumbnail uploaded: ${thumbnailKey}`);

    const imageUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${uniqueKey}`;
    const thumbnailUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${thumbnailKey}`;

    return {
      imageUrl,
      thumbnailUrl,
      s3Key: uniqueKey,
      thumbnailS3Key: thumbnailKey,
      optimizedSize: optimizedBuffer.length
    };
  } catch (error) {
    console.error(`  ❌ S3 upload failed:`, error.message);
    throw error;
  }
}

/**
 * Migrate a single item
 */
async function migrateItem(item) {
  const { id, user_id, image_data, image_filename, image_mime_type } = item;

  try {
    if (!image_data) {
      console.log(`⏭️  Skipping ${id}: No image data`);
      stats.skipped++;
      return;
    }

    console.log(`\n📦 Migrating: ${image_filename} (${image_data.length} bytes)`);

    // Upload to S3
    const s3Result = await uploadToS3(
      image_data,
      image_filename || 'migrated_image.jpg',
      image_mime_type || 'image/jpeg',
      user_id
    );

    // Update database with S3 URLs
    await pool.query(`
      UPDATE clothing_items
      SET
        image_url = $1,
        image_s3_key = $2,
        thumbnail_url = $3,
        image_optimized_size = $4,
        storage_type = 's3',
        image_data = NULL
      WHERE id = $5
    `, [
      s3Result.imageUrl,
      s3Result.s3Key,
      s3Result.thumbnailUrl,
      s3Result.optimizedSize,
      id
    ]);

    console.log(`✅ Database updated for ${id}`);
    stats.successful++;
  } catch (error) {
    console.error(`❌ Migration failed for ${id}:`, error.message);
    stats.errors.push({ itemId: id, error: error.message });
    stats.failed++;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting complete S3 migration...\n');
  console.log(`📋 Configuration:`);
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Region: ${REGION}`);
  console.log(`   Database: ${process.env.DB_NAME || 'outfit_matcher'}\n`);

  try {
    // Get all items with image data
    const result = await pool.query(`
      SELECT id, user_id, image_data, image_filename, image_mime_type, storage_type
      FROM clothing_items
      WHERE image_data IS NOT NULL
      ORDER BY created_at ASC
    `);

    stats.total = result.rows.length;
    console.log(`📊 Found ${stats.total} items with database images\n`);

    if (stats.total === 0) {
      console.log('✅ No items to migrate - all already on S3 or no images!');
      await pool.end();
      process.exit(0);
    }

    // Migrate each item
    for (const item of result.rows) {
      stats.processed++;
      console.log(`[${stats.processed}/${stats.total}]`);
      await migrateItem(item);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total items:     ${stats.total}`);
    console.log(`Processed:       ${stats.processed}`);
    console.log(`Successful:      ${stats.successful} ✅`);
    console.log(`Failed:          ${stats.failed} ❌`);
    console.log(`Skipped:         ${stats.skipped} ⏭️`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. Item ${err.itemId}: ${err.error}`);
      });
    }

    if (stats.successful === stats.total) {
      console.log('\n🎉 Migration complete! All images are now on S3.');
      console.log('\n📝 Next steps:');
      console.log('   1. Verify all images display correctly in the app');
      console.log('   2. Update .env: STORAGE_TYPE=s3');
      console.log('   3. Remove database image storage code (optional)');
    } else {
      console.log('\n⚠️  Some items failed. Please check errors above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrate().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
