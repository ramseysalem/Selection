import { OpenAI } from 'openai';

// Define a local interface for the AI analysis
interface ClothingItem {
  category: 'shirt' | 'pants' | 'dress' | 'jacket' | 'shoes' | 'accessory';
  colors: {
    primary: string;
    secondary?: string;
  };
  pattern?: string;
  styleTags: string[];
  materials: string[];
  description: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ImageAnalysisResult {
  category: ClothingItem['category'];
  colors: {
    primary: string;
    secondary?: string;
  };
  pattern?: string;
  styleTags: string[];
  materials: string[];
  description: string;
}

export async function analyzeClothingItem(imageBuffer: Buffer): Promise<ImageAnalysisResult> {
  // Simplified approach using only OpenAI Vision API
  const visionAnalysis = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this clothing item and return a JSON object with:
              - category (shirt/pants/dress/jacket/shoes/accessory)
              - colors (primary and secondary hex codes)
              - pattern type
              - style characteristics (casual/formal/etc)
              - material appearance
              - detailed description`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
            }
          }
        ]
      }
    ]
  });
  
  // Parse the results
  const analysis = JSON.parse(visionAnalysis.choices[0].message.content || '{}');
  
  return {
    category: analysis.category,
    colors: {
      primary: analysis.colors?.primary || '#000000',
      secondary: analysis.colors?.secondary,
    },
    pattern: analysis.pattern,
    styleTags: analysis.style_characteristics || [],
    materials: analysis.material_appearance ? [analysis.material_appearance] : [],
    description: analysis.detailed_description || 'Clothing item',
  };
}

// Simplified helper functions - no TensorFlow needed for OpenAI approach

function validateHexColor(color: string): string | null {
  if (!color) return null;
  
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Check if valid hex color (3 or 6 characters)
  if (/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    return '#' + hex.toUpperCase();
  }
  
  return null;
}

export async function generateOutfit(
  userId: string,
  occasion: string,
  weather: { temperature: number; condition: string }
): Promise<ClothingItem[]> {
  // Implementation will be added later
  return [];
}
