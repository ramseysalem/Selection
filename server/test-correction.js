#!/usr/bin/env node

/**
 * AI Correction Test Script
 * 
 * Test script to re-analyze incorrectly categorized items
 * Run with: node test-correction.js [item-id]
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

async function reanalyzeItem(token, itemId) {
  console.log(`\n🔄 Re-analyzing item ${itemId} with improved AI...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/ai-correction/reanalyze-item/${itemId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Re-analysis successful!');
      console.log('📊 New Analysis:');
      console.log(`   Color: ${data.analysis.color_primary}`);
      console.log(`   Formality: ${data.analysis.formality}`);
      console.log(`   Confidence: ${Math.round(data.analysis.confidence * 100)}%`);
      console.log(`   Description: ${data.analysis.description}`);
      return data;
    } else {
      throw new Error(data.error || 'Re-analysis failed');
    }
  } catch (error) {
    console.error('❌ Re-analysis failed:', error.message);
    return null;
  }
}

async function manualCorrection(token, itemId, corrections) {
  console.log(`\n✏️ Applying manual corrections to item ${itemId}...`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/ai-correction/correct-item/${itemId}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(corrections)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Manual correction successful!');
      console.log('📋 Applied corrections:', corrections);
      return data;
    } else {
      throw new Error(data.error || 'Manual correction failed');
    }
  } catch (error) {
    console.error('❌ Manual correction failed:', error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  console.log('🔧 AI Correction Testing Script\n');
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node test-correction.js reanalyze [item-id]    # Re-analyze with improved AI');
    console.log('  node test-correction.js correct [item-id]     # Apply manual corrections');
    console.log('\nExample:');
    console.log('  node test-correction.js reanalyze 123e4567-e89b-12d3-a456-426614174000');
    return;
  }
  
  const command = args[0];
  const itemId = args[1];
  
  if (!itemId) {
    console.log('❌ Please provide an item ID');
    return;
  }
  
  // Login and get token
  const token = await loginAndGetToken();
  if (!token) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  if (command === 'reanalyze') {
    await reanalyzeItem(token, itemId);
  } else if (command === 'correct') {
    // Example manual corrections for white button-up shirt
    const corrections = {
      color_primary: '#FFFFFF',
      formality: 'business',
      description: 'White button-up dress shirt, professional business attire',
      occasion: ['work', 'formal'],
      style_tags: ['business', 'professional', 'formal']
    };
    
    await manualCorrection(token, itemId, corrections);
  } else {
    console.log('❌ Unknown command. Use "reanalyze" or "correct"');
  }
  
  console.log('\n✨ Correction test complete!');
}

// Handle missing fetch in Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

main().catch(console.error);