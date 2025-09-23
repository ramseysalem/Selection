import express from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { wardrobeStore } from '../models/WardrobeItemPG';

const router = express.Router();

// Manually correct AI analysis for a wardrobe item
router.patch('/correct-item/:itemId', verifyToken, async (req: AuthRequest, res) => {
  console.log('🔧 [AI CORRECTION] Manual correction request...');
  
  try {
    const { itemId } = req.params;
    const corrections = req.body;
    
    console.log(`📝 [AI CORRECTION] Correcting item ${itemId}:`, corrections);
    
    // Validate that the item belongs to the user
    const item = await wardrobeStore.findById(itemId);
    if (!item || item.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }
    
    // Prepare AI attribute updates
    const aiUpdates: any = {
      ai_analyzed: true,
      ai_confidence: 0.99, // High confidence for manual corrections
      ai_analyzed_at: new Date()
    };
    
    // Apply corrections selectively
    if (corrections.color_primary) {
      aiUpdates.ai_color_palette = [corrections.color_primary];
      if (corrections.color_secondary) {
        aiUpdates.ai_color_palette.push(corrections.color_secondary);
      }
    }
    
    if (corrections.formality) {
      aiUpdates.ai_formality_score = mapFormalityToScore(corrections.formality);
    }
    
    if (corrections.style_tags) {
      aiUpdates.ai_style_tags = corrections.style_tags;
    }
    
    if (corrections.material_properties) {
      aiUpdates.ai_material_properties = corrections.material_properties;
    }
    
    if (corrections.description) {
      aiUpdates.ai_description = corrections.description;
    }
    
    // Update the main item attributes as well
    const itemUpdates: any = {};
    if (corrections.color_primary) itemUpdates.color_primary = corrections.color_primary;
    if (corrections.color_secondary) itemUpdates.color_secondary = corrections.color_secondary;
    if (corrections.category) itemUpdates.category = corrections.category;
    if (corrections.subcategory) itemUpdates.subcategory = corrections.subcategory;
    if (corrections.material) itemUpdates.material = corrections.material;
    if (corrections.season) itemUpdates.season = corrections.season;
    if (corrections.occasion) itemUpdates.occasion = corrections.occasion;
    
    // Apply AI attribute updates
    await wardrobeStore.updateAIAttributes(itemId, aiUpdates);
    
    // Apply main item updates if any
    if (Object.keys(itemUpdates).length > 0) {
      await wardrobeStore.update(itemId, itemUpdates);
    }
    
    console.log('✅ [AI CORRECTION] Item corrected successfully');
    
    // Return updated item
    const updatedItem = await wardrobeStore.findById(itemId);
    
    res.json({
      success: true,
      message: 'Item corrected successfully',
      item: {
        ...updatedItem,
        image_data: undefined // Don't send image data in response
      }
    });
    
  } catch (error) {
    console.error('❌ [AI CORRECTION] Correction failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Correction failed'
    });
  }
});

// Re-analyze an item with improved AI prompt
router.post('/reanalyze-item/:itemId', verifyToken, async (req: AuthRequest, res) => {
  console.log('🔄 [AI CORRECTION] Re-analysis request...');
  
  try {
    const { itemId } = req.params;
    
    // Validate that the item belongs to the user
    const item = await wardrobeStore.findById(itemId);
    if (!item || item.user_id !== req.user!.id) {
      return res.status(404).json({ error: 'Item not found or access denied' });
    }
    
    console.log(`🤖 [AI CORRECTION] Re-analyzing item: ${item.name}`);
    
    // Import AI service here to avoid circular imports
    const { aiVisionService } = await import('../services/aiVisionService');
    
    // Re-analyze the image with improved prompt
    const analysis = await aiVisionService.analyzeClothingImage(
      item.image_data, 
      item.image_mime_type
    );
    
    // Update with new analysis
    const aiUpdates = {
      ai_analyzed: true,
      ai_confidence: analysis.confidence,
      ai_style_tags: extractStyleTags(analysis),
      ai_formality_score: mapFormalityToScore(analysis.formality),
      ai_color_palette: [analysis.color_primary, analysis.color_secondary].filter(Boolean) as string[],
      ai_material_properties: extractMaterialProperties(analysis),
      ai_description: analysis.description,
      ai_analyzed_at: new Date()
    };
    
    // Update main item attributes with new analysis
    const itemUpdates = {
      color_primary: analysis.color_primary,
      color_secondary: analysis.color_secondary || undefined,
      material: analysis.material || undefined,
      season: analysis.season || [],
      occasion: analysis.occasion || []
    };
    
    // Apply updates
    await wardrobeStore.updateAIAttributes(itemId, aiUpdates);
    await wardrobeStore.update(itemId, itemUpdates);
    
    console.log(`✅ [AI CORRECTION] Re-analysis complete - confidence: ${Math.round(analysis.confidence * 100)}%`);
    
    // Return updated item
    const updatedItem = await wardrobeStore.findById(itemId);
    
    res.json({
      success: true,
      message: 'Item re-analyzed successfully',
      analysis: {
        confidence: analysis.confidence,
        color_primary: analysis.color_primary,
        formality: analysis.formality,
        description: analysis.description
      },
      item: {
        ...updatedItem,
        image_data: undefined
      }
    });
    
  } catch (error) {
    console.error('❌ [AI CORRECTION] Re-analysis failed:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Re-analysis failed'
    });
  }
});

// Helper functions
function mapFormalityToScore(formality: string): number {
  const formalityMap: Record<string, number> = {
    'athletic': 1,
    'casual': 3,
    'business': 7,
    'formal': 9
  };
  
  return formalityMap[formality] || 5;
}

function extractStyleTags(analysis: any): string[] {
  const tags = [];
  
  if (analysis.formality) tags.push(analysis.formality);
  if (analysis.season) tags.push(...analysis.season);
  if (analysis.occasion) tags.push(...analysis.occasion);
  if (analysis.material) tags.push(analysis.material);
  
  return [...new Set(tags)];
}

function extractMaterialProperties(analysis: any): string[] {
  const properties = [];
  const material = analysis.material?.toLowerCase() || '';
  const description = analysis.description?.toLowerCase() || '';
  
  if (material.includes('cotton') || material.includes('linen')) {
    properties.push('breathable');
  }
  
  if (material.includes('wool') || material.includes('fleece')) {
    properties.push('warm');
  }
  
  if (material.includes('denim') || description.includes('sturdy')) {
    properties.push('durable');
  }
  
  return properties;
}

export default router;