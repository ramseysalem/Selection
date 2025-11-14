import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { WardrobeItem, ClothingCategory, CLOTHING_CATEGORIES } from '../types/wardrobe';

interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  location: {
    name: string;
    country: string;
  };
}

interface OutfitContext {
  temperature: 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'freezing';
  layers: 'none' | 'light' | 'medium' | 'heavy';
  waterproof: boolean;
  breathable: boolean;
}

const OCCASIONS = [
  { value: 'casual', label: 'Casual', emoji: '😎' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'school', label: 'School', emoji: '📚' },
  { value: 'formal', label: 'Formal', emoji: '🎩' },
  { value: 'semi-formal', label: 'Semi Formal', emoji: '👔' },
  { value: 'active', label: 'Active', emoji: '🏃‍♂️' },
];

export default function Home() {
  const [location, setLocation] = useState('');
  const [occasion, setOccasion] = useState('casual');
  const [suggestedTop, setSuggestedTop] = useState<WardrobeItem | null>(null);
  const [suggestedBottom, setSuggestedBottom] = useState<WardrobeItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [outfitContext, setOutfitContext] = useState<OutfitContext | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  
  const { accessToken } = useAuthStore();

  // Fetch user's wardrobe items
  useEffect(() => {
    if (accessToken) {
      fetchWardrobeItems();
    }
  }, [accessToken]);

  const fetchWardrobeItems = async () => {
    try {
      const response = await fetch('/api/wardrobe', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWardrobeItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch wardrobe items:', error);
    }
  };

  // Get user's location
  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      setIsLoadingWeather(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setCoordinates(coords);
          fetchWeatherByCoordinates(coords.lat, coords.lon);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLoadingWeather(false);
        }
      );
    }
  };

  // Fetch weather by coordinates
  const fetchWeatherByCoordinates = async (lat: number, lon: number) => {
    if (!accessToken) return;
    
    try {
      const response = await fetch(`/api/weather/coordinates?lat=${lat}&lon=${lon}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWeather(data.weather);
        setOutfitContext(data.outfitContext);
        setLocation(`${data.weather.location.name}, ${data.weather.location.country}`);
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Fetch weather by city name
  const fetchWeatherByCity = async (cityName: string) => {
    if (!accessToken || !cityName.trim()) return;
    
    setIsLoadingWeather(true);
    try {
      const response = await fetch(`/api/weather/city?city=${encodeURIComponent(cityName)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWeather(data.weather);
        setOutfitContext(data.outfitContext);
        setCoordinates({ lat: data.weather.location.lat, lon: data.weather.location.lon });
      } else {
        console.error('Weather API error:', response.statusText);
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Auto-detect location on component mount
  useEffect(() => {
    if (accessToken) {
      getUserLocation();
    }
  }, [accessToken]);

  // Enhanced fashion validation function using AI analysis data
  const isValidFashionPairing = (top: WardrobeItem, bottom: WardrobeItem, occasion: string, context: OutfitContext | null) => {
    const topName = top.name.toLowerCase();
    const bottomName = bottom.name.toLowerCase();
    
    // Rule 1: Enhanced Formality Mismatch Prevention
    const isFormalTop = ['dress shirt', 'button-up', 'blouse', 'blazer', 'suit jacket'].some(term => topName.includes(term));
    const isCasualBottom = ['shorts', 'athletic', 'gym', 'sweat'].some(term => bottomName.includes(term));
    const isFormalBottom = ['dress pants', 'trousers', 'slacks', 'suit pants'].some(term => bottomName.includes(term));
    const isCasualTop = ['t-shirt', 'tank', 'casual', 'athletic', 'gym'].some(term => topName.includes(term));
    
    // Prevent: Formal top + Casual bottom (e.g., dress shirt + shorts)
    if (isFormalTop && isCasualBottom) return false;
    
    // Prevent: Casual top + Very formal bottom
    if (isCasualTop && bottomName.includes('suit')) return false;
    
    // Rule 1.5: Fabric Weight Mismatch Prevention
    const isHeavyTop = ['wool', 'sweater', 'hoodie', 'fleece', 'thick'].some(term => topName.includes(term));
    const isLightBottom = ['shorts', 'linen', 'silk', 'chiffon'].some(term => bottomName.includes(term));
    
    // Prevent heavy winter top with summer bottom (unless mild weather)
    if (isHeavyTop && isLightBottom && context?.temperature !== 'mild') return false;
    
    // Rule 2: Occasion Appropriateness
    if (occasion === 'formal' || occasion === 'work') {
      // For formal occasions, avoid shorts completely
      if (bottomName.includes('shorts')) return false;
      // Prefer at least business casual tops
      if (topName.includes('tank') || topName.includes('crop')) return false;
    }
    
    // Rule 3: Weather vs. Style Balance
    if (context?.temperature === 'hot' && occasion === 'formal') {
      // Hot + Formal = lightweight formal pieces, not shorts
      if (bottomName.includes('shorts')) return false;
      // Prefer breathable formal options like linen pants, lightweight trousers
    }
    
    // Rule 4: Texture/Season Mismatch
    const isWinterTop = ['sweater', 'hoodie', 'fleece', 'wool'].some(term => topName.includes(term));
    const isSummerBottom = ['shorts', 'linen'].some(term => bottomName.includes(term));
    
    // Prevent: Heavy winter top + summer bottom
    if (isWinterTop && isSummerBottom && context?.temperature !== 'mild') return false;
    
    // Rule 5: Athletic Mismatch
    const isAthleticTop = ['athletic', 'workout', 'gym', 'sports'].some(term => topName.includes(term));
    const isDressyBottom = ['dress pants', 'trousers', 'formal'].some(term => bottomName.includes(term));
    
    if (isAthleticTop && isDressyBottom) return false;
    
    return true; // Pairing passes all validation rules
  };

  const generateOutfit = async () => {
    if (wardrobeItems.length === 0) return;
    
    setIsGenerating(true);

    // Filter out items worn in the last 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const availableItems = wardrobeItems.filter(item => {
      if (!item.last_worn_date) return true; // Never worn items are available
      const lastWorn = new Date(item.last_worn_date);
      return lastWorn < threeDaysAgo;
    });

    // Filter items by category from available items
    const tops = availableItems.filter(item => 
      item.category === ClothingCategory.TOPS || 
      item.category === ClothingCategory.OUTERWEAR
    );
    const bottoms = availableItems.filter(item => 
      item.category === ClothingCategory.BOTTOMS
    );

    // Weather-aware outfit selection
    let filteredTops = tops;
    let filteredBottoms = bottoms;

    if (outfitContext) {
      // Filter based on weather context
      filteredTops = tops.filter(item => {
        // Prefer outerwear for cooler temperatures or when layers are needed
        if (outfitContext.layers === 'heavy' || outfitContext.layers === 'medium') {
          return item.category === ClothingCategory.OUTERWEAR || 
                 (item.category === ClothingCategory.TOPS && ['sweater', 'hoodie', 'jacket'].some(type => 
                   item.name.toLowerCase().includes(type)
                 ));
        }
        
        // Prefer light tops for warm weather
        if (outfitContext.temperature === 'hot' || outfitContext.temperature === 'warm') {
          return item.category === ClothingCategory.TOPS && 
                 !['sweater', 'hoodie', 'jacket'].some(type => 
                   item.name.toLowerCase().includes(type)
                 );
        }
        
        return true;
      });

      // Filter bottoms based on occasion and weather with smart prioritization
      filteredBottoms = bottoms.filter(item => {
        const itemName = item.name.toLowerCase();
        
        // Formal occasions always override weather preferences for bottoms
        if (occasion === 'formal' || occasion === 'work') {
          return ['pants', 'trousers', 'dress', 'slacks', 'chinos'].some(type => 
            itemName.includes(type)
          ) && !itemName.includes('shorts'); // Explicitly exclude shorts for formal
        }
        
        // For hot weather in casual settings, prefer shorts
        if (outfitContext.temperature === 'hot' && occasion === 'casual') {
          return itemName.includes('shorts') || 
                 itemName.includes('skirt') ||
                 itemName.includes('linen'); // Include breathable fabrics
        }
        
        return true;
      });
    }

    // Fallback to original arrays if filtering results in empty arrays
    if (filteredTops.length === 0) filteredTops = tops;
    if (filteredBottoms.length === 0) filteredBottoms = bottoms;

    // Smart pairing algorithm to prevent fashion disasters
    const generateSmartPairing = () => {
      if (filteredTops.length === 0 || filteredBottoms.length === 0) return;

      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const selectedTop = filteredTops[Math.floor(Math.random() * filteredTops.length)];
        const selectedBottom = filteredBottoms[Math.floor(Math.random() * filteredBottoms.length)];
        
        // Fashion validation: Check if this pairing makes sense
        if (isValidFashionPairing(selectedTop, selectedBottom, occasion, outfitContext)) {
          setSuggestedTop(selectedTop);
          setSuggestedBottom(selectedBottom);
          return;
        }
        
        attempts++;
      }
      
      // Fallback: if no good pairing found, use first items
      setSuggestedTop(filteredTops[0]);
      setSuggestedBottom(filteredBottoms[0]);
    };

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    generateSmartPairing();

    setIsGenerating(false);
  };

  const selectedOccasion = OCCASIONS.find(o => o.value === occasion);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center my-12 pt-2">
          
          <h1 className="text-6xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Selection - Outfit creator 
          </h1>
          <p className="text-gray-300 text-lg">
            Get personalized outfit suggestions based on weather, occasion, and your wardrobe 
          </p>
        </div>

        {/* Input Controls */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Location Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                📍 Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchWeatherByCity(location)}
                  placeholder="Enter your city..."
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {isLoadingWeather && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="animate-spin text-blue-400">⏳</span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchWeatherByCity(location)}
                  disabled={isLoadingWeather || !location.trim()}
                  className="text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Search
                </button>
                <button
                  onClick={getUserLocation}
                  disabled={isLoadingWeather}
                  className="text-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Use My Location
                </button>
              </div>
            </div>

            {/* Occasion Dropdown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                🎯 Occasion
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {OCCASIONS.map((occ) => (
                  <option key={occ.value} value={occ.value}>
                    {occ.emoji} {occ.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                🤖 AI Magic
              </label>
              <button
                onClick={generateOutfit}
                disabled={isGenerating || wardrobeItems.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Select My Outfit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Weather Display */}
        {weather && (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <span>🌤️</span>
                <span>Current Weather</span>
              </h3>
              <span className="text-sm text-gray-400">
                {weather.location.name}, {weather.location.country}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{weather.temperature}°F</div>
                <div className="text-sm text-gray-400">Temperature</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{weather.feelsLike}°F</div>
                <div className="text-sm text-gray-400">Feels Like</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-white capitalize">{weather.description}</div>
                <div className="text-sm text-gray-400">Conditions</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-white">{weather.humidity}%</div>
                <div className="text-sm text-gray-400">Humidity</div>
              </div>
            </div>

            {outfitContext && (
              <div className="mt-4 p-4 bg-gray-900/50 rounded-xl">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Outfit Recommendations</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded-full">
                    {outfitContext.temperature} weather
                  </span>
                  <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded-full">
                    {outfitContext.layers} layers
                  </span>
                  {outfitContext.waterproof && (
                    <span className="px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded-full">
                      waterproof recommended
                    </span>
                  )}
                  {outfitContext.breathable && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-full">
                      breathable fabric
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Outfit Suggestions */}
        {wardrobeItems.length === 0 ? (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-12 text-center">
            <div className="text-6xl mb-4">👔</div>
            <h3 className="text-xl font-semibold text-white mb-2">Build Your Wardrobe First</h3>
            <p className="text-gray-300 mb-6">Add some clothing items to your wardrobe to get AI outfit suggestions</p>
            <button 
              onClick={() => window.location.href = '/wardrobe'}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
            >
              📷 Add Items to Wardrobe
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Top Suggestion */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">👕 Top</h3>
                <p className="text-gray-400 text-sm">
                  Perfect for {selectedOccasion?.label.toLowerCase()}
                  {weather && outfitContext && (
                    <span> in {outfitContext.temperature} weather</span>
                  )}
                </p>
              </div>
              
              {suggestedTop ? (
                <div className="space-y-4">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-900">
                    <img
                      src={`/api/wardrobe/${suggestedTop.id}/image`}
                      alt={suggestedTop.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <h4 className="text-white font-medium">{suggestedTop.name}</h4>
                    {suggestedTop.brand && (
                      <p className="text-gray-400 text-sm">{suggestedTop.brand}</p>
                    )}
                    <div className="flex items-center justify-center space-x-2 mt-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-600"
                        style={{ backgroundColor: suggestedTop.color_primary }}
                      />
                      {suggestedTop.color_secondary && (
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-600"
                          style={{ backgroundColor: suggestedTop.color_secondary }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">👕</div>
                    <p>Click "Select My Outfit" to get suggestions</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Suggestion */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">👖 Bottom</h3>
                <p className="text-gray-400 text-sm">
                  {weather && outfitContext ? (
                    <>Ideal for {weather.temperature}°F 
                    {outfitContext.waterproof && <span> (waterproof recommended)</span>}</>
                  ) : (
                    <>Matches your {location || 'local'} weather</>
                  )}
                </p>
              </div>
              
              {suggestedBottom ? (
                <div className="space-y-4">
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-900">
                    <img
                      src={`/api/wardrobe/${suggestedBottom.id}/image`}
                      alt={suggestedBottom.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <h4 className="text-white font-medium">{suggestedBottom.name}</h4>
                    {suggestedBottom.brand && (
                      <p className="text-gray-400 text-sm">{suggestedBottom.brand}</p>
                    )}
                    <div className="flex items-center justify-center space-x-2 mt-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-600"
                        style={{ backgroundColor: suggestedBottom.color_primary }}
                      />
                      {suggestedBottom.color_secondary && (
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-600"
                          style={{ backgroundColor: suggestedBottom.color_secondary }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-xl bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">👖</div>
                    <p>Click "Select My Outfit" to get suggestions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Outfit Confirmation */}
        {(suggestedTop || suggestedBottom) && (
          <div className="mt-8 text-center">
            <button
              onClick={async () => {
                if (!suggestedTop && !suggestedBottom) return;
                
                const itemIds = [
                  ...(suggestedTop ? [suggestedTop.id] : []),
                  ...(suggestedBottom ? [suggestedBottom.id] : [])
                ];
                
                try {
                  const response = await fetch('/api/usage/wear-confirmation', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      itemIds,
                      occasion
                    })
                  });
                  
                  if (response.ok) {
                    alert('✅ Outfit confirmed! These items won\'t be suggested for 3 days.');
                    setSuggestedTop(null);
                    setSuggestedBottom(null);
                  }
                } catch (error) {
                  console.error('Failed to confirm outfit:', error);
                }
              }}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2 mx-auto"
            >
              <span>✅</span>
              <span>I Wore This Outfit</span>
            </button>
            <p className="text-gray-400 text-sm mt-2">
              Confirming prevents these items from being suggested for 3 days
            </p>
          </div>
        )}

        {/* Quick Stats */}
        {wardrobeItems.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              ✨ AI analyzing {wardrobeItems.length} items in your wardrobe
              {weather && (
                <span> with current {weather.location.name} weather conditions</span>
              )}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}