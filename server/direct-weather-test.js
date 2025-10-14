#!/usr/bin/env node

/**
 * Direct Weather Service Test
 * 
 * Tests the weather service independently without requiring the full server
 */

const fetch = require('node-fetch');

// Simple weather service implementation for testing
class WeatherService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
    this.cache = new Map();
  }

  async getWeatherByCoordinates(lat, lon) {
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > new Date()) {
      console.log(`🌤️ [WEATHER] Using cached data for ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      return cached.data;
    }

    try {
      console.log(`🌤️ [WEATHER] Fetching weather for coordinates: ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      
      const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
      
      console.log(`🌤️ [WEATHER] API URL:`, url);
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🌤️ [WEATHER] API Error (${response.status}):`, errorText);
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        console.error(`🌤️ [WEATHER] Open-Meteo Error:`, data.reason);
        throw new Error(`Weather API error: ${data.reason}`);
      }
      
      console.log(`🌤️ [WEATHER] API Response:`, JSON.stringify(data, null, 2));
      
      const weatherData = this.parseOpenMeteoResponse(data);

      this.cache.set(cacheKey, {
        data: weatherData,
        expires: new Date(Date.now() + 15 * 60 * 1000)
      });

      console.log(`✅ [WEATHER] Successfully fetched: ${weatherData.temperature}°C, ${weatherData.description}`);
      return weatherData;
    } catch (error) {
      console.error('🌤️ [WEATHER] Fetch error:', error);
      throw error;
    }
  }

  async getWeatherByCity(cityName) {
    try {
      console.log(`🌤️ [WEATHER] Fetching weather for city: ${cityName}`);
      
      const coords = await this.getCityCoordinates(cityName);
      const weatherData = await this.getWeatherByCoordinates(coords.lat, coords.lon);
      
      weatherData.location.name = cityName;
      return weatherData;
    } catch (error) {
      console.error('🌤️ [WEATHER] City fetch error:', error);
      throw error;
    }
  }

  async getCityCoordinates(cityName) {
    try {
      console.log(`🌍 [GEOCODING] Looking up coordinates for: ${cityName}`);
      
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        throw new Error(`City "${cityName}" not found`);
      }

      const result = data.results[0];
      console.log(`✅ [GEOCODING] Found: ${result.name}, ${result.country} (${result.latitude}, ${result.longitude})`);

      return {
        lat: result.latitude,
        lon: result.longitude
      };
    } catch (error) {
      console.error('🌍 [GEOCODING] Error:', error);
      throw new Error(`City "${cityName}" not found`);
    }
  }

  parseOpenMeteoResponse(data) {
    const current = data.current || {};
    
    const weatherCode = current.weather_code || 0;
    const description = this.getWeatherDescription(weatherCode);
    const icon = this.getWeatherIcon(weatherCode);
    
    return {
      temperature: Math.round(current.temperature_2m || 0),
      feelsLike: Math.round(current.apparent_temperature || current.temperature_2m || 0),
      humidity: current.relative_humidity_2m || 0,
      description: description,
      icon: icon,
      windSpeed: current.wind_speed_10m || 0,
      pressure: current.pressure_msl || 1013,
      visibility: 10,
      uvIndex: current.uv_index,
      location: {
        name: 'Current Location',
        country: 'Unknown',
        lat: data.latitude || 0,
        lon: data.longitude || 0,
      },
      timestamp: new Date()
    };
  }

  getWeatherDescription(code) {
    const wmoDescriptions = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy', 
      3: 'overcast',
      45: 'fog',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      71: 'slight snow fall',
      73: 'moderate snow fall',
      75: 'heavy snow fall',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      85: 'slight snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorm',
      96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail'
    };
    
    return wmoDescriptions[code] || `weather code ${code}`;
  }

  getWeatherIcon(code) {
    if (code === 0 || code === 1) return '01d';
    if (code === 2) return '02d';
    if (code === 3) return '04d';
    if (code >= 45 && code <= 48) return '50d';
    if (code >= 51 && code <= 57) return '09d';
    if (code >= 61 && code <= 67) return '10d';
    if (code >= 71 && code <= 77) return '13d';
    if (code >= 80 && code <= 82) return '09d';
    if (code >= 85 && code <= 86) return '13d';
    if (code >= 95 && code <= 99) return '11d';
    
    return '01d';
  }

  getOutfitWeatherContext(weather) {
    const temp = weather.temperature;
    const humidity = weather.humidity;
    const isRainy = weather.description.toLowerCase().includes('rain') || 
                   weather.description.toLowerCase().includes('drizzle');

    let temperature, layers;

    if (temp >= 30) {
      temperature = 'hot';
      layers = 'none';
    } else if (temp >= 22) {
      temperature = 'warm';
      layers = 'light';
    } else if (temp >= 15) {
      temperature = 'mild';
      layers = 'light';
    } else if (temp >= 5) {
      temperature = 'cool';
      layers = 'medium';
    } else if (temp >= -5) {
      temperature = 'cold';
      layers = 'heavy';
    } else {
      temperature = 'freezing';
      layers = 'heavy';
    }

    return {
      temperature,
      layers,
      waterproof: isRainy,
      breathable: temp > 20 || humidity > 70
    };
  }
}

async function testWeatherService() {
  const weatherService = new WeatherService();
  const args = process.argv.slice(2);
  const cityName = args[0] || 'Boston';
  
  console.log('🌤️ Open-Meteo Weather API Testing\n');
  
  try {
    // Test weather by city
    console.log(`\n=== Testing Weather for City: ${cityName} ===`);
    const weatherData = await weatherService.getWeatherByCity(cityName);
    
    console.log('\n📊 Weather Data:');
    console.log(`   Location: ${weatherData.location.name}`);
    console.log(`   Temperature: ${weatherData.temperature}°F (feels like ${weatherData.feelsLike}°F)`);
    console.log(`   Description: ${weatherData.description}`);
    console.log(`   Humidity: ${weatherData.humidity}%`);
    console.log(`   Wind Speed: ${weatherData.windSpeed} mph`);
    console.log(`   Pressure: ${weatherData.pressure} hPa`);
    
    // Test outfit context
    const context = weatherService.getOutfitWeatherContext(weatherData);
    console.log('\n👔 Outfit Context:');
    console.log(`   Temperature Category: ${context.temperature}`);
    console.log(`   Layering: ${context.layers}`);
    console.log(`   Waterproof needed: ${context.waterproof}`);
    console.log(`   Breathable needed: ${context.breathable}`);
    
    // Test coordinates
    const lat = weatherData.location.lat;
    const lon = weatherData.location.lon;
    if (lat && lon) {
      console.log(`\n=== Testing Weather by Coordinates: ${lat}, ${lon} ===`);
      const coordWeather = await weatherService.getWeatherByCoordinates(lat, lon);
      console.log(`   Temperature: ${coordWeather.temperature}°F`);
      console.log(`   Description: ${coordWeather.description}`);
    }
    
    console.log('\n✅ Weather API Integration Test Complete!');
    console.log('\n📝 Open-Meteo Weather API Status:');
    console.log('✅ No API key required!');
    console.log('✅ 10,000 free requests per day');
    console.log('✅ Ready to use out of the box');
    console.log('🌐 More info: https://open-meteo.com/');
    
  } catch (error) {
    console.error('\n❌ Weather test failed:', error.message);
    process.exit(1);
  }
}

// Handle missing fetch in older Node.js versions
if (!global.fetch) {
  global.fetch = require('node-fetch');
}

testWeatherService().catch(console.error);