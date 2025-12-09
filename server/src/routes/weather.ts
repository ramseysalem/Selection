import express from 'express';
import { z } from 'zod';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { weatherService } from '../services/weatherService';

const router = express.Router();

// Debug middleware to see all requests
router.use((req, res, next) => {
  console.log(`🌐 [WEATHER_DEBUG] Incoming request: ${req.method} ${req.path} with query:`, req.query);
  next();
});

// Validation schemas
const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180)
});

const citySchema = z.object({
  city: z.string().min(1).max(100)
});

// Get weather by coordinates
router.get('/coordinates', async (req: AuthRequest, res) => {
  try {
    const { lat, lon } = coordinatesSchema.parse({
      lat: parseFloat(req.query.lat as string),
      lon: parseFloat(req.query.lon as string)
    });

    const weather = await weatherService.getWeatherByCoordinates(lat, lon);
    const context = weatherService.getOutfitWeatherContext(weather);

    res.json({
      weather,
      outfitContext: context
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid coordinates', 
        details: error.errors 
      });
    }

    console.error('Weather coordinates error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Weather service unavailable'
    });
  }
});

// Get weather by city name
router.get('/city', async (req: AuthRequest, res) => {
  try {
    console.log(`🔍 [WEATHER_REQUEST] User requested weather for: "${req.query.city}"`);
    const { city } = citySchema.parse(req.query);

    const weather = await weatherService.getWeatherByCity(city);
    const context = weatherService.getOutfitWeatherContext(weather);

    console.log(`📊 [WEATHER_RESULT] ${city}: ${weather.temperature}°F, ${context.temperature} (${context.layers} layers)`);

    res.json({
      weather,
      outfitContext: context
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid city name', 
        details: error.errors 
      });
    }

    console.error('Weather city error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Weather service unavailable'
    });
  }
});

// Clear weather cache (admin endpoint)
router.delete('/cache', (req: AuthRequest, res) => {
  weatherService.clearCache();
  res.json({ message: 'Weather cache cleared' });
});

export default router;