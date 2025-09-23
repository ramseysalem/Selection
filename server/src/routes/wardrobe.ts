import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { wardrobeStore, ClothingCategory, ClothingSubcategory, Season, Occasion } from '../models/WardrobeItemPG';
import { aiVisionService } from '../services/aiVisionService';
import { hybridOutfitMatcher } from '../services/hybridOutfitMatcher';

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

// Get wardrobe item image (public endpoint - no auth required for images)
router.get('/:id/image', async (req, res) => {
  try {
    const item = await wardrobeStore.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Wardrobe item not found' });
    }

    // No authentication check - images are public once you have the ID

    res.set({
      'Content-Type': item.image_mime_type,
      'Content-Length': item.image_data.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 1 day
    });

    res.send(item.image_data);
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
router.post('/', upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Parse user input (now simplified - mainly just name)
    const userInput = JSON.parse(req.body.data || '{}');
    
    try {
      // Use AI to analyze the image
      console.log('🤖 Analyzing image with AI...');
      const aiAnalysis = await aiVisionService.analyzeClothingImage(req.file.buffer, req.file.mimetype);
      
      // Combine AI analysis with user input (user input takes precedence if provided)
      const itemData = {
        name: userInput.name || aiAnalysis.description,
        category: userInput.category || aiAnalysis.category,
        subcategory: userInput.subcategory || aiAnalysis.subcategory,
        color_primary: userInput.color_primary || aiAnalysis.color_primary,
        color_secondary: userInput.color_secondary || aiAnalysis.color_secondary,
        material: userInput.material || aiAnalysis.material,
        season: userInput.season || aiAnalysis.season,
        occasion: userInput.occasion || aiAnalysis.occasion,
        tags: userInput.tags || [aiAnalysis.formality, `ai-confidence-${Math.round(aiAnalysis.confidence * 100)}%`],
        is_favorite: userInput.is_favorite || false,
        brand: userInput.brand,
        size: userInput.size,
        notes: userInput.notes || `AI Analysis: ${aiAnalysis.description} (${Math.round(aiAnalysis.confidence * 100)}% confidence)`
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

      const newItem = await wardrobeStore.create({
        ...validatedData,
        category: validatedData.category!, // TypeScript assertion - we ensured this exists above
        color_primary: validatedData.color_primary!, // TypeScript assertion - we ensured this exists above
        user_id: req.user!.id,
        image_data: req.file.buffer,
        image_mime_type: req.file.mimetype,
        image_filename: req.file.originalname,
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
      
      // Ensure required fields are present for bulk uploads when AI fails
      if (!userInput.category) {
        userInput.category = ClothingCategory.TOPS; // Default fallback
        console.warn('⚠️ No category provided in manual input, using default: TOPS');
      }
      if (!userInput.color_primary) {
        userInput.color_primary = '#000000'; // Default fallback
        console.warn('⚠️ No color_primary provided in manual input, using default: #000000');
      }
      
      // Fallback to manual input if AI fails
      const validatedData = createWardrobeItemSchema.parse(userInput);

      const newItem = await wardrobeStore.create({
        ...validatedData,
        category: validatedData.category!, // TypeScript assertion - we ensured this exists above
        color_primary: validatedData.color_primary!, // TypeScript assertion - we ensured this exists above
        user_id: req.user!.id,
        image_data: req.file.buffer,
        image_mime_type: req.file.mimetype,
        image_filename: req.file.originalname,
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

    const validatedData = updateWardrobeItemSchema.parse(JSON.parse(req.body.data || '{}'));
    
    const updates: any = { ...validatedData };
    
    // If new image is uploaded, update image data
    if (req.file) {
      updates.image_data = req.file.buffer;
      updates.image_mime_type = req.file.mimetype;
      updates.image_filename = req.file.originalname;
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

    const deleted = await wardrobeStore.delete(req.params.id);
    
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    res.json({ message: 'Wardrobe item deleted successfully' });
  } catch (error) {
    console.error('Delete wardrobe item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-powered outfit recommendations
router.post('/recommendations', async (req: AuthRequest, res) => {
  try {
    const { weather, occasion, userPreferences } = req.body;
    
    // Get all user's wardrobe items
    const items = await wardrobeStore.findByUserId(req.user!.id);
    
    if (items.length === 0) {
      return res.json({ 
        recommendations: [],
        message: 'No wardrobe items available for recommendations'
      });
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
      weather,
      formality_preference: userPreferences?.formality_preference,
      color_preferences: userPreferences?.favoriteColors,
      avoid_colors: userPreferences?.avoidColors
    });

    console.log('✅ Generated', recommendations.length, 'hybrid recommendations');

    res.json({ 
      recommendations: recommendations.map(rec => ({
        top: { ...rec.top, image_data: undefined }, // Remove image data for response
        bottom: { ...rec.bottom, image_data: undefined },
        confidence: rec.confidence,
        reasoning: rec.reasoning
      })),
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

export default router;