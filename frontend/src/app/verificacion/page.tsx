'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Suspense } from 'react';

function VerificacionComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams) {
      const token = searchParams.get('token');
      const email = searchParams.get('email');
      
      if (token) {
        const params = new URLSearchParams();
        params.set('token', token);
        if (email) params.set('email', email);
        router.replace(`/auth/verify?${params.toString()}`);
      } else {
        router.replace('/auth/login');
      }
    } else {
      router.replace('/auth/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo a verificación...</p>
      </div>
    </div>
  );
}

export default function VerificacionRedirect() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerificacionComponent />
    </Suspense>
  );
}
