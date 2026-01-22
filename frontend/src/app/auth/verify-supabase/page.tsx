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
        // Construir la URL de verificación de Supabase
        const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=${type}&redirect_to=${encodeURIComponent(window.location.origin + '/auth/confirm')}`;
        
        // Hacer la verificación
        const response = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
          },
        });

        if (response.ok) {
          // Si la verificación es exitosa, redirigir a /auth/confirm para establecer la sesión
          const data = await response.json();
          if (data.access_token) {
            // Establecer la sesión con Supabase
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token || '',
            });

            if (sessionError) {
              throw sessionError;
            }

            // Sincronizar con el backend
            const secret = process.env.NEXT_PUBLIC_EXTERNAL_REG_SECRET || 'industriasp-external-reg-secret-2024-railway';
            const apiUrl = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            
            try {
              const user = (await supabase.auth.getUser()).data.user;
              if (user) {
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
              }
            } catch (e) {
              console.warn('Error sincronizando con backend:', e);
            }

            setStatus('ok');
            setMessage('Tu correo ha sido verificado. Redirigiendo...');
            setTimeout(() => {
              router.push('/dashboard');
            }, 1500);
          } else {
            throw new Error('No se recibió access_token de Supabase');
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
          throw new Error(errorData.error || 'Error al verificar el token');
        }
      } catch (error: any) {
        console.error('Error verificando token:', error);
        setStatus('error');
        setMessage(error.message || 'El enlace de verificación no es válido o ha expirado.');
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
