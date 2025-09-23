import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function Settings() {
  const { user, updateProfile, isLoading, error } = useAuthStore();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });
  const [successMessage, setSuccessMessage] = useState('');

  const handleSave = async () => {
    try {
      setSuccessMessage('');
      await updateProfile({
        name: formData.name.trim() || undefined,
        email: formData.email.trim() || undefined
      });
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen">
      <div className="w-full flex justify-center">
        <div className="max-w-4xl w-full py-12 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">⚙️</div>
            <h1 className="text-4xl font-bold text-white mb-4">Settings & Preferences</h1>
            <p className="text-gray-300 text-lg">🛠️ Customize your Outfit Matcher experience</p>
          </div>
          
          <div className="space-y-8">
            {/* Profile Settings */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 p-8">
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">👤</span>
                <h2 className="text-2xl font-semibold text-white">Profile Settings</h2>
              </div>
              
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <p className="text-green-300 text-sm">{successMessage}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    📝 Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    📧 Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={handleSave}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin inline-block mr-2">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* AI Preferences */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 p-8">
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">🤖</span>
                <h2 className="text-2xl font-semibold text-white">AI Preferences</h2>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl border border-gray-600">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">✨</span>
                    <div>
                      <div className="text-white font-medium">AI Outfit Suggestions</div>
                      <div className="text-gray-400 text-sm">Let AI create outfit combinations for you</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl border border-gray-600">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">🌡️</span>
                    <div>
                      <div className="text-white font-medium">Weather Integration</div>
                      <div className="text-gray-400 text-sm">Include weather data in outfit suggestions</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl border border-gray-600">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <div className="text-white font-medium">Daily Notifications</div>
                      <div className="text-gray-400 text-sm">Get daily outfit suggestions and style tips</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-900/30 rounded-xl border border-gray-600">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">📈</span>
                    <div>
                      <div className="text-white font-medium">Style Learning</div>
                      <div className="text-gray-400 text-sm">Allow AI to learn from your preferences and choices</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Data & Privacy */}
            <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 p-8">
              <div className="flex items-center mb-6">
                <span className="text-2xl mr-3">🔒</span>
                <h2 className="text-2xl font-semibold text-white">Data & Privacy</h2>
              </div>
              
              <div className="space-y-4">
                <button className="w-full md:w-auto bg-gray-700/80 hover:bg-gray-600/80 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 border border-gray-600 flex items-center space-x-2">
                  <span>📥</span>
                  <span>Export My Data</span>
                </button>
                
                <button className="w-full md:w-auto bg-red-600/20 hover:bg-red-600/30 text-red-300 px-6 py-3 rounded-xl font-medium transition-all duration-200 border border-red-500/30 flex items-center space-x-2">
                  <span>🗑️</span>
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}