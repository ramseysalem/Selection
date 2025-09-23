import { useState } from 'react';
import { WardrobeItem, CLOTHING_CATEGORIES } from '../../types/wardrobe';
import { useAuthStore } from '../../stores/authStore';

interface WardrobeItemCardProps {
  item: WardrobeItem;
  onEdit: (item: WardrobeItem) => void;
  onDelete: (itemId: string) => void;
  onToggleFavorite: (itemId: string) => void;
}

export default function WardrobeItemCard({ 
  item, 
  onEdit, 
  onDelete, 
  onToggleFavorite 
}: WardrobeItemCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { accessToken } = useAuthStore();

  const categoryInfo = CLOTHING_CATEGORIES.find(c => c.id === item.category);
  const subcategoryInfo = categoryInfo?.subcategories.find(s => s.id === item.subcategory);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleToggleFavorite = async () => {
    try {
      const response = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: JSON.stringify({ is_favorite: !item.is_favorite })
        })
      });

      if (response.ok) {
        onToggleFavorite(item.id);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
    }
  };

  return (
    <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden hover:transform hover:scale-105 transition-all duration-200 group relative">
      {/* Image Container */}
      <div className="aspect-square relative bg-gray-900">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl">⏳</div>
          </div>
        )}
        
        {!imageError ? (
          <img
            src={`/api/wardrobe/${item.id}/image`}
            alt={item.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="text-4xl mb-2">{categoryInfo?.emoji || '👗'}</div>
              <div className="text-gray-400 text-xs">Image unavailable</div>
            </div>
          </div>
        )}

        {/* Favorite Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            console.log('Favorite button clicked!'); // Add this for debugging
            handleToggleFavorite();
          }}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
            item.is_favorite
              ? 'bg-red-500/80 text-white'
              : 'bg-black/40 text-gray-300 hover:bg-red-500/80 hover:text-white'
          }`}
        >
          <span className="text-sm">❤️</span>
        </button>

        {/* Menu Button */}
        <div className="absolute top-2 left-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('Menu button clicked, current showMenu:', showMenu);
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 rounded-full bg-black/80 text-white hover:bg-gray-600 flex items-center justify-center transition-all duration-200 relative z-20 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          >
            <span className="text-sm font-bold">⋯</span>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-32">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Edit button clicked for item:', item.name);
                  onEdit(item);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors flex items-center space-x-2"
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Delete button clicked for item:', item.name);
                  handleDelete();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors flex items-center space-x-2"
              >
                <span>🗑️</span>
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 pointer-events-none" />
      </div>
      
      {/* Item Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium mb-1 truncate" title={item.name}>
              {item.name}
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              {item.brand && (
                <span className="font-medium">{item.brand}</span>
              )}
              {item.brand && subcategoryInfo && ' • '}
              {subcategoryInfo?.name || categoryInfo?.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Primary Color */}
            <div 
              className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0"
              style={{ backgroundColor: item.color_primary }}
              title="Primary color"
            />
            {/* Secondary Color */}
            {item.color_secondary && (
              <div 
                className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0"
                style={{ backgroundColor: item.color_secondary }}
                title="Secondary color"
              />
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            {item.size && (
              <span className="bg-gray-700/50 px-2 py-1 rounded">{item.size}</span>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-gray-400 text-xs">
                +{item.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Occasions */}
        {item.occasion.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.occasion.slice(0, 2).map((occasion) => (
              <span
                key={occasion}
                className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs"
              >
                {occasion}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}