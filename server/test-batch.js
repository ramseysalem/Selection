#!/usr/bin/env node

/**
 * Batch Processing Test Script
 * 
 * Tests the hybrid architecture batch processing system
 * Run with: node test-batch.js
 */

const SERVER_URL = 'http://localhost:3000';

async function loginAndGetToken() {
  console.log('🔑 Logging in to get auth token...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password123'
      })
    });
    
    const data = await response.json();
    if (data.accessToken) {
      console.log('✅ Successfully logged in');
      return data.accessToken;
    } else {
      throw new Error('No access token received');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return null;
  }
}

async function checkBatchStatus(token) {
  console.log('\n📊 Checking batch processing status...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/batch/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    console.log('📈 Batch Status:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Failed to check status:', error.message);
    return null;
  }
}

async function startBatchProcessing(token) {
  console.log('\n🚀 Starting batch processing...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/batch/process-wardrobe`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ batchSize: 3 })
    });
    
    const data = await response.json();
    console.log('🎉 Batch Processing Result:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Batch processing failed:', error.message);
    return null;
  }
}

async function main() {
  console.log('🧪 Testing Hybrid Architecture Batch Processing\n');
  
  // Step 1: Login and get token
  const token = await loginAndGetToken();
  if (!token) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Step 2: Check current status
  await checkBatchStatus(token);
  
  // Step 3: Start batch processing
  await startBatchProcessing(token);
  
  // Step 4: Check status again
  console.log('\n📊 Final status check...');
  await checkBatchStatus(token);
  
  console.log('\n✨ Batch processing test complete!');
  console.log('💡 Check your server logs for detailed AI analysis results');
}

// Handle missing fetch in Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

main().catch(console.error);