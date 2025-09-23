import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // Redirect to intended page after login, or home if no intended page
  const from = location.state?.from?.pathname || '/';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col justify-center items-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">👗</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Outfit Matcher
          </h1>
          <p className="text-gray-400 text-lg">
            ✨ AI-powered style companion
          </p>
        </div>
        
        {isLogin ? (
          <LoginForm
            onSuccess={() => {
              // Navigation will be handled by the Navigate component above
            }}
            onSwitchToRegister={() => setIsLogin(false)}
          />
        ) : (
          <RegisterForm
            onSuccess={() => {
              // Navigation will be handled by the Navigate component above
            }}
            onSwitchToLogin={() => setIsLogin(true)}
          />
        )}
      </div>
    </div>
  );
}