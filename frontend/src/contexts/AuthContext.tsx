'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AuthUser = {
  userId: number;
  email: string;
  role: string;
};

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setAuthCookie(token: string, ttlSeconds = 604800) {
  const maxAge = Math.max(60, ttlSeconds);
  document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}`;
}

function clearAuthCookie() {
  document.cookie = 'auth_token=; path=/; max-age=0';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') ?? sessionStorage.getItem('token')
        : null;
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<AuthUser>('/auth/profile')
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: AuthUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    localStorage.setItem('token', data.access_token);
    setAuthCookie(data.access_token);
    setUser(data.user);
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        fullName: metadata?.fullName || metadata?.name,
      }),
    });
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    clearAuthCookie();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
