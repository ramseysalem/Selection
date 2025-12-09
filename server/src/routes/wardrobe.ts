import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { wardrobeStore, ClothingCategory, ClothingSubcategory, Season, Occasion } from '../models/WardrobeItemPG';
import { aiVisionService } from '../services/aiVisionService';
import { hybridOutfitMatcher } from '../services/hybridOutfitMatcher';
import { imageStorageService } from '../services/imageStorageService';

const router = express.Router();

// Configure multer for file uploads (store in memory for now)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Validation schemas
const createWardrobeItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.nativeEnum(ClothingCategory).optional(), // Made optional for AI analysis
  subcategory: z.nativeEnum(ClothingSubcategory).optional(),
  color_primary: z.string().min(1).optional(), // Made optional for AI analysis
  color_secondary: z.string().optional(),
  brand: z.string().optional(),
  size: z.string().optional(),
  material: z.string().optional(),
  season: z.array(z.nativeEnum(Season)).default([Season.ALL_SEASONS]),
  occasion: z.array(z.nativeEnum(Occasion)).default([Occasion.CASUAL]),
  tags: z.array(z.string()).default([]),
  is_favorite: z.boolean().default(false)
});

const updateWardrobeItemSchema = createWardrobeItemSchema.partial();

// Get wardrobe item image (public endpoint - redirects to S3)
router.get('/:id/image', async (req, res) => {
  try {
    const item = await wardrobeStore.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Wardrobe item not found' });
    }

    // All images are now on S3 - redirect to the S3 URL
    if (item.image_url) {
      console.log(`🔗 [IMAGE] Redirecting to S3: ${item.image_url}`);
      return res.redirect(item.image_url);
    }

    // No image found
    return res.status(404).json({ error: 'Image not found' });

  } catch (error) {
    console.error('Get wardrobe item image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply authentication to all other routes
router.use(verifyToken);

// Get all wardrobe items for user
router.get('/', async (req: AuthRequest, res) => {
  try {
    const items = await wardrobeStore.findByUserId(req.user!.id);
    res.json({ items });
  } catch (error) {
    console.error('Get wardrobe items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get wardrobe items by category
router.get('/category/:category', async (req: AuthRequest, res) => {
  try {
    const category = req.params.category as ClothingCategory;
    
    if (!Object.values(ClothingCategory).includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const items = await wardrobeStore.findByUserIdAndCategory(req.user!.id, category);
    res.json({ items });
  } catch (error) {
    console.error('Get wardrobe items by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get wardrobe statistics
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const stats = await wardrobeStore.getStatsByUserId(req.user!.id);
    const totalItems = Object.values(stats).reduce((sum, count) => sum + count, 0);
    
    res.json({ 
      stats,
      totalItems,
      categories: Object.keys(ClothingCategory),
      subcategories: Object.keys(ClothingSubcategory)
    });
  } catch (error) {
    console.error('Get wardrobe stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new wardrobe item with photo upload and AI analysis
router.post('/items', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    console.log('📤 [UPLOAD] Processing item upload:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Parse user input with enhanced metadata
    const userInput = {
      name: req.body.name || req.file.originalname.replace(/\.[^/.]+$/, ""),
      category: req.body.category || 'tops',
      brand: req.body.brand,
      size: req.body.size,
      cost: req.body.cost ? parseFloat(req.body.cost) : undefined,
      purchaseDate: req.body.purchaseDate,
      tags: req.body.tags ? JSON.parse(req.body.tags) : []
    };
    
    try {
      // Use AI to analyze the image
      console.log('🤖 Analyzing image with AI...');
      const aiAnalysis = await aiVisionService.analyzeClothingImage(req.file.buffer, req.file.mimetype);
      
      // Combine AI analysis with user input (user input takes precedence if provided)
      const itemData = {
        name: userInput.name,
        category: userInput.category,
        color_primary: aiAnalysis?.color_primary || '#000000',
        color_secondary: aiAnalysis?.color_secondary,
        material: aiAnalysis?.material,
        season: aiAnalysis?.season || [Season.ALL_SEASONS],
        occasion: aiAnalysis?.occasion || [Occasion.CASUAL],
        tags: [
          ...userInput.tags,
          ...(aiAnalysis ? [`ai-analyzed`, `confidence-${Math.round(aiAnalysis.confidence * 100)}%`] : []),
          ...(aiAnalysis ? [aiAnalysis.formality] : [])
        ],
        is_favorite: false,
        brand: userInput.brand,
        size: userInput.size,
        cost: userInput.cost,
        purchase_date: userInput.purchaseDate ? new Date(userInput.purchaseDate) : null,
        notes: aiAnalysis ? 
          `AI Analysis: ${aiAnalysis.description} (Formality: ${aiAnalysis.formality}, Confidence: ${Math.round(aiAnalysis.confidence * 100)}%)` 
          : 'Added via bulk upload'
      };

      console.log('✅ AI Analysis complete:', {
        confidence: aiAnalysis.confidence,
        category: aiAnalysis.category,
        colors: { primary: aiAnalysis.color_primary, secondary: aiAnalysis.color_secondary }
      });

      // Ensure required fields are present after AI analysis
      if (!itemData.category) {
        itemData.category = ClothingCategory.TOPS; // Default fallback
        console.warn('⚠️ AI did not provide category, using default: TOPS');
      }
      if (!itemData.color_primary) {
        itemData.color_primary = '#000000'; // Default fallback
        console.warn('⚠️ AI did not provide color_primary, using default: #000000');
      }

      // Validate the combined data
      const validatedData = createWardrobeItemSchema.parse(itemData);

      // Upload image using the storage service
      console.log('📁 [STORAGE] Uploading image...');
      const imageResult = await imageStorageService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );

      console.log(`✅ [STORAGE] Image uploaded via ${imageResult.storageType}`);

      const newItem = await wardrobeStore.create({
        ...validatedData,
        category: validatedData.category!, // TypeScript assertion - we ensured this exists above
        color_primary: validatedData.color_primary!, // TypeScript assertion - we ensured this exists above
        user_id: req.user!.id,
        // S3 storage only (no database storage)
        image_url: imageResult.url,
        image_s3_key: imageResult.s3Key,
        thumbnail_url: imageResult.thumbnailUrl,
        image_optimized_size: imageResult.size,
        storage_type: 's3',
        // Initialize AI fields (will be populated by batch processing)
        ai_analyzed: false,
        ai_confidence: undefined,
        ai_style_tags: [],
        ai_formality_score: undefined,
        ai_color_palette: [],
        ai_material_properties: [],
        ai_description: undefined,
        ai_analyzed_at: undefined
      });

      // Return item without image data for response
      const { image_data, ...itemResponse } = newItem;
      
      res.status(201).json({ 
        message: 'Wardrobe item created successfully with AI analysis', 
        item: itemResponse,
        ai_analysis: {
          confidence: aiAnalysis.confidence,
          auto_detected: {
            category: aiAnalysis.category,
            color_primary: aiAnalysis.color_primary,
            color_secondary: aiAnalysis.color_secondary,
            formality: aiAnalysis.formality
          }
        }
      });

    } catch (aiError) {
      console.warn('⚠️ AI analysis failed, falling back to manual input:', aiError);

      // Create fallback data structure when AI fails
      const fallbackData = {
        ...userInput,
        color_primary: '#000000', // Default fallback color
        season: [Season.ALL_SEASONS],
        occasion: [Occasion.CASUAL]
      };

      // Ensure required fields are present for bulk uploads when AI fails
      if (!fallbackData.category) {
        fallbackData.category = ClothingCategory.TOPS; // Default fallback
        console.warn('⚠️ No category provided in manual input, using default: TOPS');
      }

      // Fallback to manual input if AI fails
      const validatedData = createWardrobeItemSchema.parse(fallbackData);

      // Still upload image to S3 even if AI fails
      console.log('📁 [STORAGE] Uploading image to S3 (AI failed)...');
      const imageResult = await imageStorageService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );

      const newItem = await wardrobeStore.create({
        ...validatedData,
        category: validatedData.category!, // TypeScript assertion - we ensured this exists above
        color_primary: validatedData.color_primary!, // TypeScript assertion - we ensured this exists above
        user_id: req.user!.id,
        // S3 storage only
        image_url: imageResult.url,
        image_s3_key: imageResult.s3Key,
        thumbnail_url: imageResult.thumbnailUrl,
        image_optimized_size: imageResult.size,
        storage_type: 's3',
        // Initialize AI fields (will be populated by batch processing)
        ai_analyzed: false,
        ai_confidence: undefined,
        ai_style_tags: [],
        ai_formality_score: undefined,
        ai_color_palette: [],
        ai_material_properties: [],
        ai_description: undefined,
        ai_analyzed_at: undefined
      });

      // Return item without image data for response
      const { image_data, ...itemResponse } = newItem;

      res.status(201).json({
        message: 'Wardrobe item created successfully (manual input)',
        item: itemResponse,
        ai_analysis: {
          error: 'AI analysis unavailable',
          used_manual_input: true
        }
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Create wardrobe item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single wardrobe item
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const item = await wardrobeStore.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Wardrobe item not found' });
    }

    if (item.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return item without image data for response
    const { image_data, ...itemResponse } = item;
    res.json({ item: itemResponse });
  } catch (error) {
    console.error('Get wardrobe item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update wardrobe item
router.put('/:id', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    const item = await wardrobeStore.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Wardrobe item not found' });
    }

    if (item.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Handle both JSON body and FormData with nested JSON string
    let updateData = {};
    if (req.body.data) {
      // FormData: data is sent as a stringified JSON
      try {
        updateData = JSON.parse(req.body.data);
      } catch (parseError) {
        console.error('Failed to parse req.body.data:', parseError);
        return res.status(400).json({ error: 'Invalid JSON in data field' });
      }
    } else if (Object.keys(req.body).length > 0) {
      // Direct JSON body (without file upload)
      updateData = req.body;
    }

    const validatedData = updateWardrobeItemSchema.parse(updateData);

    const updates: any = { ...validatedData };

    // If new image is uploaded, upload to S3
    if (req.file) {
      console.log('📁 [STORAGE] Uploading updated image to S3...');
      const imageResult = await imageStorageService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );

      updates.image_url = imageResult.url;
      updates.image_s3_key = imageResult.s3Key;
      updates.thumbnail_url = imageResult.thumbnailUrl;
      updates.image_optimized_size = imageResult.size;
      updates.storage_type = 's3';
    }

    const updatedItem = await wardrobeStore.update(req.params.id, updates);
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Failed to update item' });
    }

    // Return item without image data for response
    const { image_data, ...itemResponse } = updatedItem;
    res.json({ 
      message: 'Wardrobe item updated successfully', 
      item: itemResponse 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }

    console.error('Update wardrobe item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete wardrobe item
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const item = await wardrobeStore.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Wardrobe item not found' });
    }

    if (item.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete image from S3 if it exists
    if (item.storage_type === 's3' && item.image_s3_key) {
      try {
        console.log(`🗑️ [S3] Deleting image from S3: ${item.image_s3_key}`);
        await imageStorageService.deleteImage(item);
      } catch (s3Error) {
        console.warn(`⚠️ [S3] Failed to delete from S3, continuing with DB delete:`, s3Error);
        // Don't fail the whole operation if S3 delete fails
      }
    }

    // Delete from database
    const deleted = await wardrobeStore.delete(req.params.id);

    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    res.json({ message: 'Wardrobe item and associated images deleted successfully' });
  } catch (error) {
    console.error('Delete wardrobe item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-powered outfit recommendations
router.post('/recommendations', async (req: AuthRequest, res) => {
  try {
    const { weather, occasion, userPreferences, location } = req.body;
    
    console.log('🎯 [RECOMMENDATIONS] Request received:', { weather, occasion, location });
    
    // Get all user's wardrobe items
    const items = await wardrobeStore.findByUserId(req.user!.id);
    
    if (items.length === 0) {
      return res.json({ 
        recommendations: [],
        message: 'No wardrobe items available for recommendations'
      });
    }

    // If location is provided but no weather, try to fetch current weather
    let weatherData = weather;
    if (!weatherData && location) {
      try {
        const { weatherService } = await import('../services/weatherService');
        if (location.lat && location.lon) {
          console.log('🌤️ [RECOMMENDATIONS] Fetching weather by coordinates');
          const currentWeather = await weatherService.getWeatherByCoordinates(location.lat, location.lon);
          weatherData = {
            temperature: currentWeather.temperature,
            description: currentWeather.description,
            humidity: currentWeather.humidity,
            windSpeed: currentWeather.windSpeed
          };
          console.log(`🌤️ [RECOMMENDATIONS] Current weather: ${weatherData.temperature}°C, ${weatherData.description}`);
        } else if (location.city) {
          console.log(`🌤️ [RECOMMENDATIONS] Fetching weather for city: ${location.city}`);
          const currentWeather = await weatherService.getWeatherByCity(location.city);
          weatherData = {
            temperature: currentWeather.temperature,
            description: currentWeather.description,
            humidity: currentWeather.humidity,
            windSpeed: currentWeather.windSpeed
          };
          console.log(`🌤️ [RECOMMENDATIONS] Current weather: ${weatherData.temperature}°C, ${weatherData.description}`);
        }
      } catch (weatherError) {
        console.warn('⚠️ [RECOMMENDATIONS] Failed to fetch weather, proceeding without:', weatherError instanceof Error ? weatherError.message : String(weatherError));
      }
    }

    console.log('⚡ Generating hybrid outfit recommendations...');
    
    // Check if we have both tops and bottoms for complete outfits
    const tops = items.filter(item => item.category === 'outerwear' || item.category === 'tops');
    const bottoms = items.filter(item => item.category === 'bottoms');
    
    console.log(`👔 [OUTFIT] Item breakdown: ${tops.length} tops, ${bottoms.length} bottoms`);
    
    if (tops.length === 0 || bottoms.length === 0) {
      return res.json({
        recommendations: [],
        message: `Cannot create complete outfits: Need both tops and bottoms. You have ${tops.length} tops and ${bottoms.length} bottoms.`,
        missing_categories: [
          ...(tops.length === 0 ? ['tops'] : []),
          ...(bottoms.length === 0 ? ['bottoms'] : [])
        ]
      });
    }
    
    // Use hybrid approach: rule-based matching with AI attributes
    const recommendations = hybridOutfitMatcher.generateRecommendations(items, {
      occasion,
      weather: weatherData,
      formality_preference: userPreferences?.formality_preference,
      color_preferences: userPreferences?.favoriteColors,
      avoid_colors: userPreferences?.avoidColors
    });

    console.log('✅ Generated', recommendations.length, 'hybrid recommendations');

    // Add weather context to response
    const weatherContext = weatherData ? {
      temperature: weatherData.temperature,
      description: weatherData.description,
      suggestion: getWeatherSuggestion(weatherData.temperature, weatherData.description)
    } : null;

    res.json({ 
      recommendations: recommendations.map(rec => ({
        top: { ...rec.top, image_data: undefined }, // Remove image data for response
        bottom: { ...rec.bottom, image_data: undefined },
        confidence: rec.confidence,
        reasoning: rec.reasoning
      })),
      weather_context: weatherContext,
      total_items: items.length,
      ai_powered: process.env.OPENAI_API_KEY ? true : false
    });
    
  } catch (error) {
    console.error('AI outfit recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Helper function for estimating formality score
function estimateFormalityScore(formality: string): number {
  const formalityMap: Record<string, number> = {
    'athletic': 1,
    'casual': 3,
    'business': 7,
    'formal': 9
  };
  
  return formalityMap[formality] || 5; // Default to middle
}

// Helper function for weather-based clothing suggestions
function getWeatherSuggestion(temperature: number, description: string): string {
  const desc = description.toLowerCase();
  
  // Check for precipitation first
  if (desc.includes('rain') || desc.includes('drizzle')) {
    return getBaseTemperatureSuggestion(temperature) + " - don't forget waterproof layers!";
  }
  if (desc.includes('snow')) {
    return "Snowy weather - waterproof boots and warm, layered clothing essential";
  }
  
  // Temperature-based suggestions (Fahrenheit)
  if (temperature >= 86) {  // 30°C = 86°F
    return "Very hot weather - consider lightweight, breathable fabrics and light colors";
  } else if (temperature >= 77) {  // 25°C = 77°F
    return "Warm weather - perfect for t-shirts, shorts, and light materials";
  } else if (temperature >= 68) {  // 20°C = 68°F
    return "Pleasant weather - ideal for most clothing options";
  } else if (temperature >= 59) {  // 15°C = 59°F
    return "Mild weather - consider light layers or long sleeves";
  } else if (temperature >= 50) {  // 10°C = 50°F
    return "Cool weather - recommend layers and warmer materials";
  } else if (temperature >= 32) {  // 0°C = 32°F
    return "Cold weather - dress warmly with multiple layers";
  } else {
    return "Very cold weather - heavy coats and warm accessories recommended";
  }
}

function getBaseTemperatureSuggestion(temperature: number): string {
  if (temperature >= 77) return "Warm weather - light and breathable clothing";   // 25°C = 77°F
  if (temperature >= 59) return "Mild weather - comfortable layering options";    // 15°C = 59°F
  if (temperature >= 41) return "Cool weather - warm layers recommended";         // 5°C = 41°F
  return "Cold weather - dress warmly with multiple layers";
}

export default router;