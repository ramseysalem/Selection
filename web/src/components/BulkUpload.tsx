import { useState, useRef, useCallback, DragEvent } from 'react';
import { useAuthStore } from '../stores/authStore';

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  category: string;
  brand?: string;
  size?: string;
  cost?: number;
  purchaseDate?: string;
  tags: string[];
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  aiAnalysis?: any;
}

interface BulkUploadProps {
  onUploadComplete: () => void;
  onClose: () => void;
}

const CATEGORIES = [
  'tops', 'bottoms', 'outerwear', 'dresses', 'shoes', 
  'accessories', 'activewear', 'sleepwear', 'underwear'
];

export default function BulkUpload({ onUploadComplete, onClose }: BulkUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [completedUploads, setCompletedUploads] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const { accessToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    const acceptedFiles = Array.from(fileList).filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (acceptedFiles.length !== fileList.length) {
      alert(`${fileList.length - acceptedFiles.length} files were rejected (invalid type or too large)`);
    }

    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      category: 'tops', // Default category
      tags: [],
      status: 'pending',
      progress: 0
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const uploadSingleFile = async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append('image', uploadFile.file);
    formData.append('name', uploadFile.name);
    formData.append('category', uploadFile.category);
    if (uploadFile.brand) formData.append('brand', uploadFile.brand);
    if (uploadFile.size) formData.append('size', uploadFile.size);
    if (uploadFile.cost) formData.append('cost', uploadFile.cost.toString());
    if (uploadFile.purchaseDate) formData.append('purchaseDate', uploadFile.purchaseDate);
    if (uploadFile.tags.length > 0) formData.append('tags', JSON.stringify(uploadFile.tags));

    updateFile(uploadFile.id, { status: 'uploading', progress: 0 });

    try {
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            updateFile(uploadFile.id, { progress });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 201) {
            const response = JSON.parse(xhr.responseText);
            updateFile(uploadFile.id, { 
              status: 'success', 
              progress: 100,
              aiAnalysis: response.ai_analysis 
            });
            setCompletedUploads(prev => prev + 1);
            resolve();
          } else {
            const errorData = JSON.parse(xhr.responseText);
            updateFile(uploadFile.id, { 
              status: 'error', 
              error: errorData.error || 'Upload failed' 
            });
            reject(new Error(errorData.error));
          }
        };

        xhr.onerror = () => {
          updateFile(uploadFile.id, { 
            status: 'error', 
            error: 'Network error' 
          });
          reject(new Error('Network error'));
        };

        xhr.open('POST', '/api/wardrobe/items');
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.send(formData);
      });
    } catch (error) {
      updateFile(uploadFile.id, { 
        status: 'error', 
        error: error.message || 'Upload failed' 
      });
      throw error;
    }
  };

  const uploadAllFiles = async () => {
    setIsUploading(true);
    setCompletedUploads(0);

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    // Upload files in batches of 3 to avoid overwhelming the server
    const batchSize = 3;
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      const uploadPromises = batch.map(file => uploadSingleFile(file));
      
      try {
        await Promise.allSettled(uploadPromises);
      } catch (error) {
        console.error('Batch upload error:', error);
      }
      
      // Small delay between batches
      if (i + batchSize < pendingFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsUploading(false);
    
    // Check if all uploads completed successfully
    const successCount = files.filter(f => f.status === 'success').length;
    if (successCount > 0) {
      onUploadComplete();
    }
  };

  const addTag = (fileId: string, tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag) {
      updateFile(fileId, {
        tags: [...(files.find(f => f.id === fileId)?.tags || []), trimmedTag]
      });
    }
  };

  const removeTag = (fileId: string, tagIndex: number) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      const newTags = file.tags.filter((_, index) => index !== tagIndex);
      updateFile(fileId, { tags: newTags });
    }
  };

  const totalFiles = files.length;
  const successfulUploads = files.filter(f => f.status === 'success').length;
  const failedUploads = files.filter(f => f.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">📁 Bulk Upload Wardrobe Items</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>
          </div>
          {totalFiles > 0 && (
            <div className="mt-4">
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <span>📊 Total: {totalFiles}</span>
                <span className="text-green-400">✅ Uploaded: {successfulUploads}</span>
                <span className="text-red-400">❌ Failed: {failedUploads}</span>
                <span className="text-yellow-400">⏳ Pending: {totalFiles - successfulUploads - failedUploads}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {files.length === 0 ? (
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-blue-400 bg-blue-400/10'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-6xl mb-4">📸</div>
              <div className="text-xl font-semibold text-white mb-2">
                {isDragActive ? 'Drop files here' : 'Drag & drop your clothing photos'}
              </div>
              <div className="text-gray-400 mb-4">
                or click to browse files
              </div>
              <div className="text-sm text-gray-500">
                Supports JPEG, PNG, WebP • Max 20 files • 10MB each
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
              >
                <div className="text-gray-400">
                  ➕ Add more files (drag & drop or click)
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="bg-gray-800/60 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex items-start space-x-4">
                      <img
                        src={file.preview}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <input
                            type="text"
                            value={file.name}
                            onChange={(e) => updateFile(file.id, { name: e.target.value })}
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm flex-1 mr-2"
                            placeholder="Item name"
                          />
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <select
                            value={file.category}
                            onChange={(e) => updateFile(file.id, { category: e.target.value })}
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded"
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={file.brand || ''}
                            onChange={(e) => updateFile(file.id, { brand: e.target.value })}
                            placeholder="Brand"
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <input
                            type="text"
                            value={file.size || ''}
                            onChange={(e) => updateFile(file.id, { size: e.target.value })}
                            placeholder="Size"
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded"
                          />
                          <input
                            type="number"
                            value={file.cost || ''}
                            onChange={(e) => updateFile(file.id, { cost: parseFloat(e.target.value) || undefined })}
                            placeholder="Cost $"
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded"
                          />
                          <input
                            type="date"
                            value={file.purchaseDate || ''}
                            onChange={(e) => updateFile(file.id, { purchaseDate: e.target.value })}
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded"
                          />
                        </div>

                        {/* Tags */}
                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {file.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center"
                              >
                                {tag}
                                <button
                                  onClick={() => removeTag(file.id, index)}
                                  className="ml-1 text-blue-200 hover:text-white"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Add tags (press Enter)"
                            className="bg-gray-700 text-white text-xs px-2 py-1 rounded w-full"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addTag(file.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                        </div>

                        {/* Status and Progress */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {file.status === 'pending' && (
                              <span className="text-gray-400 text-xs">⏳ Ready</span>
                            )}
                            {file.status === 'uploading' && (
                              <span className="text-blue-400 text-xs">📤 Uploading...</span>
                            )}
                            {file.status === 'success' && (
                              <span className="text-green-400 text-xs">✅ Success</span>
                            )}
                            {file.status === 'error' && (
                              <span className="text-red-400 text-xs">❌ {file.error}</span>
                            )}
                          </div>
                          
                          {file.status === 'uploading' && (
                            <div className="w-20 bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* AI Analysis Results */}
                        {file.aiAnalysis && (
                          <div className="mt-2 p-2 bg-green-900/30 rounded text-xs">
                            <div className="text-green-300 font-medium">🤖 AI Analysis:</div>
                            <div className="text-gray-300">
                              Colors: {file.aiAnalysis.colors?.join(', ')}
                              {file.aiAnalysis.formality_score && (
                                <span> • Formality: {file.aiAnalysis.formality_score}/10</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="p-6 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {isUploading ? '🔄 Uploading in progress...' : '✨ Ready to upload your wardrobe items'}
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setFiles([])}
                  disabled={isUploading}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50"
                >
                  Clear All
                </button>
                <button
                  onClick={uploadAllFiles}
                  disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? '⏳ Uploading...' : `📤 Upload ${files.filter(f => f.status === 'pending').length} Items`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}