import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export default function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      await login(email, password);
      onSuccess?.();
    } catch (error) {
      // Error is handled by the store
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@example.com');
    setPassword('password123');
    setShowDemo(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage('');
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResetMessage('Password reset link sent! Check your email.');
        setShowForgotPassword(false);
        setResetEmail('');
      } else {
        setResetMessage(data.error || 'Failed to send reset email');
      }
    } catch (error) {
      setResetMessage('Network error. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="w-full bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <div className="text-center mb-6">
        <div className="text-3xl mb-3">🔐</div>
        <h2 className="text-2xl font-bold text-white">
          Welcome Back
        </h2>
        <p className="text-gray-400 mt-1">Sign in to your account</p>
      </div>
      
      {showDemo && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center mb-2">
            <span className="text-lg mr-2">🎯</span>
            <p className="text-sm text-blue-300 font-medium">
              Quick Demo Access
            </p>
          </div>
          <p className="text-xs text-blue-200 mb-3">
            Email: demo@example.com<br />
            Password: password123
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            className="text-sm text-blue-300 hover:text-blue-200 underline transition-colors"
          >
            ⚡ Use demo credentials
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center">
            <span className="text-lg mr-2">❌</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            📧 Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            🔑 Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center space-x-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
        >
          {isLoading ? (
            <>
              <span>⏳</span>
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      {/* Forgot Password Section */}
      {resetMessage && (
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center">
            <span className="text-lg mr-2">📧</span>
            <p className="text-sm text-blue-300">{resetMessage}</p>
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowForgotPassword(!showForgotPassword)}
          className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          🔐 Forgot your password?
        </button>
      </div>

      {showForgotPassword && (
        <div className="mt-4 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
          <h3 className="text-lg font-medium text-white mb-3">Reset Password</h3>
          <form onSubmit={handleForgotPassword} className="space-y-3">
            <div>
              <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-300 mb-2">
                📧 Enter your email address
              </label>
              <input
                id="resetEmail"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your email"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 flex justify-center items-center space-x-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? (
                  <>
                    <span>⏳</span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>📧</span>
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl text-white transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {onSwitchToRegister && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              ✨ Sign up
            </button>
          </p>
        </div>
      )}
    </div>
  );
}