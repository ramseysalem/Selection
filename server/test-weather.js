#!/usr/bin/env node

/**
 * Weather API Test Script
 * 
 * Test script to verify OpenWeatherMap API integration
 * Run with: node test-weather.js [city-name]
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

async function testWeatherByCity(token, cityName) {
  console.log(`\n🌤️ Testing weather for city: ${cityName}`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/weather/city?city=${encodeURIComponent(cityName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (response.ok && data.weather) {
      console.log('✅ Weather API Success!');
      console.log('📊 Weather Data:');
      console.log(`   Location: ${data.weather.location.name}, ${data.weather.location.country}`);
      console.log(`   Temperature: ${data.weather.temperature}°C (feels like ${data.weather.feelsLike}°C)`);
      console.log(`   Description: ${data.weather.description}`);
      console.log(`   Humidity: ${data.weather.humidity}%`);
      console.log(`   Wind Speed: ${data.weather.windSpeed} m/s`);
      
      console.log('\n👔 Outfit Context:');
      console.log(`   Temperature Category: ${data.outfitContext.temperature}`);
      console.log(`   Layering: ${data.outfitContext.layers}`);
      console.log(`   Waterproof needed: ${data.outfitContext.waterproof}`);
      console.log(`   Breathable needed: ${data.outfitContext.breathable}`);
      
      return data;
    } else {
      console.error('❌ Weather API Error:', data.error || response.statusText);
      return null;
    }
  } catch (error) {
    console.error('❌ Weather test failed:', error.message);
    return null;
  }
}

async function testWeatherByCoordinates(token, lat, lon) {
  console.log(`\n🌤️ Testing weather for coordinates: ${lat}, ${lon}`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/weather/coordinates?lat=${lat}&lon=${lon}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (response.ok && data.weather) {
      console.log('✅ Coordinates Weather API Success!');
      console.log(`   Temperature: ${data.weather.temperature}°C`);
      console.log(`   Description: ${data.weather.description}`);
      return data;
    } else {
      console.error('❌ Coordinates Weather API Error:', data.error || response.statusText);
      return null;
    }
  } catch (error) {
    console.error('❌ Coordinates weather test failed:', error.message);
    return null;
  }
}

async function testOutfitWithWeather(token, weather) {
  console.log('\n👔 Testing outfit recommendations with weather...');
  
  try {
    const response = await fetch(`${SERVER_URL}/api/wardrobe/recommendations`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        occasion: 'work',
        weather: {
          temperature: weather.temperature,
          description: weather.description
        }
      })
    });
    
    const data = await response.json();
    
    if (data.recommendations) {
      console.log('✅ Weather-aware outfit recommendations success!');
      console.log(`   Generated ${data.recommendations.length} recommendations`);
      
      if (data.weather_context) {
        console.log('🌤️ Weather Context:');
        console.log(`   ${data.weather_context.temperature}°C - ${data.weather_context.description}`);
        console.log(`   Suggestion: ${data.weather_context.suggestion}`);
      }
      
      data.recommendations.forEach((rec, i) => {
        console.log(`\n   Outfit ${i + 1} (${Math.round(rec.confidence * 100)}% confidence):`);
        console.log(`   Top: ${rec.top.name} (${rec.top.color_primary})`);
        console.log(`   Bottom: ${rec.bottom.name} (${rec.bottom.color_primary})`);
        console.log(`   Reasoning: ${rec.reasoning}`);
      });
      
      return data;
    } else {
      console.error('❌ Outfit recommendations failed:', data.error || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.error('❌ Outfit with weather test failed:', error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const cityName = args[0] || 'Boston';
  
  console.log('🌤️ Weather API Testing Script\n');
  
  // Login and get token
  const token = await loginAndGetToken();
  if (!token) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Test weather by city
  const weatherData = await testWeatherByCity(token, cityName);
  
  if (weatherData) {
    // Test coordinates
    const lat = weatherData.weather.location.lat;
    const lon = weatherData.weather.location.lon;
    if (lat && lon) {
      await testWeatherByCoordinates(token, lat, lon);
    }
    
    // Test outfit recommendations with weather
    await testOutfitWithWeather(token, weatherData.weather);
  }
  
  console.log('\n✨ Weather API testing complete!');
  console.log('\n📝 Open-Meteo Weather API:');
  console.log('✅ No API key required!');
  console.log('✅ 10,000 free requests per day');
  console.log('✅ Ready to use out of the box');
  console.log('🌐 More info: https://open-meteo.com/');
}

// Handle missing fetch in Node.js
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

main().catch(console.error);