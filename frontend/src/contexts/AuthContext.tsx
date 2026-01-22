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
    
    try {
      // Intentar primero con redirección, si falla con 500, intentar sin redirección
      let data, error;
      
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm` : undefined,
          data: metadata,
        },
      });
      data = result.data;
      error = result.error;
      
      // Si hay error 500, intentar sin redirección
      if (error && (error.status === 500 || error.message?.includes('500') || error.message?.includes('Internal Server Error'))) {
        console.warn('Signup con redirección falló (500), intentando sin redirección...', error);
        const retryResult = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata,
          },
        });
        data = retryResult.data;
        error = retryResult.error;
      }
      
      // Manejar errores de Supabase
      if (error) {
        // Error 500 de Supabase - problema de configuración del servidor
        if (error.status === 500 || error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
          console.error('Error 500 de Supabase:', error);
          throw new Error('Error del servidor de autenticación. Verifica la configuración de Supabase o contacta al administrador.');
        }
        // Error de email/correo
        if (error.message?.toLowerCase().includes('email') || 
            error.message?.toLowerCase().includes('correo') ||
            error.message?.toLowerCase().includes('mail')) {
          throw new Error(error.message || 'Error al enviar el correo electrónico de confirmación');
        }
        // Otros errores
        throw new Error(error.message || 'Error al crear la cuenta');
      }
      
      // Si no hay usuario creado, lanzar error
      if (!data.user) {
        throw new Error('No se pudo crear el usuario');
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
          
          // Si la sincronización falla, solo loguear el error pero no bloquear el registro
          // porque Supabase ya envió su correo de confirmación y el usuario fue creado
          if (!syncResponse.ok && syncData.error) {
            console.warn('Error sincronizando usuario (no crítico):', syncData.error);
            // No lanzar error - el usuario ya fue creado en Supabase y recibirá su correo de confirmación
          }
        } catch (err: any) {
          // Solo loguear errores de red, no bloquear el registro
          console.warn('Error de red al sincronizar usuario (no crítico):', err);
          // No lanzar error - el usuario ya fue creado en Supabase
        }
      }
    } catch (err: any) {
      // Re-lanzar errores de Supabase con mensajes mejorados
      throw err;
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
