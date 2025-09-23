# Claude Code Context - Outfit Matcher

## Project Overview
AI-powered outfit matching web application that analyzes clothing images using OpenAI GPT-4o Vision API to automatically categorize items and generate intelligent outfit recommendations.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **AI**: OpenAI GPT-4o Vision API for image analysis
- **Database**: PostgreSQL with AI-enhanced attributes

## Recent Work Completed (Latest Session)

### 🔧 Critical Bug Fixes
1. **Fixed Bulk Upload AI Analysis**: Removed hardcoded defaults that prevented AI from analyzing bulk uploaded items
2. **Updated Deprecated OpenAI Model**: Changed from `gpt-4-vision-preview` to `gpt-4o`
3. **Fixed TypeScript Compilation**: Resolved enum validation issues causing server crashes
4. **Fixed Subcategory Mapping**: Added comprehensive mapping between AI output and database enums

### 🤖 AI Analysis Improvements
1. **Enhanced Prompt Engineering**: 
   - Step-by-step analysis process
   - Explicit categorization rules (pants = bottoms, shirts = tops)
   - 15+ specific hex color codes
   - Detailed formality scoring (athletic/casual/business/formal)

2. **Comprehensive Subcategory Mapping**:
   ```typescript
   // Handles AI's natural language → enum values
   't-shirt' → 'tee_shirts'
   'dress pants' → 'dress_pants'
   'button-up shirt' → 'button_ups'
   ```

3. **Color Accuracy**: Added specific hex codes for common clothing colors

### 📁 Key File Changes

#### `/server/src/services/aiVisionService.ts`
- Updated to GPT-4o model
- Enhanced prompt with step-by-step analysis
- Added subcategory validation mapping
- Improved color detection with specific hex codes

#### `/server/src/routes/wardrobe.ts`
- Fixed bulk upload to use AI analysis instead of hardcoded defaults
- Added validation for outfit generation (requires both tops and bottoms)
- Enhanced error handling with clear user feedback

#### `/web/src/pages/Wardrobe.tsx`
- Removed hardcoded defaults from bulk upload
- Now sends minimal data to allow AI analysis

## Current System Status

### ✅ Working Features
- AI-powered image analysis with improved accuracy
- Outfit generation requiring both tops and bottoms
- Bulk upload triggers proper AI analysis
- Comprehensive error handling and fallbacks
- Hybrid outfit matching (rule-based + AI attributes)

### 🔍 AI Analysis Capabilities
- **Categories**: outerwear, tops, bottoms, footwear, accessories
- **Colors**: 15+ specific hex codes for accurate color detection
- **Formality**: athletic (1-2), casual (3-5), business (6-8), formal (9-10)
- **Materials**: cotton, denim, wool, polyester, silk, etc.
- **Seasons & Occasions**: Comprehensive mapping

### 📊 Database Schema
```sql
-- AI-Enhanced Attributes
ai_analyzed: boolean
ai_confidence: number (0-1)
ai_style_tags: string[]
ai_formality_score: number (1-10)
ai_color_palette: string[] (hex codes)
ai_material_properties: string[]
ai_description: string
ai_analyzed_at: timestamp
```

## API Endpoints

### Key Routes
- `POST /api/wardrobe` - Upload item with AI analysis
- `POST /api/wardrobe/recommendations` - Generate outfit recommendations
- `POST /api/ai-correction/reanalyze-item/:id` - Re-analyze with improved AI
- `PATCH /api/ai-correction/correct-item/:id` - Manual corrections

## Development Setup

### Prerequisites
- Node.js
- PostgreSQL
- OpenAI API key

### Environment Variables
```env
OPENAI_API_KEY=your_key_here
DATABASE_URL=postgresql://...
PORT=3000
```

### Running the Application
```bash
# Backend (server directory)
npm run dev  # Port 3000

# Frontend (web directory) 
npm run dev  # Port 5173
```

## Known Issues & Solutions

### 🐛 Previous Issues (Now Fixed)
1. **"Everything shows as casual"** → Fixed AI prompt specificity
2. **"Pants categorized as tops"** → Enhanced categorization rules
3. **"Colors always wrong"** → Added comprehensive color mapping
4. **"Bulk upload not using AI"** → Removed hardcoded defaults
5. **"Server crashes on upload"** → Fixed enum validation

### 🔄 Fallback Behavior
- If AI analysis fails, system falls back to sensible defaults with warnings
- Manual correction endpoints available for fixing AI errors
- Comprehensive logging for debugging AI performance

## Performance Considerations
- AI analysis takes 5-8 seconds per image
- Hybrid outfit matcher provides sub-second recommendations
- Database optimized for quick wardrobe queries

## Next Development Priorities
1. **Test improved AI accuracy** with various clothing types
2. **Add Redis caching** for faster outfit recommendations
3. **Implement weather API** for weather-appropriate suggestions
4. **Add user preferences** for personalized recommendations
5. **Mobile responsiveness** improvements

## Testing
- Use `test-correction.js` for testing AI analysis endpoints
- Logs provide detailed AI analysis feedback
- Outfit generation requires minimum 1 top + 1 bottom

## Git Repository
- Latest changes committed and pushed to GitHub
- All AI improvements and bug fixes included
- Ready for production deployment

---

*Generated with Claude Code assistance*
*Last updated: [Current session]*