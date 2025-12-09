interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  pressure: number;
  visibility: number;
  uvIndex?: number;
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  timestamp: Date;
}

interface Coordinates {
  lat: number;
  lon: number;
}

class WeatherService {
  private baseUrl: string;
  private cache: Map<string, { data: WeatherData; expires: Date }> = new Map();

  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
    console.log('🌤️ [WEATHER] Using Open-Meteo API (no API key required)');
  }

  async getWeatherByCoordinates(lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid (15 minutes)
    if (cached && cached.expires > new Date()) {
      console.log(`🌤️ [WEATHER] Using cached data for ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      return cached.data;
    }

    try {
      console.log(`🌤️ [WEATHER] Fetching weather for coordinates: ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      
      // Open-Meteo API call with current weather and daily forecast
      const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
      
      console.log(`🌤️ [WEATHER] API URL:`, url);
      
      // Retry logic for flaky connections
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🌤️ [WEATHER] Attempt ${attempt}/3...`);
          const response = await fetch(url, {
            signal: AbortSignal.timeout(20000), // 20 second timeout
            headers: {
              'User-Agent': 'OutfitMatcher/1.0 (https://outfitmatcher.app)'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`🌤️ [WEATHER] API Error (${response.status}):`, errorText);
            throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          
          // Check for API errors
          if ((data as any).error) {
            console.error(`🌤️ [WEATHER] Open-Meteo Error:`, (data as any).reason);
            throw new Error(`Weather API error: ${(data as any).reason}`);
          }
          
          console.log(`🌤️ [WEATHER] API Response received successfully`);
          
          const weatherData = this.parseOpenMeteoResponse(data);

          // Cache for 15 minutes
          this.cache.set(cacheKey, {
            data: weatherData,
            expires: new Date(Date.now() + 15 * 60 * 1000)
          });

          console.log(`✅ [WEATHER] Successfully fetched: ${weatherData.temperature}°F, ${weatherData.description}`);
          return weatherData;

        } catch (error) {
          lastError = error;
          console.warn(`🌤️ [WEATHER] Attempt ${attempt}/3 failed:`, error instanceof Error ? error.message : String(error));
          
          if (attempt < 3) {
            const delay = attempt * 1000; // 1s, 2s delay between retries
            console.log(`🌤️ [WEATHER] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All attempts failed
      console.error('🌤️ [WEATHER] All retry attempts failed:', lastError);
      throw lastError;
    } catch (error) {
      console.error('🌤️ [WEATHER] Unexpected error:', error);
      throw error;
    }
  }

  async getWeatherByCity(cityName: string): Promise<WeatherData> {
    const cacheKey = `city_${cityName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > new Date()) {
      console.log(`🌤️ [WEATHER] Using cached data for city: ${cityName}`);
      return cached.data;
    }

    try {
      console.log(`🌤️ [WEATHER] Fetching weather for city: ${cityName}`);
      
      // First, get coordinates for the city using Open-Meteo's geocoding service
      const coords = await this.getCityCoordinates(cityName);
      
      // Then get weather for those coordinates
      const weatherData = await this.getWeatherByCoordinates(coords.lat, coords.lon);
      
      // Update location name with the searched city name
      weatherData.location.name = cityName;

      this.cache.set(cacheKey, {
        data: weatherData,
        expires: new Date(Date.now() + 15 * 60 * 1000)
      });

      console.log(`✅ [WEATHER] Successfully fetched for ${cityName}: ${weatherData.temperature}°F, ${weatherData.description}`);
      return weatherData;
    } catch (error) {
      console.error('🌤️ [WEATHER] City fetch error:', error);
      throw error;
    }
  }

  private async getCityCoordinates(cityName: string): Promise<{ lat: number; lon: number }> {
    try {
      console.log(`🌍 [GEOCODING] Looking up coordinates for: ${cityName}`);
      
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`,
        {
          signal: AbortSignal.timeout(15000), // 15 second timeout for geocoding
          headers: {
            'User-Agent': 'OutfitMatcher/1.0 (https://outfitmatcher.app)'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
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

  private parseOpenMeteoResponse(data: any): WeatherData {
    // Open-Meteo API response structure
    const current = data.current || {};
    const daily = data.daily || {};
    
    // Get weather description from WMO code
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
      visibility: 10, // Open-Meteo doesn't provide visibility in basic plan
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

  /**
   * Convert WMO weather codes to human-readable descriptions
   * Based on WMO standard codes from Open-Meteo documentation
   */
  private getWeatherDescription(code: number): string {
    const wmoDescriptions: Record<number, string> = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy', 
      3: 'overcast',
      45: 'fog',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      56: 'light freezing drizzle',
      57: 'dense freezing drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      66: 'light freezing rain',
      67: 'heavy freezing rain',
      71: 'slight snow fall',
      73: 'moderate snow fall',
      75: 'heavy snow fall',
      77: 'snow grains',
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

  /**
   * Convert WMO weather codes to weather icons
   * Using simplified icon mapping similar to OpenWeatherMap format
   */
  private getWeatherIcon(code: number): string {
    if (code === 0 || code === 1) return '01d'; // clear/mainly clear
    if (code === 2) return '02d'; // partly cloudy
    if (code === 3) return '04d'; // overcast
    if (code === 45 || code === 48) return '50d'; // fog
    if (code >= 51 && code <= 57) return '09d'; // drizzle
    if (code >= 61 && code <= 67) return '10d'; // rain
    if (code >= 71 && code <= 77) return '13d'; // snow
    if (code >= 80 && code <= 82) return '09d'; // rain showers
    if (code >= 85 && code <= 86) return '13d'; // snow showers
    if (code >= 95 && code <= 99) return '11d'; // thunderstorm
    
    return '01d'; // default to clear
  }

  getOutfitWeatherContext(weather: WeatherData): {
    temperature: 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'freezing';
    layers: 'none' | 'light' | 'medium' | 'heavy';
    waterproof: boolean;
    breathable: boolean;
  } {
    const temp = weather.temperature;
    const humidity = weather.humidity;
    const isRainy = weather.description.toLowerCase().includes('rain') || 
                   weather.description.toLowerCase().includes('drizzle');

    let temperature: 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'freezing';
    let layers: 'none' | 'light' | 'medium' | 'heavy';

    if (temp >= 86) {      // 30°C = 86°F
      temperature = 'hot';
      layers = 'none';
    } else if (temp >= 72) {  // 22°C = 72°F
      temperature = 'warm';
      layers = 'light';
    } else if (temp >= 59) {  // 15°C = 59°F
      temperature = 'mild';
      layers = 'light';
    } else if (temp >= 41) {  // 5°C = 41°F
      temperature = 'cool';
      layers = 'medium';
    } else if (temp >= 23) {  // -5°C = 23°F
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
      breathable: temp > 68 || humidity > 70  // 20°C = 68°F
    };
  }

  /**
   * Get hourly weather forecast for outfit planning
   * @param lat Latitude
   * @param lon Longitude  
   * @param hours Number of hours to forecast (1-24)
   */
  async getHourlyForecast(lat: number, lon: number, hours: number = 12): Promise<any> {
    try {
      console.log(`🌤️ [WEATHER] Fetching ${hours}h hourly forecast for ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      
      const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_hours=${Math.min(hours, 24)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if ((data as any).error) {
        throw new Error(`Weather API error: ${(data as any).reason}`);
      }
      
      return data;
    } catch (error) {
      console.error('🌤️ [WEATHER] Hourly forecast error:', error);
      throw error;
    }
  }

  /**
   * Get daily weather forecast for outfit planning
   * @param lat Latitude
   * @param lon Longitude
   * @param days Number of days to forecast (1-7)  
   */
  async getDailyForecast(lat: number, lon: number, days: number = 7): Promise<any> {
    try {
      console.log(`🌤️ [WEATHER] Fetching ${days}d daily forecast for ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
      
      const url = `${this.baseUrl}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch&forecast_days=${Math.min(days, 7)}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if ((data as any).error) {
        throw new Error(`Weather API error: ${(data as any).reason}`);
      }
      
      return data;
    } catch (error) {
      console.error('🌤️ [WEATHER] Daily forecast error:', error);
      throw error;
    }
  }

  /**
   * Check if it's appropriate weather for specific clothing types
   */
  getClothingWeatherAdvice(weather: WeatherData): {
    shorts: boolean;
    longPants: boolean;
    shortSleeves: boolean;
    longSleeves: boolean;
    jacket: boolean;
    heavyCoat: boolean;
    umbrella: boolean;
    sunglasses: boolean;
  } {
    const temp = weather.temperature;
    const desc = weather.description.toLowerCase();
    const isRainy = desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower');
    const isSunny = desc.includes('clear') || desc.includes('sunny');
    
    return {
      shorts: temp >= 68,        // 20°C = 68°F
      longPants: temp <= 77,     // 25°C = 77°F
      shortSleeves: temp >= 64,  // 18°C = 64°F
      longSleeves: temp <= 72,   // 22°C = 72°F
      jacket: temp <= 59,        // 15°C = 59°F
      heavyCoat: temp <= 41,     // 5°C = 41°F
      umbrella: isRainy,
      sunglasses: isSunny && temp >= 59  // 15°C = 59°F
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const weatherService = new WeatherService();
export { WeatherData, Coordinates };