import { wardrobeStore } from '../models/WardrobeItemPG';
import { aiVisionService } from './aiVisionService';

interface BatchProcessingStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  remaining: number;
}

class WardrobeBatchProcessor {
  private isProcessing = false;
  private stats: BatchProcessingStats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    remaining: 0
  };

  async processUnanalyzedItems(userId: string, batchSize: number = 5): Promise<BatchProcessingStats> {
    if (this.isProcessing) {
      throw new Error('Batch processing already in progress');
    }

    console.log('🔄 [BATCH] Starting wardrobe batch processing...');
    this.isProcessing = true;
    
    try {
      // Get items that haven't been AI analyzed
      const unanalyzedItems = await wardrobeStore.findUnanalyzedByUserId(userId);
      
      this.stats = {
        total: unanalyzedItems.length,
        processed: 0,
        successful: 0,
        failed: 0,
        remaining: unanalyzedItems.length
      };

      console.log(`📊 [BATCH] Found ${unanalyzedItems.length} items to analyze`);

      if (unanalyzedItems.length === 0) {
        console.log('✅ [BATCH] All items already analyzed!');
        return this.stats;
      }

      // Process in batches to avoid rate limiting
      const batches = this.chunkArray(unanalyzedItems, batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📦 [BATCH] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...`);
        
        // Process batch items in parallel
        const batchPromises = batch.map(item => this.processIndividualItem(item));
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Update stats
        batchResults.forEach(result => {
          this.stats.processed++;
          this.stats.remaining--;
          
          if (result.status === 'fulfilled') {
            this.stats.successful++;
            console.log(`✅ [BATCH] Item processed successfully`);
          } else {
            this.stats.failed++;
            console.log(`❌ [BATCH] Item failed:`, result.reason);
          }
        });

        // Rate limiting delay between batches
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ [BATCH] Waiting 2s before next batch...`);
          await this.sleep(2000);
        }
      }

      console.log(`🎉 [BATCH] Completed! ${this.stats.successful}/${this.stats.total} successful`);
      return this.stats;

    } finally {
      this.isProcessing = false;
    }
  }

  private async processIndividualItem(item: any): Promise<void> {
    try {
      console.log(`🤖 [BATCH] Analyzing "${item.name}"...`);
      
      // Use AI to analyze the image
      const analysis = await aiVisionService.analyzeClothingImage(
        item.image_data, 
        item.image_mime_type
      );

      // Extract enhanced attributes for hybrid system
      const enhancedAttributes = {
        ai_analyzed: true,
        ai_confidence: analysis.confidence,
        ai_style_tags: this.extractStyleTags(analysis),
        ai_formality_score: this.calculateFormalityScore(analysis.formality),
        ai_color_palette: this.extractColorPalette(analysis),
        ai_material_properties: this.extractMaterialProperties(analysis),
        ai_description: analysis.description,
        ai_analyzed_at: new Date()
      };

      // Update item in database with AI attributes
      await wardrobeStore.updateAIAttributes(item.id, enhancedAttributes);
      
      console.log(`✅ [BATCH] "${item.name}" analyzed - formality: ${enhancedAttributes.ai_formality_score}/10, confidence: ${Math.round(analysis.confidence * 100)}%`);

    } catch (error) {
      console.error(`❌ [BATCH] Failed to analyze "${item.name}":`, error);
      
      // Mark as analyzed but with low confidence to avoid reprocessing
      await wardrobeStore.updateAIAttributes(item.id, {
        ai_analyzed: true,
        ai_confidence: 0.1,
        ai_analyzed_at: new Date()
      });
      
      throw error;
    }
  }

  private extractStyleTags(analysis: any): string[] {
    const tags = [];
    
    // Add formality tag
    tags.push(analysis.formality);
    
    // Add season tags
    if (analysis.season) {
      tags.push(...analysis.season);
    }
    
    // Add occasion tags
    if (analysis.occasion) {
      tags.push(...analysis.occasion);
    }
    
    // Add material tag if available
    if (analysis.material) {
      tags.push(analysis.material);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private calculateFormalityScore(formality: string): number {
    const formalityMap: Record<string, number> = {
      'athletic': 1,
      'casual': 3,
      'business': 7,
      'formal': 9
    };
    
    return formalityMap[formality] || 5; // Default to middle
  }

  private extractColorPalette(analysis: any): string[] {
    const colors = [analysis.color_primary];
    
    if (analysis.color_secondary) {
      colors.push(analysis.color_secondary);
    }
    
    return colors;
  }

  private extractMaterialProperties(analysis: any): string[] {
    const properties = [];
    
    // Infer properties from material and description
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
    
    if (description.includes('waterproof') || description.includes('rain')) {
      properties.push('waterproof');
    }
    
    return properties;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(): BatchProcessingStats {
    return { ...this.stats };
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const wardrobeBatchProcessor = new WardrobeBatchProcessor();