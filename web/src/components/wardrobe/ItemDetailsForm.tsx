import { useState } from 'react';
import { ClothingCategory, ClothingSubcategory, Season, Occasion } from '../../types/wardrobe';

interface ItemDetailsFormProps {
  category: ClothingCategory;
  subcategory?: ClothingSubcategory;
  onDetailsChange: (details: ItemDetails) => void;
  initialData?: ItemDetails;
}

export interface ItemDetails {
  name: string;
  color_primary: string;
  color_secondary?: string;
  brand?: string;
  size?: string;
  material?: string;
  season: Season[];
  occasion: Occasion[];
  tags: string[];
  is_favorite: boolean;
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Brown', value: '#A16207' },
  { name: 'Navy', value: '#1E3A8A' },
  { name: 'Beige', value: '#D6D3D1' },
];

export default function ItemDetailsForm({ 
  category, 
  subcategory, 
  onDetailsChange, 
  initialData 
}: ItemDetailsFormProps) {
  const [details, setDetails] = useState<ItemDetails>(initialData || {
    name: '',
    color_primary: '',
    color_secondary: '',
    brand: '',
    size: '',
    material: '',
    season: [Season.ALL_SEASONS],
    occasion: [Occasion.CASUAL],
    tags: [],
    is_favorite: false
  });

  const [tagInput, setTagInput] = useState('');

  const updateDetails = (updates: Partial<ItemDetails>) => {
    const newDetails = { ...details, ...updates };
    setDetails(newDetails);
    onDetailsChange(newDetails);
  };

  const addTag = () => {
    if (tagInput.trim() && !details.tags.includes(tagInput.trim())) {
      const newTags = [...details.tags, tagInput.trim()];
      updateDetails({ tags: newTags });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    const newTags = details.tags.filter(t => t !== tag);
    updateDetails({ tags: newTags });
  };

  const toggleSeason = (season: Season) => {
    let newSeasons = [...details.season];
    if (newSeasons.includes(season)) {
      newSeasons = newSeasons.filter(s => s !== season);
    } else {
      newSeasons.push(season);
    }
    if (newSeasons.length === 0) {
      newSeasons = [Season.ALL_SEASONS];
    }
    updateDetails({ season: newSeasons });
  };

  const toggleOccasion = (occasion: Occasion) => {
    let newOccasions = [...details.occasion];
    if (newOccasions.includes(occasion)) {
      newOccasions = newOccasions.filter(o => o !== occasion);
    } else {
      newOccasions.push(occasion);
    }
    if (newOccasions.length === 0) {
      newOccasions = [Occasion.CASUAL];
    }
    updateDetails({ occasion: newOccasions });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Item Details</h3>
        <p className="text-gray-400">Tell us more about this {subcategory || category}</p>
      </div>

      {/* Basic Info */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <span className="mr-2">📝</span>
          Basic Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Item Name *
            </label>
            <input
              type="text"
              value={details.name}
              onChange={(e) => updateDetails({ name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Blue Cotton T-Shirt"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Brand
            </label>
            <input
              type="text"
              value={details.brand}
              onChange={(e) => updateDetails({ brand: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Nike, Zara, Uniqlo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Size
            </label>
            <input
              type="text"
              value={details.size}
              onChange={(e) => updateDetails({ size: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., M, Large, 32x34"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Material
            </label>
            <input
              type="text"
              value={details.material}
              onChange={(e) => updateDetails({ material: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., Cotton, Denim, Wool"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <span className="mr-2">🎨</span>
          Colors
        </h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Color *
            </label>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => updateDetails({ color_primary: color.value })}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    details.color_primary === color.value
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Secondary Color (Optional)
            </label>
            <div className="grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => updateDetails({ color_secondary: '' })}
                className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                  !details.color_secondary
                    ? 'border-blue-500 bg-gray-700'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-800'
                }`}
              >
                <span className="text-gray-400 text-xs">None</span>
              </button>
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => updateDetails({ color_secondary: color.value })}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    details.color_secondary === color.value
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Season & Occasion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
          <h4 className="text-lg font-medium text-white mb-4 flex items-center">
            <span className="mr-2">🌤️</span>
            Seasons
          </h4>
          <div className="space-y-2">
            {Object.values(Season).map((season) => (
              <button
                key={season}
                type="button"
                onClick={() => toggleSeason(season)}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  details.season.includes(season)
                    ? 'bg-blue-600/30 border border-blue-500/50 text-blue-200'
                    : 'bg-gray-900/30 border border-gray-600 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {season.charAt(0).toUpperCase() + season.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
          <h4 className="text-lg font-medium text-white mb-4 flex items-center">
            <span className="mr-2">🎭</span>
            Occasions
          </h4>
          <div className="space-y-2">
            {Object.values(Occasion).map((occasion) => (
              <button
                key={occasion}
                type="button"
                onClick={() => toggleOccasion(occasion)}
                className={`w-full p-3 rounded-lg text-left transition-all ${
                  details.occasion.includes(occasion)
                    ? 'bg-purple-600/30 border border-purple-500/50 text-purple-200'
                    : 'bg-gray-900/30 border border-gray-600 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {occasion.charAt(0).toUpperCase() + occasion.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
        <h4 className="text-lg font-medium text-white mb-4 flex items-center">
          <span className="mr-2">🏷️</span>
          Tags
        </h4>
        
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              className="flex-1 px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Add a tag..."
            />
            <button
              type="button"
              onClick={addTag}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          
          {details.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {details.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm flex items-center space-x-2"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Favorite */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-6">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={details.is_favorite}
            onChange={(e) => updateDetails({ is_favorite: e.target.checked })}
            className="w-5 h-5 rounded border-gray-600 text-pink-600 focus:ring-pink-500 focus:ring-2"
          />
          <div className="flex items-center space-x-2">
            <span className="text-lg">❤️</span>
            <span className="text-white font-medium">Mark as Favorite</span>
          </div>
        </label>
      </div>
    </div>
  );
}