import OpenAI from 'openai';
import { ClothingCategory, ClothingSubcategory, Season, Occasion } from '../models/WardrobeItemPG';

interface ClothingAnalysis {
  category: ClothingCategory;
  subcategory?: ClothingSubcategory;
  color_primary: string;
  color_secondary?: string;
  material?: string;
  formality: 'casual' | 'business' | 'formal' | 'athletic';
  season: Season[];
  occasion: Occasion[];
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
                text: `You are a professional fashion expert. Analyze this clothing item image with EXTREME PRECISION and return accurate JSON.

STEP 1: IDENTIFY THE GARMENT TYPE
Ask yourself: "What am I looking at?"
- Does this cover the upper body (chest, shoulders, arms)? → TOPS
- Does this cover the lower body (waist, hips, legs)? → BOTTOMS  
- Does this go over other clothes for warmth/weather? → OUTERWEAR
- Does this go on feet? → FOOTWEAR
- Is this an add-on item (jewelry, belts, bags, etc)? → ACCESSORIES

STEP 2: SUBCATEGORY - USE EXACT ENUM VALUES
OUTERWEAR: coats, jackets, blazers, hoodies, sweaters, cardigans
TOPS: tee_shirts, button_ups, polo_shirts, tank_tops, sweatshirts, blouses
BOTTOMS: jeans, pants, shorts, skirts, leggings, dress_pants
FOOTWEAR: sneakers, dress_shoes, boots, sandals, heels, flats
ACCESSORIES: belts, hats, bags, jewelry, scarves, watches

STEP 3: COLOR ANALYSIS - BE EXTREMELY PRECISE
Study the actual fabric color in the image:
- Pure white = #FFFFFF
- Off-white/cream = #F5F5DC
- Pure black = #000000
- Navy blue = #000080
- Light blue = #ADD8E6
- Royal blue = #4169E1
- Red = #FF0000
- Dark red/burgundy = #800020
- Gray = #808080
- Dark gray = #696969
- Light gray = #D3D3D3
- Green = #008000
- Brown = #8B4513
- Beige = #F5F5DC
- Yellow = #FFFF00
- Pink = #FFC0CB
- Purple = #800080

STEP 4: FORMALITY ANALYSIS - DETAILED RULES
ATHLETIC (score 1-2): gym shorts, athletic shirts, workout gear, sneakers, sports jerseys
CASUAL (score 3-5): t-shirts, jeans, casual shorts, hoodies, casual sneakers, tank tops
BUSINESS (score 6-8): button-up shirts, dress shirts, polo shirts, dress pants, khakis, blazers
FORMAL (score 9-10): suits, ties, formal dresses, evening wear, dress shoes, formal jackets

EXAMPLES:
• White button-up shirt = business formality + #FFFFFF color
• Blue jeans = casual formality + appropriate blue hex
• Black dress pants = business formality + #000000 color
• Gray athletic shorts = athletic formality + gray hex
• Red polo shirt = business formality + red hex

Return JSON in this EXACT format:
{
  "category": "outerwear|tops|bottoms|footwear|accessories",
  "subcategory": "MUST USE EXACT ENUM: tee_shirts|button_ups|polo_shirts|tank_tops|sweatshirts|blouses|jeans|pants|shorts|skirts|leggings|dress_pants|coats|jackets|blazers|hoodies|sweaters|cardigans|sneakers|dress_shoes|boots|sandals|heels|flats|belts|hats|bags|jewelry|scarves|watches",
  "color_primary": "exact hex code from color list above",
  "color_secondary": "hex code of secondary color or null",
  "material": "cotton|denim|wool|polyester|silk|leather|nylon|spandex|linen|cashmere",
  "formality": "athletic|casual|business|formal",
  "season": ["spring", "summer", "fall", "winter", "all_seasons"],
  "occasion": ["casual", "work", "formal", "party", "sports", "date"],
  "description": "detailed description with actual colors and style",
  "confidence": 0.85
}

CRITICAL ACCURACY REQUIREMENTS:
✓ PANTS/TROUSERS/JEANS = "bottoms" category (NOT tops!)
✓ SHIRTS/BLOUSES/TOPS = "tops" category (NOT bottoms!)
✓ Look at ACTUAL color in image, not assumed color
✓ White dress shirt = #FFFFFF + business formality
✓ Confidence should be 0.85-0.95 for clear, well-lit images

DOUBLE-CHECK: Does this item go on the upper body or lower body? Category must match!`
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