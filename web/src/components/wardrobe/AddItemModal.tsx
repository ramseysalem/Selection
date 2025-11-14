import { useState, useEffect } from 'react';
import { WardrobeItem } from '../../types/wardrobe';
import { useAuthStore } from '../../stores/authStore';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: WardrobeItem | null;
}

export default function AddItemModal({ isOpen, onClose, onSuccess, editingItem }: AddItemModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<File>();
  const [itemName, setItemName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  const { accessToken } = useAuthStore();

  const resetForm = () => {
    setSelectedPhoto(undefined);
    setItemName('');
    setAiAnalysis(null);
    setError(undefined);
  };

  useEffect(() => {
    if (editingItem) {
      setItemName(editingItem.name);
    } else {
      resetForm();
    }
  }, [editingItem, isOpen]);

  const handlePhotoSelect = (file: File) => {
    setSelectedPhoto(file);
    setError(undefined);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handlePhotoSelect(file);
      } else {
        setError('Please select an image file');
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedPhoto && !editingItem) {
      setError('Please select a photo');
      return;
    }

    if (!itemName.trim()) {
      setError('Please enter an item name');
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const formData = new FormData();
      
      if (selectedPhoto) {
        formData.append('image', selectedPhoto);
      }
      
      formData.append('data', JSON.stringify({
        name: itemName.trim()
      }));

      const url = editingItem ? `/api/wardrobe/${editingItem.id}` : '/api/wardrobe/items';
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        setAiAnalysis(result.ai_analysis);
        onSuccess();
        onClose();
        resetForm();
      } else {
        setError(result.error || 'Failed to save item');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            🤖 {editingItem ? 'Update Item' : 'Add New Item'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* AI Notice */}
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-300 text-sm">
              <strong>✨ AI-Powered</strong>
              <br />
              Just upload an image and enter a name - our AI will automatically detect the category, colors, style, and more!
            </div>
          </div>

          {/* Item Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Item Name
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Blue Cotton T-Shirt"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Photo Upload */}
          {!editingItem && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Photo
              </label>
              
              {selectedPhoto ? (
                <div className="relative">
                  <img
                    src={URL.createObjectURL(selectedPhoto)}
                    alt="Selected item"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setSelectedPhoto(undefined)}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="text-4xl mb-4">📷</div>
                  <div className="text-gray-300 mb-4">
                    <strong>Drop an image here</strong>
                    <br />
                    or click to browse
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoSelect(file);
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors inline-block"
                  >
                    Choose Photo
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* AI Analysis Display */}
          {aiAnalysis && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h3 className="text-green-300 font-medium mb-2">🤖 AI Analysis Complete!</h3>
              <div className="text-sm text-gray-300 space-y-1">
                {aiAnalysis.auto_detected && (
                  <>
                    <div><strong>Category:</strong> {aiAnalysis.auto_detected.category}</div>
                    <div><strong>Primary Color:</strong> 
                      <span className="ml-2 inline-block w-4 h-4 rounded-full border border-gray-600" 
                            style={{backgroundColor: aiAnalysis.auto_detected.color_primary}}></span>
                      {aiAnalysis.auto_detected.color_primary}
                    </div>
                    <div><strong>Confidence:</strong> {Math.round(aiAnalysis.confidence * 100)}%</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!selectedPhoto && !editingItem) || !itemName.trim()}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>🤖</span>
                <span>{editingItem ? 'Update' : 'Add'} Item</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}