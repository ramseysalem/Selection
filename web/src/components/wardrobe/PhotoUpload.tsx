import { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';

interface PhotoUploadProps {
  onPhotoSelect: (file: File) => void;
  selectedPhoto?: File;
  existingImageUrl?: string;
}

export default function PhotoUpload({ onPhotoSelect, selectedPhoto, existingImageUrl }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        onPhotoSelect(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  });

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onPhotoSelect(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-xl font-semibold text-white mb-2">Add Photo</h3>
        <p className="text-gray-400">Upload a clear photo of your clothing item</p>
      </div>

      {/* Photo Preview */}
      {preview && (
        <div className="relative bg-gray-800/60 rounded-xl border border-gray-700 p-4">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-64 object-cover rounded-lg"
          />
          <button
            onClick={clearPhoto}
            className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      )}

      {/* Upload Area */}
      {!preview && (
        <div
          {...getRootProps()}
          className={`bg-gray-800/60 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="text-6xl mb-4">📷</div>
          
          {isDragActive ? (
            <div>
              <p className="text-blue-300 font-medium mb-2">Drop your photo here!</p>
              <p className="text-gray-400 text-sm">Release to upload</p>
            </div>
          ) : (
            <div>
              <p className="text-white font-medium mb-2">Drag & drop your photo here</p>
              <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
              
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                >
                  <span>📁</span>
                  <span>Browse Files</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="bg-gray-700/80 hover:bg-gray-600/80 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 border border-gray-600 flex items-center space-x-2"
                >
                  <span>📸</span>
                  <span>Camera</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Tips */}
      <div className="bg-gray-800/40 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <span className="text-yellow-400 text-sm">💡</span>
          <div className="text-gray-300 text-sm">
            <p className="font-medium mb-1">Photo Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• Use good lighting for best results</li>
              <li>• Center the item in the frame</li>
              <li>• Avoid busy backgrounds</li>
              <li>• Max file size: 10MB</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}