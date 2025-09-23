import express from 'express';
import multer from 'multer';
import { aiVisionService } from '../services/aiVisionService';
import { wardrobeStore } from '../models/WardrobeItemPG';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Configure multer for test uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Test AI vision analysis without saving to database
router.post('/analyze-image', upload.single('image'), async (req, res) => {
  console.log('\n🧪 [AI TEST] Image analysis test started');
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    console.log(`📁 [AI TEST] Received image: ${req.file.originalname}`);
    console.log(`📊 [AI TEST] File size: ${(req.file.size / 1024).toFixed(2)}KB`);
    console.log(`🎨 [AI TEST] MIME type: ${req.file.mimetype}`);

    // Test AI analysis
    const analysis = await aiVisionService.analyzeClothingImage(
      req.file.buffer, 
      req.file.mimetype
    );

    console.log('✅ [AI TEST] Analysis successful!');
    console.log('📋 [AI TEST] Results:', {
      category: analysis.category,
      colors: { primary: analysis.color_primary, secondary: analysis.color_secondary },
      confidence: analysis.confidence,
      formality: analysis.formality
    });

    res.json({
      success: true,
      analysis: {
        category: analysis.category,
        subcategory: analysis.subcategory,
        color_primary: analysis.color_primary,
        color_secondary: analysis.color_secondary,
        material: analysis.material,
        formality: analysis.formality,
        season: analysis.season,
        occasion: analysis.occasion,
        description: analysis.description,
        confidence: analysis.confidence
      },
      test_info: {
        file_name: req.file.originalname,
        file_size_kb: Math.round(req.file.size / 1024),
        mime_type: req.file.mimetype,
        openai_available: !!process.env.OPENAI_API_KEY
      }
    });

  } catch (error) {
    console.error('❌ [AI TEST] Analysis failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Analysis failed',
      openai_available: !!process.env.OPENAI_API_KEY
    });
  }
});

// Test outfit recommendations with existing wardrobe items
router.post('/test-recommendations', verifyToken, async (req: AuthRequest, res) => {
  console.log('\n🧪 [AI TEST] Outfit recommendations test started');
  
  try {
    const { weather, occasion, userPreferences } = req.body;
    
    // Get user's wardrobe items
    const items = await wardrobeStore.findByUserId(req.user!.id);
    console.log(`👔 [AI TEST] Found ${items.length} wardrobe items for user`);

    if (items.length < 2) {
      return res.json({
        message: 'Need at least 2 wardrobe items (1 top, 1 bottom) to test recommendations',
        current_items: items.length,
        suggestions: [
          'Add some clothing items to your wardrobe first',
          'Make sure you have both tops and bottoms',
          'Use the /api/ai-test/analyze-image endpoint to test AI vision first'
        ]
      });
    }

    // Generate recommendations
    const recommendations = await aiVisionService.generateOutfitRecommendations(
      items,
      weather,
      occasion,
      userPreferences
    );

    console.log(`✅ [AI TEST] Generated ${recommendations.length} recommendations`);

    res.json({
      success: true,
      recommendations: recommendations.map((rec, index) => ({
        rank: index + 1,
        top: {
          id: rec.top.id,
          name: rec.top.name,
          category: rec.top.category,
          color_primary: rec.top.color_primary
        },
        bottom: {
          id: rec.bottom.id,
          name: rec.bottom.name,
          category: rec.bottom.category,
          color_primary: rec.bottom.color_primary
        },
        confidence: rec.confidence,
        reasoning: rec.reasoning
      })),
      test_info: {
        total_wardrobe_items: items.length,
        tops_available: items.filter(item => item.category === 'outerwear' || item.category === 'tops').length,
        bottoms_available: items.filter(item => item.category === 'bottoms').length,
        weather_provided: !!weather,
        occasion_provided: !!occasion,
        openai_available: !!process.env.OPENAI_API_KEY
      }
    });

  } catch (error) {
    console.error('❌ [AI TEST] Recommendations failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Recommendations failed',
      openai_available: !!process.env.OPENAI_API_KEY
    });
  }
});

// Get current AI service status
router.get('/status', (req, res) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  console.log(`🔍 [AI TEST] Status check - OpenAI available: ${hasOpenAI}`);
  
  res.json({
    ai_vision_available: hasOpenAI,
    openai_configured: hasOpenAI,
    endpoints: {
      analyze_image: '/api/ai-test/analyze-image (POST with image file)',
      test_recommendations: '/api/ai-test/test-recommendations (POST, requires auth)',
      status: '/api/ai-test/status (GET)'
    },
    test_suggestions: [
      'First, check if OpenAI API key is configured',
      'Test image analysis with /analyze-image endpoint',
      'Add some wardrobe items via the main app',
      'Test outfit recommendations with /test-recommendations'
    ]
  });
});

export default router;