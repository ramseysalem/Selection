import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { WardrobeItem, ClothingCategory, CLOTHING_CATEGORIES } from '../types/wardrobe';
import AddItemModal from '../components/wardrobe/AddItemModal';
import WardrobeItemCard from '../components/wardrobe/WardrobeItemCard';
import BulkUpload from '../components/BulkUpload';

export default function Wardrobe() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [stats, setStats] = useState<Record<ClothingCategory, number>>({
    [ClothingCategory.OUTERWEAR]: 0,
    [ClothingCategory.TOPS]: 0,
    [ClothingCategory.BOTTOMS]: 0,
    [ClothingCategory.FOOTWEAR]: 0,
    [ClothingCategory.ACCESSORIES]: 0
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchStats, setBatchStats] = useState<any>(null);
  const [error, setError] = useState<string>();
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  
  const { accessToken } = useAuthStore();

  const fetchWardrobeData = async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    try {
      const [itemsResponse, statsResponse] = await Promise.all([
        fetch('/api/wardrobe', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }),
        fetch('/api/wardrobe/stats', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      ]);

      if (!itemsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch wardrobe data');
      }

      const itemsData = await itemsResponse.json();
      const statsData = await statsResponse.json();

      setItems(itemsData.items || []);
      setStats(statsData.stats || stats);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWardrobeData();
  }, [accessToken]);

  const handleAddSuccess = () => {
    fetchWardrobeData();
  };

  const handleEdit = (item: WardrobeItem) => {
    setEditingItem(item);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    // Find the item before deletion for optimistic update
    const deletedItem = items.find(item => item.id === itemId);
    if (!deletedItem) return;

    try {
      const response = await fetch(`/api/wardrobe/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        // Optimistically update UI immediately
        setItems(prevItems => prevItems.filter(item => item.id !== itemId));
        setStats(prev => ({
          ...prev,
          [deletedItem.category]: Math.max(0, prev[deletedItem.category] - 1)
        }));
      } else {
        // Show error message if delete failed
        setError('Failed to delete item. Please try again.');
        setTimeout(() => setError(undefined), 3000);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      setError('Network error. Please check your connection.');
      setTimeout(() => setError(undefined), 3000);
    }
  };

  const handleToggleFavorite = (itemId: string) => {
    setItems(items.map(item => 
      item.id === itemId 
        ? { ...item, is_favorite: !item.is_favorite }
        : item
    ));
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const handleBatchProcess = async () => {
    if (!accessToken || batchProcessing) return;
    
    setBatchProcessing(true);
    setError(undefined);
    
    try {
      console.log('🚀 Starting batch processing...');
      
      const response = await fetch('/api/batch/process-wardrobe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchSize: 3 })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBatchStats(data.stats);
        console.log('✅ Batch processing completed:', data.stats);
        await fetchWardrobeData(); // Refresh items to show AI analysis
      } else {
        throw new Error(data.error || 'Batch processing failed');
      }
    } catch (error) {
      console.error('❌ Batch processing error:', error);
      setError(error instanceof Error ? error.message : 'Batch processing failed');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleBulkUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Create a basic wardrobe item for each image
      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('data', JSON.stringify({
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
          category: ClothingCategory.TOPS, // Default category
          color_primary: '#000000', // Default color
          tags: ['bulk-upload'],
          occasion: [],
          season: []
        }));

        await fetch('/api/wardrobe', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: formData
        });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    // Refresh the wardrobe data
    fetchWardrobeData();
    
    // Reset the input
    target.value = '';
  };

  const getCategoryItems = (category: ClothingCategory) => {
    return items.filter(item => item.category === category);
  };

  const getFilteredItems = () => {
    let filteredItems = items;

    // Filter by category if selected
    if (selectedCategory) {
      filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredItems = filteredItems.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query)) ||
        item.occasion.some(occasion => occasion.toLowerCase().includes(query)) ||
        item.material?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)
      );
    }

    // Filter favorites only
    if (showFavoritesOnly) {
      filteredItems = filteredItems.filter(item => item.is_favorite);
    }

    return filteredItems;
  };

  const totalItems = Object.values(stats).reduce((sum, count) => sum + count, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-700">Loading your wardrobe...</p>
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
            <div className="text-6xl mb-4">👔</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-4">Your Digital Wardrobe</h1>
            <p className="text-gray-700 text-lg">📦 Organize, categorize, and manage your clothing collection</p>
            {totalItems > 0 && (
              <div className="mt-4">
                <span className="bg-blue-600/20 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                  {totalItems} items in your wardrobe
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {CLOTHING_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                className={`bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl border transition-all duration-200 text-center hover:transform hover:scale-105 ${
                  selectedCategory === category.id 
                    ? 'border-blue-500 bg-blue-600/20' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-2">{category.emoji}</div>
                <div className="text-2xl font-bold text-blue-700 mb-1">
                  {stats[category.id] || 0}
                </div>
                <div className="text-gray-700 text-sm">{category.name}</div>
              </button>
            ))}
          </div>

          {/* Main Content */}
          {totalItems === 0 ? (
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 p-8">
              <div className="text-center py-16">
                <div className="text-8xl mb-6">🎯</div>
                <h3 className="text-2xl font-semibold text-white mb-4">Ready to Build Your Digital Closet?</h3>
                <p className="text-gray-300 mb-8 max-w-md mx-auto">Start by adding your first clothing item and let our AI help organize your wardrobe</p>
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                  >
                    <span>📷</span>
                    <span>Add Item</span>
                  </button>
                  
                  <button 
                    onClick={handleBatchProcess}
                    disabled={batchProcessing}
                    className={`${
                      batchProcessing 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700'
                    } text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2`}
                  >
                    <span>{batchProcessing ? '⏳' : '🤖'}</span>
                    <span>{batchProcessing ? 'Analyzing...' : 'AI Analyze All'}</span>
                  </button>
                  <button 
                    onClick={() => setIsBulkUploadOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                  >
                    <span>📁</span>
                    <span>Bulk Upload</span>
                  </button>
                </div>
                
                <div className="mt-8 text-sm text-gray-400">
                  💡 Tip: Use our camera feature to quickly scan and categorize your items
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Search and Filter Bar */}
              <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search items by name, brand, tags, material..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-3 pl-12 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                        showFavoritesOnly 
                          ? 'bg-red-600/20 text-red-300 border border-red-500/30' 
                          : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600/50'
                      }`}
                    >
                      <span>❤️</span>
                      <span>Favorites</span>
                    </button>

                    {(searchQuery || selectedCategory || showFavoritesOnly) && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory(null);
                          setShowFavoritesOnly(false);
                        }}
                        className="px-4 py-2 rounded-xl font-medium text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 transition-all duration-200 flex items-center space-x-2"
                      >
                        <span>✕</span>
                        <span>Clear All</span>
                      </button>
                    )}

                    <button 
                      onClick={() => setIsBulkUploadOpen(true)}
                      className="bg-gray-700/50 hover:bg-gray-600/50 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 border border-gray-600 flex items-center space-x-2"
                    >
                      <span>📁</span>
                      <span>Bulk</span>
                    </button>

                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                    >
                      <span>➕</span>
                      <span>Add Item</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Results Info */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-semibold text-white">
                    {selectedCategory 
                      ? CLOTHING_CATEGORIES.find(c => c.id === selectedCategory)?.name 
                      : 'All Items'
                    }
                  </h2>
                  <span className="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {getFilteredItems().length} items
                  </span>
                </div>
              </div>

              {/* Items Grid */}
              {getFilteredItems().length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {getFilteredItems().map((item) => (
                    <WardrobeItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No items found</h3>
                  <p className="text-gray-400 mb-6">
                    {searchQuery ? `No items match "${searchQuery}"` : 
                     showFavoritesOnly ? 'No favorite items found' :
                     selectedCategory ? `No ${CLOTHING_CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} items found` :
                     'No items match your current filters'
                    }
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      setShowFavoritesOnly(false);
                    }}
                    className="bg-gray-700/50 hover:bg-gray-600/50 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 border border-gray-600"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Item Modal */}
      <AddItemModal 
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSuccess={handleAddSuccess}
        editingItem={editingItem}
      />

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <BulkUpload 
          onUploadComplete={() => {
            setIsBulkUploadOpen(false);
            fetchWardrobeData();
          }}
          onClose={() => setIsBulkUploadOpen(false)}
        />
      )}
    </div>
  );
}