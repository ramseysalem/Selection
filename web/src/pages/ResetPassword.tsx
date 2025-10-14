import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface PasswordRequirement {
  met: boolean;
  text: string;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
    }
  }, [token]);

  // Real-time password validation
  const getPasswordRequirements = (pwd: string): PasswordRequirement[] => {
    return [
      { met: pwd.length >= 8, text: 'At least 8 characters long' },
      { met: /[a-z]/.test(pwd), text: 'One lowercase letter (a-z)' },
      { met: /[A-Z]/.test(pwd), text: 'One uppercase letter (A-Z)' },
      { met: /\d/.test(pwd), text: 'One number (0-9)' },
      { met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd), text: 'One special character (!@#$%^&*)' },
      { met: !/(..).*\1/.test(pwd), text: 'No repeated character patterns' }
    ];
  };

  const passwordRequirements = getPasswordRequirements(password);
  const passwordStrength = passwordRequirements.filter(req => req.met).length;
  const isPasswordValid = passwordRequirements.every(req => req.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet security requirements');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password reset failed');
      }

      setSuccess(true);
      
      // Clear any existing authentication state
      logout();
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Password Reset Successful!
            </h2>
            <p className="text-gray-400 mb-4">
              Your password has been successfully updated.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white">
            Reset Your Password
          </h2>
          <p className="text-gray-400 mt-1">Enter your new password</p>
        </div>

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
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              🔑 New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setShowRequirements(e.target.value.length > 0);
              }}
              onFocus={() => setShowRequirements(true)}
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter your new password"
            />
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordStrength <= 2 ? 'bg-red-500' :
                        passwordStrength <= 4 ? 'bg-yellow-500' :
                        passwordStrength === 5 ? 'bg-blue-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength / 6) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength <= 2 ? 'text-red-400' :
                    passwordStrength <= 4 ? 'text-yellow-400' :
                    passwordStrength === 5 ? 'text-blue-400' :
                    'text-green-400'
                  }`}>
                    {passwordStrength <= 2 ? 'Weak' :
                     passwordStrength <= 4 ? 'Fair' :
                     passwordStrength === 5 ? 'Good' :
                     'Strong'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Password Requirements */}
            {showRequirements && (
              <div className="mt-3 p-3 bg-gray-700/50 rounded-xl border border-gray-600">
                <p className="text-sm font-medium text-gray-300 mb-2">Password Requirements:</p>
                <div className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className={`text-sm ${
                        req.met ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {req.met ? '✅' : '⭕'}
                      </span>
                      <span className={`text-xs ${
                        req.met ? 'text-green-300' : 'text-gray-400'
                      }`}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              🔐 Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Confirm your new password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full flex justify-center items-center space-x-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
          >
            {isLoading ? (
              <>
                <span>⏳</span>
                <span>Updating password...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors text-sm"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}