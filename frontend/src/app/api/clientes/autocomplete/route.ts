import { NextResponse } from 'next/server';

// API proxy que consulta el backend para obtener datos de DNI/RUC
// El backend tiene las API keys de RENIEC y SUNAT configuradas

function cleanDigits(s: string): string {
  return (s || '').replace(/[^0-9]/g, '');
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const docParam = url.searchParams.get('doc') || '';
    const doc = cleanDigits(docParam);

    if (!doc) {
      return NextResponse.json({ ok: false, error: 'Parámetro doc es requerido' }, { status: 400 });
    }

    // Consultar el backend que tiene las API keys configuradas
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const backendUrl = `${API_BASE}/clientes/autocomplete?doc=${encodeURIComponent(doc)}`;
    
    const resp = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ 
        ok: false, 
        error: `Error del backend: ${text || resp.statusText}` 
      }, { status: resp.status || 502 });
    }

    const data = await resp.json();
    console.log('[Frontend Autocomplete] Respuesta del backend:', JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en autocomplete proxy:', err);
    return NextResponse.json({ 
      ok: false, 
      error: err?.message || 'Error interno al consultar documento' 
    }, { status: 500 });
  }
}
