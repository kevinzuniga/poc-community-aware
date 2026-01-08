'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

const APP_VERSION = 'v1.3.0';

function LoginContent() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    console.log('[Login] App Version:', APP_VERSION);
  }, []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, register, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get('returnTo');

  useEffect(() => {
    // If user is already logged in, redirect to returnTo or home
    if (user && !authLoading) {
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        router.push('/');
      }
    }
  }, [user, authLoading, returnTo, router]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await login(email, password);
      // After successful login, redirect to returnTo or home
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await register(email, password, name);
      // After successful registration, redirect to returnTo or home
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700">
      {/* Header */}
      <header className="py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Leadership Academy</h1>
        </div>
      </header>

      {/* Auth Forms */}
      <div className="px-4">
        <div className="w-full max-w-md mx-auto mt-8">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === 'login'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('login')}
              >
                Iniciar Sesion
              </button>
              <button
                className={`flex-1 py-4 text-center font-medium transition-colors ${
                  activeTab === 'register'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab('register')}
              >
                Registrarse
              </button>
            </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
                  Iniciar Sesion
                </h2>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Contrasena
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="p-6 space-y-4">
                <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
                  Crear Cuenta
                </h2>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Contrasena
                  </label>
                  <input
                    type="password"
                    name="password"
                    minLength={6}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Registrando...' : 'Registrarse'}
                </button>
              </form>
            )}
          </div>

          {/* Version */}
          <p className="text-center text-white/80 text-sm mt-4 font-medium">
            {APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">Cargando...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
