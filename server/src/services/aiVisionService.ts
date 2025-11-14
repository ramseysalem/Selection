import OpenAI from 'openai';
import { ClothingCategory, ClothingSubcategory, Season, Occasion } from '../models/WardrobeItemPG';

interface ClothingAnalysis {
  category: ClothingCategory;
  subcategory?: ClothingSubcategory;
  color_primary: string;
  color_secondary?: string;
  material?: string;
  fabric_weight?: 'lightweight' | 'medium' | 'heavy';
  texture?: 'smooth' | 'textured' | 'structured' | 'knit';
  formality: 'casual' | 'business' | 'formal' | 'athletic';
  formality_score?: number;
  season: Season[];
  occasion: Occasion[];
  style_details?: {
    fit?: 'fitted' | 'regular' | 'relaxed' | 'oversized';
    sleeve_type?: 'long' | 'short' | 'sleeveless' | 'three_quarter';
    collar_type?: 'crew' | 'v_neck' | 'button_down' | 'polo' | 'no_collar';
  };
  description: string;
  confidence: number;
}

class AIVisionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not found. AI vision features will be limited.');
    }
  }

  async analyzeClothingImage(imageBuffer: Buffer, mimeType: string): Promise<ClothingAnalysis> {
    console.log('🤖 [AI VISION] Starting image analysis...');
    console.log(`📊 [AI VISION] Image size: ${(imageBuffer.length / 1024).toFixed(2)}KB, type: ${mimeType}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ [AI VISION] OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();
    
    try {
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      
      console.log('📤 [AI VISION] Sending request to OpenAI Vision API...');

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a MASTER FASHION STYLIST with expertise in garment construction, textile science, and style theory. Analyze this clothing item with EXPERT-LEVEL PRECISION.

STEP 1: IDENTIFY THE GARMENT TYPE & FUNCTION
Ask yourself: "What am I looking at and how is it worn?"
- Upper body coverage (chest, shoulders, arms)? → TOPS
- Lower body coverage (waist, hips, legs)? → BOTTOMS  
- Outer layer for warmth/weather? → OUTERWEAR
- Footwear? → FOOTWEAR
- Add-on accessory? → ACCESSORIES

STEP 2: SUBCATEGORY - USE EXACT ENUM VALUES
OUTERWEAR: coats, jackets, blazers, hoodies, sweaters, cardigans
TOPS: tee_shirts, button_ups, polo_shirts, tank_tops, sweatshirts, blouses
BOTTOMS: jeans, pants, shorts, skirts, leggings, dress_pants
FOOTWEAR: sneakers, dress_shoes, boots, sandals, heels, flats
ACCESSORIES: belts, hats, bags, jewelry, scarves, watches

STEP 3: FABRIC & TEXTURE ANALYSIS
Study the material properties visible in the image:
FABRIC WEIGHT: lightweight (chiffon, silk), medium (cotton, wool), heavy (denim, tweed)
TEXTURE: smooth (silk, satin), textured (knit, corduroy), structured (blazer, suit)
SHINE: matte, slight sheen, high shine/satin, metallic
WEAVE: tight weave (dress shirt), loose weave (knit), no visible weave (leather)

MATERIAL IDENTIFICATION:
- COTTON: Crisp or soft, natural drape, visible weave
- DENIM: Heavy cotton, visible diagonal weave, sturdy
- WOOL: Soft texture, natural drape, may have visible fibers
- SILK: Smooth, lustrous, fluid drape
- POLYESTER: Smooth, sometimes shiny, holds shape
- LINEN: Natural texture, wrinkle-prone, loose weave
- LEATHER: Smooth or textured surface, structured
- KNIT: Stretchy appearance, ribbed or smooth texture

STEP 4: COLOR ANALYSIS - PRECISE HEX MATCHING
Study the ACTUAL fabric color in the image:
NEUTRALS: #FFFFFF (pure white), #F5F5DC (cream), #000000 (black), #696969 (charcoal), #D3D3D3 (light gray), #8B4513 (brown), #F5DEB3 (wheat/beige)
BLUES: #000080 (navy), #4169E1 (royal blue), #ADD8E6 (light blue), #87CEEB (sky blue), #1E90FF (dodger blue)
REDS: #FF0000 (red), #800020 (burgundy), #DC143C (crimson), #B22222 (firebrick)
GREENS: #008000 (green), #006400 (dark green), #228B22 (forest), #90EE90 (light green)
OTHERS: #FFFF00 (yellow), #FFC0CB (pink), #800080 (purple), #FFA500 (orange)

STEP 5: ADVANCED FORMALITY SCORING (1-10 scale)
ATHLETIC (1-2): Performance fabrics, logos, sporty cuts, technical details
CASUAL (3-4): Relaxed fits, casual fabrics (t-shirt cotton, denim), everyday wear
SMART CASUAL (5-6): Clean lines, quality fabrics, polished but relaxed (polo, chinos)
BUSINESS (7-8): Structured, professional fabrics (dress shirt cotton, wool), office-appropriate
FORMAL (9-10): Luxury fabrics, evening wear, suits, formal construction

FORMALITY INDICATORS:
- CASUAL: Distressed details, logos, oversized fits, athletic materials
- BUSINESS: Collar, buttons, structured shoulders, crisp fabrics, tailored fit
- FORMAL: Fine materials, elegant drape, evening-appropriate, luxury details

STEP 6: SEASONAL APPROPRIATENESS
FABRIC WEIGHT determines season:
- SUMMER: Lightweight (linen, cotton gauze, silk), breathable
- WINTER: Heavy (wool, fleece, thick knits), insulating
- TRANSITIONAL: Medium weight (cotton, light wool)
- ALL-SEASON: Versatile weight and material

STEP 7: STYLE DETAILS & CONSTRUCTION
Note specific design elements:
- COLLAR TYPE: crew neck, V-neck, button-down, no collar
- SLEEVE TYPE: long, short, sleeveless, three-quarter
- FIT: fitted, regular, relaxed, oversized
- CLOSURE: buttons, zipper, pullover, wrap
- HEM: straight, curved, raw, finished
- SPECIAL FEATURES: pockets, pleats, patterns, hardware

Return JSON in this EXACT format:
{
  "category": "outerwear|tops|bottoms|footwear|accessories",
  "subcategory": "EXACT ENUM: tee_shirts|button_ups|polo_shirts|tank_tops|sweatshirts|blouses|jeans|pants|shorts|skirts|leggings|dress_pants|coats|jackets|blazers|hoodies|sweaters|cardigans|sneakers|dress_shoes|boots|sandals|heels|flats|belts|hats|bags|jewelry|scarves|watches",
  "color_primary": "exact hex code from expanded color list above",
  "color_secondary": "hex code of secondary color or null",
  "material": "cotton|denim|wool|polyester|silk|leather|nylon|spandex|linen|cashmere|knit|fleece",
  "fabric_weight": "lightweight|medium|heavy",
  "texture": "smooth|textured|structured|knit",
  "formality": "athletic|casual|business|formal",
  "formality_score": 1-10,
  "season": ["spring", "summer", "fall", "winter", "all_seasons"],
  "occasion": ["casual", "work", "formal", "party", "sports", "date"],
  "style_details": {
    "fit": "fitted|regular|relaxed|oversized",
    "sleeve_type": "long|short|sleeveless|three_quarter",
    "collar_type": "crew|v_neck|button_down|polo|no_collar"
  },
  "description": "detailed description including fabric texture, weight, and style details",
  "confidence": 0.85
}

FASHION EXPERT EXAMPLES:
• Crisp white button-up shirt = business formality (7), cotton material, structured texture, fitted/regular fit
• Distressed blue jeans = casual formality (3), denim material, heavy weight, relaxed fit
• Charcoal wool blazer = business/formal (8), wool material, structured texture, fitted
• Athletic mesh shorts = athletic formality (1), polyester/nylon, lightweight, relaxed fit
• Silk blouse = business formality (7), silk material, smooth texture, regular fit

CRITICAL ACCURACY REQUIREMENTS:
✓ ANALYZE FABRIC TEXTURE visible in the image (knit vs woven vs structured)
✓ ASSESS FABRIC WEIGHT from visual cues (drape, thickness, stiffness)
✓ EVALUATE CONSTRUCTION QUALITY (cheap vs well-made affects formality)
✓ CONSIDER FIT (oversized hoodie ≠ tailored blazer even if same material)
✓ PANTS/TROUSERS/JEANS = "bottoms" category (NOT tops!)
✓ SHIRTS/BLOUSES/TOPS = "tops" category (NOT bottoms!)
✓ Look at ACTUAL color, texture, and construction details
✓ Formality score must match visual evidence of quality and styling

DOUBLE-CHECK FASHION LOGIC:
- Does this look like it belongs in a gym? → athletic (1-2)
- Would this work in a casual coffee shop? → casual (3-4) 
- Could this work in a business office? → business (7-8)
- Would this work at a formal dinner? → formal (9-10)`
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content;
      const duration = Date.now() - startTime;
      
      console.log(`⏱️ [AI VISION] OpenAI response received in ${duration}ms`);
      console.log(`📝 [AI VISION] Raw response length: ${content?.length} characters`);
      console.log(`🔍 [AI VISION] Full OpenAI Response:`);
      console.log('='.repeat(50));
      console.log(content);
      console.log('='.repeat(50));
      
      if (!content) {
        console.log('❌ [AI VISION] No response content from OpenAI');
        throw new Error('No response from AI vision service');
      }

      // Extract JSON from response (sometimes AI adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('❌ [AI VISION] No valid JSON found in response');
        console.log('🔍 [AI VISION] Full response:', content);
        throw new Error('Invalid JSON response from AI vision service');
      }

      const analysis = JSON.parse(jsonMatch[0]) as ClothingAnalysis;
      console.log('📋 [AI VISION] Parsed analysis:', {
        category: analysis.category,
        color_primary: analysis.color_primary,
        confidence: analysis.confidence,
        formality: analysis.formality
      });
      
      // Validate and normalize the response
      const validated = this.validateAndNormalizeAnalysis(analysis);
      
      console.log('✅ [AI VISION] Analysis complete!', {
        final_category: validated.category,
        final_color_primary: validated.color_primary,
        final_confidence: validated.confidence,
        processing_time: `${duration}ms`
      });
      
      return validated;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ [AI VISION] Analysis failed after', duration + 'ms:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.log('🔑 [AI VISION] API key issue detected');
        } else if (error.message.includes('quota') || error.message.includes('billing')) {
          console.log('💳 [AI VISION] Quota/billing issue detected');
        } else if (error.message.includes('rate limit')) {
          console.log('⏳ [AI VISION] Rate limit hit');
        }
      }
      
      console.log('🔄 [AI VISION] Falling back to default analysis');
      
      // Fallback analysis if AI fails
      return this.getFallbackAnalysis();
    }
  }

  private validateAndNormalizeAnalysis(analysis: any): ClothingAnalysis {
    // Map string values to enum values
    const categoryMap: Record<string, ClothingCategory> = {
      'outerwear': ClothingCategory.OUTERWEAR,
      'tops': ClothingCategory.TOPS,
      'bottoms': ClothingCategory.BOTTOMS,
      'footwear': ClothingCategory.FOOTWEAR,
      'accessories': ClothingCategory.ACCESSORIES
    };

    const seasonMap: Record<string, Season> = {
      'spring': Season.SPRING,
      'summer': Season.SUMMER,
      'fall': Season.FALL,
      'winter': Season.WINTER,
      'all_seasons': Season.ALL_SEASONS
    };

    const occasionMap: Record<string, Occasion> = {
      'casual': Occasion.CASUAL,
      'work': Occasion.BUSINESS,
      'business': Occasion.BUSINESS,
      'formal': Occasion.FORMAL,
      'party': Occasion.PARTY,
      'sports': Occasion.ATHLETIC,
      'athletic': Occasion.ATHLETIC,
      'date': Occasion.DATE,
      'travel': Occasion.TRAVEL
    };

    // Subcategory mapping to handle AI's natural language output vs our enum values
    const subcategoryMap: Record<string, ClothingSubcategory> = {
      // AI output → Enum value
      't-shirt': ClothingSubcategory.TEE_SHIRTS,
      'tee shirt': ClothingSubcategory.TEE_SHIRTS,
      'tee_shirts': ClothingSubcategory.TEE_SHIRTS,
      'button-up shirt': ClothingSubcategory.BUTTON_UPS,
      'button up shirt': ClothingSubcategory.BUTTON_UPS,
      'button_ups': ClothingSubcategory.BUTTON_UPS,
      'dress shirt': ClothingSubcategory.BUTTON_UPS,
      'polo shirt': ClothingSubcategory.POLO_SHIRTS,
      'polo_shirts': ClothingSubcategory.POLO_SHIRTS,
      'tank top': ClothingSubcategory.TANK_TOPS,
      'tank_tops': ClothingSubcategory.TANK_TOPS,
      'sweatshirts': ClothingSubcategory.SWEATSHIRTS,
      'hoodie': ClothingSubcategory.HOODIES,
      'hoodies': ClothingSubcategory.HOODIES,
      'blouses': ClothingSubcategory.BLOUSES,
      'dress pants': ClothingSubcategory.DRESS_PANTS,
      'dress_pants': ClothingSubcategory.DRESS_PANTS,
      'pants': ClothingSubcategory.PANTS,
      'jeans': ClothingSubcategory.JEANS,
      'shorts': ClothingSubcategory.SHORTS,
      'swim shorts': ClothingSubcategory.SHORTS,
      'athletic shorts': ClothingSubcategory.SHORTS,
      'skirts': ClothingSubcategory.SKIRTS,
      'leggings': ClothingSubcategory.LEGGINGS,
      'sneakers': ClothingSubcategory.SNEAKERS,
      'dress shoes': ClothingSubcategory.DRESS_SHOES,
      'dress_shoes': ClothingSubcategory.DRESS_SHOES,
      'boots': ClothingSubcategory.BOOTS,
      'sandals': ClothingSubcategory.SANDALS,
      'heels': ClothingSubcategory.HEELS,
      'flats': ClothingSubcategory.FLATS
    };

    // Normalize category
    const category = categoryMap[analysis.category?.toLowerCase()] || ClothingCategory.TOPS;
    
    // Normalize subcategory with fallback mapping
    const subcategory = subcategoryMap[analysis.subcategory?.toLowerCase()] || analysis.subcategory;

    // Normalize seasons
    const seasons = Array.isArray(analysis.season) 
      ? analysis.season.map((s: string) => seasonMap[s?.toLowerCase()]).filter(Boolean)
      : [Season.ALL_SEASONS];

    // Normalize occasions  
    const occasions = Array.isArray(analysis.occasion)
      ? analysis.occasion.map((o: string) => occasionMap[o?.toLowerCase()]).filter(Boolean)
      : [Occasion.CASUAL];

    // Ensure color is valid hex
    const color_primary = this.validateHexColor(analysis.color_primary) || '#000000';
    const validatedSecondary = this.validateHexColor(analysis.color_secondary);
    const color_secondary = validatedSecondary || undefined;

    return {
      category,
      subcategory,
      color_primary,
      color_secondary,
      material: analysis.material,
      formality: analysis.formality || 'casual',
      season: seasons.length > 0 ? seasons : [Season.ALL_SEASONS],
      occasion: occasions.length > 0 ? occasions : [Occasion.CASUAL],
      description: analysis.description || 'Clothing item',
      confidence: Math.min(Math.max(analysis.confidence || 0.5, 0), 1)
    };
  }

  private validateHexColor(color: string): string | null {
    if (!color) return null;
    
    // Remove # if present
    const hex = color.replace('#', '');
    
    // Check if valid hex color (3 or 6 characters)
    if (/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
      return '#' + hex.toUpperCase();
    }
    
    // Try to convert color names to hex (basic mapping)
    const colorNames: Record<string, string> = {
      'black': '#000000',
      'white': '#FFFFFF',
      'red': '#FF0000',
      'blue': '#0000FF',
      'green': '#00FF00',
      'yellow': '#FFFF00',
      'purple': '#800080',
      'pink': '#FFC0CB',
      'brown': '#A52A2A',
      'gray': '#808080',
      'grey': '#808080',
      'navy': '#000080',
      'beige': '#F5F5DC'
    };
    
    return colorNames[color.toLowerCase()] || null;
  }

  private getFallbackAnalysis(): ClothingAnalysis {
    return {
      category: ClothingCategory.TOPS,
      color_primary: '#000000',
      formality: 'casual',
      season: [Season.ALL_SEASONS],
      occasion: [Occasion.CASUAL],
      description: 'Clothing item (auto-categorization failed)',
      confidence: 0.1
    };
  }

  async generateOutfitRecommendations(
    availableItems: any[],
    weather?: { temperature: number; description: string },
    occasion?: Occasion,
    userPreferences?: { favoriteColors?: string[]; avoidColors?: string[] }
  ): Promise<{ top: any; bottom: any; confidence: number; reasoning: string }[]> {
    console.log('🎯 [AI OUTFITS] Starting outfit recommendation generation...');
    console.log(`👔 [AI OUTFITS] Available items: ${availableItems.length}`);
    console.log(`🌤️ [AI OUTFITS] Weather: ${weather ? `${weather.temperature}°C, ${weather.description}` : 'None'}`);
    console.log(`🎪 [AI OUTFITS] Occasion: ${occasion || 'None'}`);
    
    const tops = availableItems.filter(item => item.category === 'outerwear' || item.category === 'tops');
    const bottoms = availableItems.filter(item => item.category === 'bottoms');
    console.log(`👕 [AI OUTFITS] Tops available: ${tops.length}, Bottoms available: ${bottoms.length}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ [AI OUTFITS] No OpenAI API key, using basic matching');
      return this.getBasicOutfitRecommendations(availableItems, weather, occasion);
    }

    const startTime = Date.now();
    
    try {
      const itemsDescription = availableItems.map(item => ({
        id: item.id,
        category: item.category,
        color_primary: item.color_primary,
        color_secondary: item.color_secondary,
        formality: item.formality || 'casual',
        season: item.season,
        occasion: item.occasion,
        description: item.description || item.name
      }));

      const prompt = `Given this wardrobe of ${availableItems.length} items, recommend 3 great outfit combinations.
      
Available items: ${JSON.stringify(itemsDescription, null, 2)}

Context:
- Weather: ${weather ? `${weather.temperature}°C, ${weather.description}` : 'Unknown'}
- Target occasion: ${occasion || 'casual'}
- User preferences: ${userPreferences ? JSON.stringify(userPreferences) : 'None specified'}

Please return a JSON array of 3 outfit recommendations with this structure:
[
  {
    "top_id": "item_id",
    "bottom_id": "item_id", 
    "confidence": 0.95,
    "reasoning": "Why this combination works well - consider color harmony, style compatibility, weather appropriateness, and occasion suitability"
  }
]

Focus on:
1. Color coordination (complementary, analogous, or monochromatic schemes)
2. Style consistency (don't mix formal with athletic)
3. Weather appropriateness 
4. Occasion suitability
5. Seasonal considerations`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800
      });

      const content = response.choices[0]?.message?.content;
      const duration = Date.now() - startTime;
      
      console.log(`⏱️ [AI OUTFITS] OpenAI response received in ${duration}ms`);
      console.log(`📝 [AI OUTFITS] Raw response length: ${content?.length} characters`);
      console.log(`🔍 [AI OUTFITS] Full OpenAI Response:`);
      console.log('='.repeat(50));
      console.log(content);
      console.log('='.repeat(50));
      
      if (!content) {
        console.log('❌ [AI OUTFITS] No response content from OpenAI');
        throw new Error('No response from AI outfit service');
      }

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('❌ [AI OUTFITS] No valid JSON array found in response');
        console.log('🔍 [AI OUTFITS] Searching for any JSON in response...');
        throw new Error('Invalid JSON response from AI outfit service');
      }

      const recommendations = JSON.parse(jsonMatch[0]);
      
      // Convert IDs back to actual items and validate
      return recommendations.map((rec: any) => {
        const top = availableItems.find(item => item.id === rec.top_id);
        const bottom = availableItems.find(item => item.id === rec.bottom_id);
        
        if (top && bottom) {
          return {
            top,
            bottom,
            confidence: Math.min(Math.max(rec.confidence || 0.5, 0), 1),
            reasoning: rec.reasoning || 'AI-generated recommendation'
          };
        }
        return null;
      }).filter(Boolean);

    } catch (error) {
      console.error('AI outfit recommendation error:', error);
      return this.getBasicOutfitRecommendations(availableItems, weather, occasion);
    }
  }

  private getBasicOutfitRecommendations(
    availableItems: any[],
    weather?: { temperature: number; description: string },
    occasion?: Occasion
  ): { top: any; bottom: any; confidence: number; reasoning: string }[] {
    console.log('🔄 [AI FALLBACK] Using basic recommendations...');
    console.log(`🎪 [AI FALLBACK] Target occasion: ${occasion || 'any'}`);
    console.log(`🌤️ [AI FALLBACK] Weather context: ${weather ? `${weather.temperature}°C, ${weather.description}` : 'none'}`);

    // Filter items by occasion if specified
    let filteredItems = availableItems;
    if (occasion) {
      filteredItems = availableItems.filter(item => 
        !item.occasion || item.occasion.length === 0 || item.occasion.includes(occasion)
      );
      console.log(`👔 [AI FALLBACK] Filtered ${filteredItems.length}/${availableItems.length} items for occasion`);
    }

    const tops = filteredItems.filter(item => 
      item.category === ClothingCategory.TOPS || item.category === ClothingCategory.OUTERWEAR
    );
    const bottoms = filteredItems.filter(item => 
      item.category === ClothingCategory.BOTTOMS
    );

    console.log(`👕 [AI FALLBACK] Context-filtered: ${tops.length} tops, ${bottoms.length} bottoms`);

    if (tops.length === 0 || bottoms.length === 0) {
      // If no items match occasion, fall back to any items
      console.log('⚠️ [AI FALLBACK] No items match occasion, using all available items');
      const allTops = availableItems.filter(item => 
        item.category === ClothingCategory.TOPS || item.category === ClothingCategory.OUTERWEAR
      );
      const allBottoms = availableItems.filter(item => 
        item.category === ClothingCategory.BOTTOMS
      );
      
      if (allTops.length === 0 || allBottoms.length === 0) {
        return [];
      }
      
      return this.generateContextAwareRecommendations(allTops, allBottoms, weather, occasion, 0.3);
    }

    return this.generateContextAwareRecommendations(tops, bottoms, weather, occasion, 0.6);
  }

  private generateContextAwareRecommendations(
    tops: any[], 
    bottoms: any[], 
    weather?: { temperature: number; description: string },
    occasion?: Occasion,
    confidence: number = 0.6
  ): { top: any; bottom: any; confidence: number; reasoning: string }[] {
    const recommendations = [];
    
    // Try to match colors and styles contextually
    for (let i = 0; i < Math.min(3, tops.length); i++) {
      const top = tops[i];
      let bestBottom = bottoms[i % bottoms.length];
      
      // Try to find a better matching bottom based on color harmony
      const betterBottoms = bottoms.filter(bottom => {
        const topColor = top.color_primary?.toLowerCase() || '';
        const bottomColor = bottom.color_primary?.toLowerCase() || '';
        
        // Basic color harmony rules
        const neutralColors = ['black', 'white', 'gray', 'grey', 'beige', 'navy'];
        const topIsNeutral = neutralColors.some(color => topColor.includes(color));
        const bottomIsNeutral = neutralColors.some(color => bottomColor.includes(color));
        
        // Prefer neutral combinations or different colors (avoid same colors)
        return topIsNeutral || bottomIsNeutral || topColor !== bottomColor;
      });
      
      if (betterBottoms.length > 0) {
        bestBottom = betterBottoms[0];
      }
      
      // Generate context-aware reasoning
      let reasoning = 'Basic matching';
      const reasoningParts = [];
      
      if (occasion) {
        reasoningParts.push(`suitable for ${occasion}`);
      }
      
      if (weather) {
        if (weather.temperature < 15) {
          reasoningParts.push('warm layers for cool weather');
        } else if (weather.temperature > 25) {
          reasoningParts.push('breathable fabrics for warm weather');
        } else {
          reasoningParts.push('appropriate for current temperature');
        }
      }
      
      const topColor = top.color_primary || 'color';
      const bottomColor = bestBottom.color_primary || 'color';
      reasoningParts.push(`${topColor} top with ${bottomColor} bottom for color harmony`);
      
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts.join(', ') + ' (AI unavailable)';
      } else {
        reasoning = 'Basic color and style matching (AI unavailable)';
      }
      
      recommendations.push({
        top,
        bottom: bestBottom,
        confidence,
        reasoning
      });
    }

    console.log(`✅ [AI FALLBACK] Generated ${recommendations.length} context-aware recommendations`);
    return recommendations;
  }
}

export const aiVisionService = new AIVisionService();
export { ClothingAnalysis };