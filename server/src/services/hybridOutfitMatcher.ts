import { WardrobeItem } from '../models/WardrobeItemPG';

// Color harmony rules for fast outfit matching
const COLOR_HARMONIES = {
  // Complementary colors work well together
  complementary: {
    '#FF0000': ['#00FF00', '#008000'], // Red with green
    '#0000FF': ['#FFA500', '#FF8C00'], // Blue with orange
    '#FFFF00': ['#800080', '#4B0082'], // Yellow with purple
  },
  
  // Analogous colors (next to each other on color wheel)
  analogous: {
    '#FF0000': ['#FF8000', '#FF0080'], // Red with orange-red, red-purple
    '#0000FF': ['#0080FF', '#8000FF'], // Blue with blue-cyan, blue-purple
    '#00FF00': ['#80FF00', '#00FF80'], // Green with yellow-green, blue-green
  },
  
  // Neutral colors that go with everything
  neutrals: ['#000000', '#FFFFFF', '#808080', '#C0C0C0', '#696969', '#000080', '#8B4513'],
  
  // Safe professional combinations
  professional: {
    '#000080': ['#FFFFFF', '#C0C0C0', '#D3D3D3'], // Navy with whites/grays
    '#000000': ['#FFFFFF', '#C0C0C0', '#FF0000'], // Black with whites/gray/red
    '#8B4513': ['#F5DEB3', '#FFFFFF', '#000080'], // Brown with cream/white/navy
  }
};

// Weather and material compatibility
const WEATHER_MATERIAL_RULES = {
  cold: {
    preferred: ['wool', 'fleece', 'cashmere', 'down'],
    avoid: ['linen', 'cotton', 'silk'],
    formality_boost: 1 // Cold weather tends to be more formal
  },
  warm: {
    preferred: ['cotton', 'linen', 'silk', 'rayon'],
    avoid: ['wool', 'fleece', 'heavy'],
    formality_boost: -1 // Warm weather tends to be more casual
  },
  rainy: {
    preferred: ['waterproof', 'synthetic', 'treated'],
    avoid: ['suede', 'leather', 'canvas'],
    formality_boost: -1 // Rain gear tends to be casual
  }
};

// Occasion formality requirements
const OCCASION_FORMALITY = {
  'casual': { min: 1, max: 4 },
  'work': { min: 5, max: 8 },
  'business': { min: 6, max: 9 },
  'formal': { min: 8, max: 10 },
  'athletic': { min: 1, max: 2 },
  'date': { min: 4, max: 8 },
  'party': { min: 3, max: 9 }
};

interface OutfitRecommendation {
  top: WardrobeItem;
  bottom: WardrobeItem;
  confidence: number;
  reasoning: string;
  color_harmony_score: number;
  formality_match_score: number;
  weather_compatibility_score: number;
}

interface MatchingContext {
  occasion?: string;
  weather?: { temperature: number; description: string };
  formality_preference?: number; // 1-10 scale
  color_preferences?: string[];
  avoid_colors?: string[];
}

class HybridOutfitMatcher {
  
  generateRecommendations(
    wardrobeItems: WardrobeItem[], 
    context: MatchingContext
  ): OutfitRecommendation[] {
    console.log('⚡ [HYBRID] Starting rule-based outfit matching...');
    console.log(`👔 [HYBRID] Available items: ${wardrobeItems.length}`);
    console.log(`🎪 [HYBRID] Context:`, context);

    // Filter and categorize items
    const tops = wardrobeItems.filter(item => 
      item.category === 'outerwear' || item.category === 'tops'
    );
    const bottoms = wardrobeItems.filter(item => 
      item.category === 'bottoms'
    );

    console.log(`👕 [HYBRID] Found ${tops.length} tops, ${bottoms.length} bottoms`);

    if (tops.length === 0 || bottoms.length === 0) {
      console.log('❌ [HYBRID] Insufficient items for outfit generation');
      return [];
    }

    // Generate all possible combinations
    const combinations: OutfitRecommendation[] = [];
    
    for (const top of tops) {
      for (const bottom of bottoms) {
        const recommendation = this.evaluateOutfitCombination(top, bottom, context);
        if (recommendation.confidence > 0.3) { // Only keep decent matches
          combinations.push(recommendation);
        }
      }
    }

    // Sort by confidence and return top 3 recommendations
    combinations.sort((a, b) => b.confidence - a.confidence);
    const topRecommendations = combinations.slice(0, 3);

    console.log(`🎯 [HYBRID] Generated ${topRecommendations.length} recommendations`);
    
    return topRecommendations;
  }

  private evaluateOutfitCombination(
    top: WardrobeItem, 
    bottom: WardrobeItem, 
    context: MatchingContext
  ): OutfitRecommendation {
    
    // Calculate component scores
    const colorScore = this.calculateColorHarmony(top.color_primary, bottom.color_primary);
    const formalityScore = this.calculateFormalityMatch(top, bottom, context);
    const weatherScore = this.calculateWeatherCompatibility(top, bottom, context);
    const occasionScore = this.calculateOccasionMatch(top, bottom, context);

    // Weighted final confidence score
    const confidence = (
      colorScore * 0.3 +           // Color harmony is important
      formalityScore * 0.3 +       // Formality matching is crucial  
      weatherScore * 0.2 +         // Weather appropriateness
      occasionScore * 0.2          // Occasion appropriateness
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      top, bottom, context, 
      { colorScore, formalityScore, weatherScore, occasionScore }
    );

    return {
      top,
      bottom,
      confidence: Math.min(confidence, 1.0),
      reasoning,
      color_harmony_score: colorScore,
      formality_match_score: formalityScore,
      weather_compatibility_score: weatherScore
    };
  }

  private calculateColorHarmony(color1: string, color2: string): number {
    const c1 = this.normalizeColor(color1);
    const c2 = this.normalizeColor(color2);

    // Check if either color is neutral (always works)
    if (COLOR_HARMONIES.neutrals.includes(c1) || COLOR_HARMONIES.neutrals.includes(c2)) {
      return 0.9;
    }

    // Check professional combinations
    const prof1 = (COLOR_HARMONIES.professional as any)[c1];
    const prof2 = (COLOR_HARMONIES.professional as any)[c2];
    if (prof1?.includes(c2) || prof2?.includes(c1)) {
      return 0.95;
    }

    // Check complementary colors
    const comp1 = (COLOR_HARMONIES.complementary as any)[c1];
    const comp2 = (COLOR_HARMONIES.complementary as any)[c2];
    if (comp1?.includes(c2) || comp2?.includes(c1)) {
      return 0.85;
    }

    // Check analogous colors
    const anal1 = (COLOR_HARMONIES.analogous as any)[c1];
    const anal2 = (COLOR_HARMONIES.analogous as any)[c2];
    if (anal1?.includes(c2) || anal2?.includes(c1)) {
      return 0.8;
    }

    // Same color family (decent match)
    if (this.isSimilarColor(c1, c2)) {
      return 0.7;
    }

    // Default for any other combination
    return 0.5;
  }

  private calculateFormalityMatch(
    top: WardrobeItem, 
    bottom: WardrobeItem, 
    context: MatchingContext
  ): number {
    // Get formality scores from AI analysis or estimate from category
    const topFormality = top.ai_formality_score || this.estimateFormalityFromCategory(top);
    const bottomFormality = bottom.ai_formality_score || this.estimateFormalityFromCategory(bottom);
    
    // Check if formalities are reasonably matched (within 3 points)
    const formalityDifference = Math.abs(topFormality - bottomFormality);
    let matchScore = Math.max(0, 1 - (formalityDifference / 6));

    // Check occasion requirements
    if (context.occasion) {
      const requiredFormality = (OCCASION_FORMALITY as any)[context.occasion];
      if (requiredFormality) {
        const avgFormality = (topFormality + bottomFormality) / 2;
        if (avgFormality >= requiredFormality.min && avgFormality <= requiredFormality.max) {
          matchScore *= 1.2; // Boost for meeting occasion requirements
        } else {
          matchScore *= 0.6; // Penalty for not meeting occasion requirements
        }
      }
    }

    return Math.min(matchScore, 1.0);
  }

  private calculateWeatherCompatibility(
    top: WardrobeItem, 
    bottom: WardrobeItem, 
    context: MatchingContext
  ): number {
    if (!context.weather) return 0.8; // Neutral if no weather context

    const temp = context.weather.temperature;
    const condition = context.weather.description.toLowerCase();
    
    let weatherType: keyof typeof WEATHER_MATERIAL_RULES;
    if (temp < 10) weatherType = 'cold';
    else if (temp > 25) weatherType = 'warm';
    else if (condition.includes('rain') || condition.includes('storm')) weatherType = 'rainy';
    else return 0.8; // Neutral weather

    const rules = WEATHER_MATERIAL_RULES[weatherType];
    let score = 0.5;

    // Check top material compatibility
    const topMaterial = top.material?.toLowerCase() || '';
    if (rules.preferred.some(material => topMaterial.includes(material))) {
      score += 0.2;
    }
    if (rules.avoid.some(material => topMaterial.includes(material))) {
      score -= 0.3;
    }

    // Check bottom material compatibility  
    const bottomMaterial = bottom.material?.toLowerCase() || '';
    if (rules.preferred.some(material => bottomMaterial.includes(material))) {
      score += 0.2;
    }
    if (rules.avoid.some(material => bottomMaterial.includes(material))) {
      score -= 0.3;
    }

    return Math.max(0, Math.min(score, 1.0));
  }

  private calculateOccasionMatch(
    top: WardrobeItem, 
    bottom: WardrobeItem, 
    context: MatchingContext
  ): number {
    if (!context.occasion) return 0.8;

    let score = 0.5;

    // Check if items are appropriate for occasion
    if (top.occasion?.includes(context.occasion as any)) {
      score += 0.25;
    }
    if (bottom.occasion?.includes(context.occasion as any)) {
      score += 0.25;
    }

    return Math.min(score, 1.0);
  }

  private generateReasoning(
    top: WardrobeItem, 
    bottom: WardrobeItem, 
    context: MatchingContext,
    scores: { colorScore: number; formalityScore: number; weatherScore: number; occasionScore: number }
  ): string {
    const reasons = [];

    // Color reasoning
    if (scores.colorScore > 0.8) {
      reasons.push(`excellent color harmony between ${top.color_primary} and ${bottom.color_primary}`);
    } else if (scores.colorScore > 0.6) {
      reasons.push(`good color pairing of ${top.color_primary} with ${bottom.color_primary}`);
    }

    // Formality reasoning
    if (scores.formalityScore > 0.8 && context.occasion) {
      reasons.push(`perfect formality level for ${context.occasion}`);
    } else if (scores.formalityScore > 0.6) {
      reasons.push(`appropriate formality balance`);
    }

    // Weather reasoning
    if (context.weather && scores.weatherScore > 0.7) {
      const temp = context.weather.temperature;
      if (temp < 10) reasons.push(`suitable materials for cold weather`);
      else if (temp > 25) reasons.push(`breathable fabrics for warm weather`);
      else if (context.weather.description.includes('rain')) reasons.push(`weather-appropriate materials`);
    }

    // Occasion reasoning
    if (context.occasion && scores.occasionScore > 0.7) {
      reasons.push(`well-suited for ${context.occasion} occasions`);
    }

    const baseReason = reasons.length > 0 
      ? reasons.join(', ')
      : 'basic color and style coordination';

    return `${baseReason} (hybrid rule-based matching)`;
  }

  private normalizeColor(color: string): string {
    // Convert to standard hex format
    if (!color) return '#000000';
    
    const normalized = color.replace('#', '').toUpperCase();
    if (normalized.length === 6) {
      return '#' + normalized;
    }
    if (normalized.length === 3) {
      return '#' + normalized.split('').map(c => c + c).join('');
    }
    
    return '#000000'; // Default to black
  }

  private isSimilarColor(color1: string, color2: string): boolean {
    // Simple color similarity check (could be enhanced with actual color distance)
    const c1 = color1.replace('#', '');
    const c2 = color2.replace('#', '');
    
    // Check if first characters are similar (rough color family check)
    return c1.charAt(0) === c2.charAt(0);
  }

  private estimateFormalityFromCategory(item: WardrobeItem): number {
    // Fallback formality estimation if AI analysis isn't available
    const categoryFormality: Record<string, number> = {
      'outerwear': 6,
      'tops': 4,
      'bottoms': 5,
      'footwear': 5,
      'accessories': 4
    };

    let baseFormality = categoryFormality[item.category] || 5;

    // Adjust based on item name/description
    const name = (item.name || '').toLowerCase();
    if (name.includes('suit') || name.includes('formal')) baseFormality += 3;
    if (name.includes('casual') || name.includes('t-shirt')) baseFormality -= 2;
    if (name.includes('dress')) baseFormality += 2;
    if (name.includes('jeans')) baseFormality -= 1;

    return Math.max(1, Math.min(10, baseFormality));
  }
}

export const hybridOutfitMatcher = new HybridOutfitMatcher();