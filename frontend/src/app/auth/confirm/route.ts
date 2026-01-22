import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      },
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    
    // Forzar sincronización inmediata con backend si la sesión se estableció
    if (data?.session?.user?.email) {
      const user = data.session.user;
      const secret = process.env.EXTERNAL_REG_SECRET || 'industriasp-sync-secret';
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
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error sincronizando en confirmación:', e);
        }
      }
    }
  }

  // Redirigir al dashboard después de verificar
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
