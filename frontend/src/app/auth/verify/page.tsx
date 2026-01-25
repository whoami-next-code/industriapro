'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyComponent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    const token = params?.get('token');
    const emailParam = params?.get('email');
    if (emailParam && !resendEmail) {
      setResendEmail(emailParam);
    }
    if (!token) {
      setStatus('error');
      setMessage('Token de verificación faltante');
      return;
    }
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    fetch(`${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((data) => {
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
          document.cookie = `auth_token=${data.access_token}; path=/; max-age=604800`;
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          window.dispatchEvent(new Event('storage'));
        }
        setStatus('ok');
        setMessage('Tu correo ha sido verificado. Iniciando sesión...');
        setTimeout(() => router.push('/dashboard'), 1000);
      })
      .catch(() => {
        setStatus('error');
        setMessage('El enlace de verificación no es válido o ha expirado.');
      });
  }, [params, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setResendMessage('');
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail })
      });
      if (res.ok) {
        setResendMessage('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
      } else {
        const data = await res.json();
        setResendMessage(data.message || 'Error al reenviar correo.');
      }
    } catch {
      setResendMessage('Error de conexión.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Verificación de correo</h1>
        <p className={`text-sm mb-6 ${status === 'error' ? 'text-red-600' : status === 'ok' ? 'text-emerald-700' : 'text-gray-600'}`}>
          {message || 'Verificando...'}
        </p>

        {status === 'error' && (
          <div className="mt-6 border-t pt-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">¿Necesitas un nuevo enlace?</h2>
            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                placeholder="Ingresa tu correo electrónico"
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={resending}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resending ? 'Enviando...' : 'Reenviar verificación'}
              </button>
            </form>
            {resendMessage && (
              <p className={`mt-3 text-xs ${resendMessage.includes('reenviado') ? 'text-green-600' : 'text-red-600'}`}>
                {resendMessage}
              </p>
            )}
            <div className="mt-4">
               <button onClick={() => router.push('/auth/login')} className="text-xs text-gray-500 hover:text-gray-700 underline">
                 Volver al inicio de sesión
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyComponent />
    </Suspense>
  );
}

