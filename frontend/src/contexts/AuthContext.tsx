'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
      } else {
        localStorage.removeItem('token');
      }

      const email = session?.user?.email;
      const name = (session?.user?.user_metadata as any)?.name || (session?.user?.user_metadata as any)?.fullName;
      if (email) {
        fetch('/api/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, fullName: name, id: session?.user?.id }),
        }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    if (!supabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm` : undefined,
        data: metadata,
      },
    });
    // Manejar errores de Supabase relacionados con correos
    if (error) {
      // Si el error está relacionado con correo, proporcionar un mensaje más claro
      if (error.message?.toLowerCase().includes('email') || 
          error.message?.toLowerCase().includes('correo') ||
          error.message?.toLowerCase().includes('mail')) {
        throw new Error(error.message || 'Error al enviar el correo electrónico de confirmación');
      }
      throw error;
    }

    // Sincronizar usuario explícitamente para asegurar envío de correo de bienvenida
    // Esto cubre el caso donde onAuthStateChange no se dispara inmediatamente (ej. email no verificado)
    if (data.user && data.user.email) {
      const name = metadata?.name || metadata?.fullName;
      try {
        const syncResponse = await fetch('/api/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.user.email, fullName: name, id: data.user.id }),
        });
        
        const syncData = await syncResponse.json();
        
        // Si la sincronización falla por problemas de correo, lanzar error específico
        // porque queremos informar al usuario sobre el problema
        if (!syncResponse.ok && syncData.error) {
          console.warn('Error sincronizando usuario:', syncData.error);
          // Si es un error de correo, lanzar un error específico
          if (syncData.emailError || 
              syncData.error.toLowerCase().includes('correo') || 
              syncData.error.toLowerCase().includes('email') || 
              syncData.error.toLowerCase().includes('mail')) {
            throw new Error('Error al enviar el correo electrónico de confirmación');
          }
          // Para otros errores de sincronización, también lanzar error
          throw new Error(syncData.error || 'Error al sincronizar usuario');
        }
      } catch (err: any) {
        // Si el error ya tiene un mensaje específico, lanzarlo
        if (err.message) {
          throw err;
        }
        // Para errores de red u otros, solo loguear en desarrollo
        if (process.env.NODE_ENV === 'development') {
          console.error('Error sincronizando usuario al registro:', err);
        }
        // No lanzar error para errores de red no críticos, el usuario ya fue creado en Supabase
      }
    }
  };

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    if (!supabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/update-password` : undefined,
    });
    if (error) throw error;
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
