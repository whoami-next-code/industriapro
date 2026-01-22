'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function VerifySupabaseComponent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const token = params?.get('token');
    const type = params?.get('type') || 'magiclink';
    
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación faltante');
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setStatus('error');
      setMessage('Configuración de Supabase faltante');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verificar el token con Supabase
    const verifyToken = async () => {
      try {
        // Para magiclink, necesitamos usar el endpoint de verificación de Supabase
        // Construir la URL de verificación de Supabase
        const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=${type}`;
        
        const response = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
          const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        
        if (!responseData.access_token) {
          throw new Error('No se recibió access_token de Supabase. El token puede haber expirado.');
        }

        // Establecer la sesión con Supabase
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: responseData.access_token,
          refresh_token: responseData.refresh_token || '',
        });

        if (sessionError) {
          throw new Error(`Error estableciendo sesión: ${sessionError.message}`);
        }

        if (!sessionData?.session) {
          throw new Error('No se pudo establecer la sesión después de verificar el token');
        }

        // Obtener el usuario actual de la sesión
        let user = sessionData.session.user;
        
        // Si no tenemos el usuario de la sesión, intentar obtenerlo
        if (!user) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            throw new Error(`Error obteniendo información del usuario: ${userError.message}`);
          }

          if (!userData?.user) {
            throw new Error('No se pudo obtener la información del usuario después de verificar el token');
          }

          user = userData.user;
        }

        // Sincronizar con el backend
        const secret = process.env.NEXT_PUBLIC_EXTERNAL_REG_SECRET || 'industriasp-external-reg-secret-2024-railway';
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        
        try {
          await fetch(`${apiUrl}/auth/register-external`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-external-secret': secret,
            },
            body: JSON.stringify({
              email: user.email,
              fullName: user.user_metadata?.fullName || user.user_metadata?.name,
              id: user.id,
            }),
          });
        } catch (e: any) {
          console.warn('Error sincronizando con backend (no crítico):', e);
          // No bloquear el flujo si falla la sincronización
        }

        setStatus('ok');
        setMessage('Tu correo ha sido verificado. Redirigiendo...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } catch (error: any) {
        console.error('Error verificando token:', error);
        setStatus('error');
        let errorMessage = 'El enlace de verificación no es válido o ha expirado.';
        
        if (error?.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error?.error) {
          errorMessage = error.error;
        }
        
        // Mensajes más amigables para errores comunes
        if (errorMessage.includes('expired') || errorMessage.includes('expirado')) {
          errorMessage = 'El enlace de verificación ha expirado. Por favor, solicita un nuevo enlace.';
        } else if (errorMessage.includes('invalid') || errorMessage.includes('inválido')) {
          errorMessage = 'El enlace de verificación no es válido. Por favor, verifica que el enlace sea correcto.';
        } else if (errorMessage.includes('obtener')) {
          errorMessage = 'Error al obtener la información del usuario. Por favor, intenta iniciar sesión manualmente.';
        }
        
        setMessage(errorMessage);
      }
    };

    verifyToken();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Verificación de correo</h1>
        <p className={`text-sm mb-6 ${status === 'error' ? 'text-red-600' : status === 'ok' ? 'text-emerald-700' : 'text-gray-600'}`}>
          {message || 'Verificando...'}
        </p>
        {status === 'error' && (
          <div className="mt-4">
            <button 
              onClick={() => router.push('/auth/login')} 
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifySupabasePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifySupabaseComponent />
    </Suspense>
  );
}
