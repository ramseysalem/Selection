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
  private apiKey: string;
  private baseUrl: string;
  private cache: Map<string, { data: WeatherData; expires: Date }> = new Map();

  constructor() {
    this.apiKey = process.env.MEASURE_SPACE_API_KEY || '';
    this.baseUrl = process.env.MEASURE_SPACE_API_URL || '';
    if (!this.apiKey || !this.baseUrl) {
      console.warn('⚠️ Measure Space API key or URL not found. Weather features will be limited.');
    }
  }

  async getWeatherByCoordinates(lat: number, lon: number): Promise<WeatherData> {
    if (!this.apiKey || !this.baseUrl) {
      throw new Error('Weather API key or URL not configured');
    }

    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid (15 minutes)
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    try {
      // Use measure_space API with required variables for weather
      const variables = 't2m,apparentT,r2,windSpeed,windDegree,tp,precipType,crain,csnow,sp,vis,tcc,weatherCode,timezone';
      
      const response = await fetch(
        `${this.baseUrl}?latitude=${lat}&longitude=${lon}&variables=${variables}&units=metric`,
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      const weatherData = this.parseMeasureSpaceResponse(data, lat, lon);

      // Cache for 15 minutes
      this.cache.set(cacheKey, {
        data: weatherData,
        expires: new Date(Date.now() + 15 * 60 * 1000)
      });

      return weatherData;
    } catch (error) {
      console.error('Weather fetch error:', error);
      throw error;
    }
  }

  async getWeatherByCity(cityName: string): Promise<WeatherData> {
    if (!this.apiKey || !this.baseUrl) {
      throw new Error('Weather API key or URL not configured');
    }

    const cacheKey = `city_${cityName.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    try {
      // First, get coordinates for the city using a free geocoding service
      const coords = await this.getCityCoordinates(cityName);
      
      // Then get weather for those coordinates
      const weatherData = await this.getWeatherByCoordinates(coords.lat, coords.lon);
      
      // Update location name with the searched city name
      weatherData.location.name = cityName;

      this.cache.set(cacheKey, {
        data: weatherData,
        expires: new Date(Date.now() + 15 * 60 * 1000)
      });

      return weatherData;
    } catch (error) {
      console.error('Weather fetch error:', error);
      throw error;
    }
  }

  private async getCityCoordinates(cityName: string): Promise<{ lat: number; lon: number }> {
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
      );

      if (!response.ok) {
        throw new Error(`City "${cityName}" not found`);
      }

      const data: any = await response.json();
      
      if (!data.results || data.results.length === 0) {
        throw new Error(`City "${cityName}" not found`);
      }

      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error(`City "${cityName}" not found`);
    }
  }

  private parseMeasureSpaceResponse(data: any, lat: number, lon: number): WeatherData {
    // Measure Space API returns objects with arrays for each variable
    // Extract first values from arrays for current conditions
    const getFirstValue = (field: any) => Array.isArray(field) ? field[0] : field;
    
    const temp = getFirstValue(data.t2m);
    const apparentTemp = getFirstValue(data.apparentT);
    
    // Convert temperature from Kelvin to Celsius if needed (API docs say metric units)
    const tempInCelsius = temp > 100 ? temp - 273.15 : temp;
    const feelsLikeInCelsius = apparentTemp > 100 ? apparentTemp - 273.15 : apparentTemp;
    
    // Map precipitation type to description
    const precipTypeMap = {
      0: 'clear',
      1: 'rain',
      2: 'snow',
      3: 'freezing rain',
      4: 'ice pellets'
    };
    
    const precipType = getFirstValue(data.precipType) || 0;
    const description = precipTypeMap[precipType as keyof typeof precipTypeMap] || 'partly cloudy';
    
    return {
      temperature: Math.round(tempInCelsius),
      feelsLike: Math.round(feelsLikeInCelsius),
      humidity: getFirstValue(data.r2) || 0,
      description: description,
      icon: this.getWeatherIcon(getFirstValue(data.weatherCode), precipType),
      windSpeed: getFirstValue(data.windSpeed) || 0,
      pressure: getFirstValue(data.sp) || 101325,
      visibility: getFirstValue(data.vis) ? getFirstValue(data.vis) / 1000 : 10, // Convert m to km
      location: {
        name: 'Current Location',
        country: 'Unknown',
        lat: lat,
        lon: lon,
      },
      timestamp: new Date()
    };
  }

  private getWeatherIcon(weatherCode: number, precipType: number): string {
    // Simple weather icon mapping based on precipitation type and weather code
    if (precipType === 1) return '10d'; // rain
    if (precipType === 2) return '13d'; // snow
    if (precipType === 3) return '13d'; // freezing rain
    if (precipType === 4) return '13d'; // ice pellets
    
    // Default based on weather code (you may want to expand this)
    return '01d'; // clear sky
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

  clearCache(): void {
    this.cache.clear();
  }
}

export const weatherService = new WeatherService();
export { WeatherData, Coordinates };