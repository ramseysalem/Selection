// List all S3 buckets to verify credentials
require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function listBuckets() {
  console.log('🔍 Listing all S3 buckets to test credentials...');
  
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    const command = new ListBucketsCommand({});
    const result = await s3Client.send(command);
    
    console.log('✅ SUCCESS: Credentials work!');
    console.log('\n📦 Your S3 Buckets:');
    
    if (result.Buckets.length === 0) {
      console.log('   (No buckets found)');
    } else {
      result.Buckets.forEach((bucket, index) => {
        console.log(`   ${index + 1}. ${bucket.Name}`);
      });
    }
    
    // Check if target bucket exists
    const targetBucket = process.env.AWS_S3_BUCKET_NAME;
    const bucketExists = result.Buckets.some(bucket => bucket.Name === targetBucket);
    
    console.log(`\n🎯 Looking for bucket: "${targetBucket}"`);
    if (bucketExists) {
      console.log('✅ Target bucket found!');
    } else {
      console.log('❌ Target bucket NOT found in your account');
      console.log('💡 This explains the "NoSuchBucket" error');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.name);
    console.log('📝 Details:', error.message);
    console.log('\n💡 This suggests credential or permission issues');
  }
}

listBuckets();