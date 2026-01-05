'use client';

import { useAuth } from '@/context/AuthContext';
import { AuthForms } from '@/components/AuthForms';
import { MainApp } from '@/components/MainApp';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
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
          <AuthForms />
        </div>
      </div>
    );
  }

  return <MainApp />;
}
