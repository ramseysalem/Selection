// Simple S3 connection test
require('dotenv').config();
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

async function testS3Connection() {
  console.log('🧪 Testing S3 connection...');
  console.log('📋 Configuration:');
  console.log(`  Region: ${process.env.AWS_REGION}`);
  console.log(`  Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
  console.log(`  Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
  
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    // Test if bucket exists and we can access it
    console.log('\n🔍 Testing bucket access...');
    const command = new HeadBucketCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME
    });
    
    await s3Client.send(command);
    console.log('✅ SUCCESS: Bucket exists and credentials work!');
    console.log(`✅ Bucket "${process.env.AWS_S3_BUCKET_NAME}" in region "${process.env.AWS_REGION}" is accessible`);
    
  } catch (error) {
    console.log('❌ ERROR:', error.name);
    console.log('📝 Details:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Verify bucket name is correct');
      console.log('   - Verify bucket is in the correct region');
      console.log('   - Check AWS console to confirm bucket location');
    } else if (error.name === 'AccessDenied' || error.name === 'Forbidden') {
      console.log('\n💡 Troubleshooting:');
      console.log('   - Check if Access Key ID and Secret are correct');
      console.log('   - Verify IAM user has S3 permissions');
      console.log('   - Check if bucket policy blocks access');
    }
  }
}

testS3Connection();