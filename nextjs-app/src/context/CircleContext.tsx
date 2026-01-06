'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { registerGetTokenFunction } from '@circleco/headless-client-sdk';

interface CircleContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  memberId: number | null;
  accessToken: string | null;
  refreshToken: () => Promise<void>;
}

const CircleContext = createContext<CircleContextType | undefined>(undefined);

export function CircleProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/circle/member-token');
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'MEMBER_INACTIVE') {
          setError('Tu cuenta de Circle está pendiente de activación. Revisa tu email.');
        } else {
          setError(data.error || 'Error al conectar con Circle');
        }
        setIsAuthenticated(false);
        return;
      }

      // Store token
      setAccessToken(data.accessToken);
      setMemberId(data.memberId);

      // Register token function with Circle SDK
      registerGetTokenFunction(() => data.accessToken);

      setIsAuthenticated(true);
      console.log('[Circle] Authenticated with member ID:', data.memberId);
    } catch (err) {
      console.error('[Circle] Authentication error:', err);
      setError('Error de conexión con Circle');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return (
    <CircleContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        memberId,
        accessToken,
        refreshToken: fetchToken,
      }}
    >
      {children}
    </CircleContext.Provider>
  );
}

export function useCircle() {
  const context = useContext(CircleContext);
  if (context === undefined) {
    throw new Error('useCircle must be used within a CircleProvider');
  }
  return context;
}
