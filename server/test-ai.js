#!/usr/bin/env node

/**
 * AI Vision API Testing Script
 * 
 * This script helps test the OpenAI Vision API integration for clothing analysis.
 * Run with: node test-ai.js [image-path]
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const SERVER_URL = 'http://localhost:3000';

async function testAIStatus() {
  console.log('🔍 Testing AI service status...\n');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/ai-test/status`);
    const data = await response.json();
    
    console.log('📊 AI Service Status:');
    console.log(`   OpenAI Configured: ${data.openai_configured ? '✅' : '❌'}`);
    console.log(`   AI Vision Available: ${data.ai_vision_available ? '✅' : '❌'}`);
    console.log('\n📖 Available Test Endpoints:');
    Object.entries(data.endpoints).forEach(([name, endpoint]) => {
      console.log(`   ${name}: ${endpoint}`);
    });
    
    return data.openai_configured;
  } catch (error) {
    console.error('❌ Failed to check AI status:', error.message);
    return false;
  }
}

async function testImageAnalysis(imagePath) {
  console.log(`🖼️  Testing AI image analysis with: ${imagePath}\n`);
  
  if (!fs.existsSync(imagePath)) {
    console.error('❌ Image file not found:', imagePath);
    return;
  }
  
  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    
    const response = await fetch(`${SERVER_URL}/api/ai-test/analyze-image`, {
      method: 'POST',
      body: form
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ AI Analysis Successful!\n');
      console.log('📋 Results:');
      console.log(`   Category: ${data.analysis.category}`);
      console.log(`   Subcategory: ${data.analysis.subcategory || 'None'}`);
      console.log(`   Primary Color: ${data.analysis.color_primary}`);
      console.log(`   Secondary Color: ${data.analysis.color_secondary || 'None'}`);
      console.log(`   Material: ${data.analysis.material || 'Unknown'}`);
      console.log(`   Formality: ${data.analysis.formality}`);
      console.log(`   Seasons: ${data.analysis.season?.join(', ') || 'None'}`);
      console.log(`   Occasions: ${data.analysis.occasion?.join(', ') || 'None'}`);
      console.log(`   Description: ${data.analysis.description}`);
      console.log(`   Confidence: ${Math.round(data.analysis.confidence * 100)}%`);
      
      console.log('\n📊 Test Info:');
      console.log(`   File Size: ${data.test_info.file_size_kb}KB`);
      console.log(`   MIME Type: ${data.test_info.mime_type}`);
      console.log(`   OpenAI Available: ${data.test_info.openai_available ? '✅' : '❌'}`);
      
    } else {
      console.error('❌ AI Analysis Failed:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

function printUsage() {
  console.log(`
🤖 AI Vision API Testing Script

Usage:
  node test-ai.js                    # Check AI service status
  node test-ai.js [image-path]       # Test AI image analysis

Examples:
  node test-ai.js
  node test-ai.js ./test-shirt.jpg
  node test-ai.js ~/Downloads/pants.png

Requirements:
1. Server must be running on http://localhost:3000
2. OpenAI API key must be configured in server/.env:
   OPENAI_API_KEY=your_key_here
3. Image must be a valid image file (jpg, png, webp, etc.)

Test Images:
- Try with clear photos of individual clothing items
- Works best with good lighting and plain backgrounds
- Supports various formats: JPG, PNG, WebP, etc.
`);
}

async function main() {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    // Just check status if no image provided
    const aiAvailable = await testAIStatus();
    if (!aiAvailable) {
      console.log('\n⚠️  To enable AI features:');
      console.log('   1. Get an OpenAI API key from https://platform.openai.com');
      console.log('   2. Add it to server/.env: OPENAI_API_KEY=your_key_here');
      console.log('   3. Restart the server');
    }
    console.log('\n💡 Run with an image path to test AI vision:');
    console.log('   node test-ai.js ./my-shirt.jpg');
    return;
  }
  
  // Test with image
  const aiAvailable = await testAIStatus();
  if (!aiAvailable) {
    console.log('\n❌ OpenAI API key not configured. Please add OPENAI_API_KEY to server/.env');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  await testImageAnalysis(imagePath);
}

// Handle missing fetch in Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
  global.FormData = require('form-data');
}

main().catch(console.error);