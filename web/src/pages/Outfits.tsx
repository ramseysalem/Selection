import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

interface SavedOutfit {
  id: string;
  name: string;
  top_item_id: string;
  bottom_item_id: string;
  occasion: string;
  weather_temp?: number;
  weather_description?: string;
  notes?: string;
  is_favorite: boolean;
  created_at: string;
}

const OUTFIT_OCCASIONS = [
  { value: 'casual', name: 'Casual', emoji: '👕' },
  { value: 'business', name: 'Business', emoji: '💼' },
  { value: 'formal', name: 'Formal', emoji: '🤵' },
  { value: 'party', name: 'Party', emoji: '🎉' },
  { value: 'date', name: 'Date', emoji: '💖' },
  { value: 'sports', name: 'Sports', emoji: '🏃' },
  { value: 'travel', name: 'Travel', emoji: '✈️' },
  { value: 'weekend', name: 'Weekend', emoji: '🏠' }
];

export default function Outfits() {
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const { accessToken } = useAuthStore();

  const fetchOutfits = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const endpoint = selectedOccasion 
        ? `/api/outfits/occasion/${selectedOccasion}`
        : '/api/outfits';
        
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch outfits');
      }

      const data = await response.json();
      setOutfits(data.outfits || []);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutfits();
  }, [accessToken, selectedOccasion]);

  const handleDeleteOutfit = async (outfitId: string) => {
    if (!window.confirm('Are you sure you want to delete this outfit?')) return;

    try {
      const response = await fetch(`/api/outfits/${outfitId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        setOutfits(outfits.filter(outfit => outfit.id !== outfitId));
      }
    } catch (error) {
      setError('Failed to delete outfit');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-300">Loading your outfits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="w-full flex justify-center">
        <div className="max-w-7xl w-full py-12 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">✨</div>
            <h1 className="text-4xl font-bold text-white mb-4">Saved Outfits</h1>
            <p className="text-gray-300 text-lg">📚 Your saved outfit combinations</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Occasion Filters */}
          <div className="mb-8 bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setSelectedOccasion(null)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                  selectedOccasion === null
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50'
                }`}
              >
                <span>👗</span>
                <span>All Outfits</span>
              </button>
              {OUTFIT_OCCASIONS.map((occasion) => (
                <button
                  key={occasion.value}
                  onClick={() => setSelectedOccasion(
                    selectedOccasion === occasion.value ? null : occasion.value
                  )}
                  className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                    selectedOccasion === occasion.value
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50'
                  }`}
                >
                  <span>{occasion.emoji}</span>
                  <span>{occasion.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Outfits Grid */}
          {outfits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {outfits.map((outfit) => (
                <div key={outfit.id} className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden hover:transform hover:scale-105 transition-all duration-200 group relative">
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteOutfit(outfit.id)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 text-white hover:bg-red-600 flex items-center justify-center transition-all duration-200 z-10 opacity-0 group-hover:opacity-100"
                  >
                    <span className="text-sm">🗑️</span>
                  </button>

                  {/* Outfit Content */}
                  <div className="p-6">
                    <div className="text-center">
                      <h3 className="text-white font-medium mb-2">{outfit.name}</h3>
                      
                      {/* Occasion Badge */}
                      <div className="mb-4">
                        {OUTFIT_OCCASIONS.find(o => o.value === outfit.occasion) && (
                          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                            {OUTFIT_OCCASIONS.find(o => o.value === outfit.occasion)?.emoji} {OUTFIT_OCCASIONS.find(o => o.value === outfit.occasion)?.name}
                          </span>
                        )}
                      </div>

                      {/* Outfit Items Preview */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                          <img
                            src={`/api/wardrobe/${outfit.top_item_id}/image`}
                            alt="Top"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                          <img
                            src={`/api/wardrobe/${outfit.bottom_item_id}/image`}
                            alt="Bottom"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Weather Info */}
                      {outfit.weather_temp && (
                        <div className="text-xs text-gray-400 mb-2">
                          🌡️ {outfit.weather_temp}°F
                          {outfit.weather_description && ` • ${outfit.weather_description}`}
                        </div>
                      )}

                      {/* Notes */}
                      {outfit.notes && (
                        <div className="text-xs text-gray-400 italic mb-2">
                          "{outfit.notes}"
                        </div>
                      )}

                      {/* Date */}
                      <div className="text-xs text-gray-500">
                        Saved {new Date(outfit.created_at).toLocaleDateString()}
                      </div>

                      {/* Favorite Icon */}
                      {outfit.is_favorite && (
                        <div className="absolute top-2 left-2">
                          <span className="text-red-400">❤️</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-8xl mb-6">📂</div>
              <h3 className="text-2xl font-semibold text-white mb-4">No saved outfits yet</h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                {selectedOccasion 
                  ? `No ${OUTFIT_OCCASIONS.find(o => o.value === selectedOccasion)?.name.toLowerCase()} outfits found`
                  : 'Start creating outfits on the home page and save your favorites here'
                }
              </p>
              <button
                onClick={() => setSelectedOccasion(null)}
                className="bg-gray-700/50 hover:bg-gray-600/50 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 border border-gray-600"
              >
                {selectedOccasion ? 'Show All Outfits' : 'Go to Home Page'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}