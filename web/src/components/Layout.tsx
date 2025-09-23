import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <nav className="bg-gray-800/90 backdrop-blur-sm shadow-lg border-b border-gray-700">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="max-w-7xl w-full flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-2xl mr-3">👗</span>
                  <h1 className="text-xl font-bold text-white">Selection</h1>
                </div>
                <div className="ml-8 flex space-x-8">
                  <Link
                    to="/"
                    className="border-transparent text-gray-300 hover:text-white hover:border-blue-400 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
                  >
                    🏠 Home
                  </Link>
                  <Link
                    to="/wardrobe"
                    className="border-transparent text-gray-300 hover:text-white hover:border-blue-400 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
                  >
                    👔 Wardrobe
                  </Link>
                  <Link
                    to="/outfits"
                    className="border-transparent text-gray-300 hover:text-white hover:border-blue-400 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
                  >
                    ✨ Outfits
                  </Link>
                  <Link
                    to="/settings"
                    className="border-transparent text-gray-300 hover:text-white hover:border-blue-400 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
                  >
                    ⚙️ Settings
                  </Link>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {user && (
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">👤</span>
                    <span className="text-sm text-gray-300">
                      {user.name || user.email}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-sm text-gray-300 hover:text-white font-medium transition-colors duration-200 px-3 py-2 rounded-md hover:bg-gray-700"
                >
                  <span>🚪</span>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="relative">
        <Outlet />
      </main>
    </div>
  );
}