import { useState } from 'react';
import { CLOTHING_CATEGORIES, ClothingCategory, ClothingSubcategory } from '../../types/wardrobe';

interface CategorySelectorProps {
  onCategorySelect: (category: ClothingCategory, subcategory?: ClothingSubcategory) => void;
  selectedCategory?: ClothingCategory;
  selectedSubcategory?: ClothingSubcategory;
}

export default function CategorySelector({ 
  onCategorySelect, 
  selectedCategory, 
  selectedSubcategory 
}: CategorySelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<ClothingCategory | null>(selectedCategory || null);

  const handleCategoryClick = (category: ClothingCategory) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
      onCategorySelect(category);
    }
  };

  const handleSubcategoryClick = (category: ClothingCategory, subcategory: ClothingSubcategory) => {
    onCategorySelect(category, subcategory);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Choose Category</h3>
        <p className="text-gray-400">Select the type of clothing item you're adding</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {CLOTHING_CATEGORIES.map((category) => (
          <div key={category.id} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => handleCategoryClick(category.id)}
              className={`w-full p-4 text-left flex items-center justify-between transition-all duration-200 hover:bg-gray-700/50 ${
                selectedCategory === category.id ? 'bg-blue-600/20 border-b border-gray-600' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{category.emoji}</span>
                <div>
                  <div className="text-white font-medium">{category.name}</div>
                  <div className="text-gray-400 text-sm">{category.description}</div>
                </div>
              </div>
              <div className={`transform transition-transform duration-200 ${
                expandedCategory === category.id ? 'rotate-180' : ''
              }`}>
                <span className="text-gray-400">▼</span>
              </div>
            </button>

            {/* Subcategories */}
            {expandedCategory === category.id && (
              <div className="p-2 bg-gray-900/30">
                <div className="grid grid-cols-2 gap-2">
                  {category.subcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      onClick={() => handleSubcategoryClick(category.id, subcategory.id)}
                      className={`p-3 rounded-lg text-left transition-all duration-200 hover:bg-gray-700/50 ${
                        selectedSubcategory === subcategory.id 
                          ? 'bg-purple-600/30 border border-purple-500/50' 
                          : 'bg-gray-800/50 border border-gray-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{subcategory.emoji}</span>
                        <span className="text-white text-sm font-medium">{subcategory.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}