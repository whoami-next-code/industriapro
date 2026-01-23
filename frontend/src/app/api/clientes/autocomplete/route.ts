import { NextResponse } from 'next/server';

// API proxy que consulta el backend para obtener datos de DNI/RUC
// El backend tiene las API keys de RENIEC y SUNAT configuradas

function cleanDigits(s: string): string {
  return (s || '').replace(/[^0-9]/g, '');
}

export async function GET(req: Request) {
  // Logging que aparecerá en los logs de Railway
  console.error('[Frontend Autocomplete] ========== ENDPOINT LLAMADO ==========');
  console.log('[Frontend Autocomplete] ========== ENDPOINT LLAMADO ==========');
  try {
    const url = new URL(req.url);
    const docParam = url.searchParams.get('doc') || '';
    const doc = cleanDigits(docParam);

    console.log('[Frontend Autocomplete] docParam recibido:', docParam);
    console.log('[Frontend Autocomplete] doc limpio:', doc);

    if (!doc) {
      console.error('[Frontend Autocomplete] Error: doc vacío');
      return NextResponse.json({ ok: false, error: 'Parámetro doc es requerido' }, { status: 400 });
    }

    // Consultar el backend que tiene las API keys configuradas
    // En API routes de Next.js, podemos usar variables sin NEXT_PUBLIC_ también
    const API_BASE = 
      process.env.NEXT_PUBLIC_API_BASE || 
      process.env.NEXT_PUBLIC_API_URL || 
      process.env.API_BASE ||
      process.env.API_URL ||
      'https://backend-production-0c3e.up.railway.app/api';
    
    // Asegurar que termine en /api
    const normalizedApiBase = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE.replace(/\/api\/?$/, '')}/api`;
    const backendUrl = `${normalizedApiBase}/clientes/autocomplete?doc=${encodeURIComponent(doc)}`;
    
    // Usar console.error para que aparezca en los logs de Railway
    console.error('[Frontend Autocomplete] ========== CONFIGURACIÓN ==========');
    console.error('[Frontend Autocomplete] NEXT_PUBLIC_API_BASE:', process.env.NEXT_PUBLIC_API_BASE || 'NO CONFIGURADO');
    console.error('[Frontend Autocomplete] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL || 'NO CONFIGURADO');
    console.error('[Frontend Autocomplete] API_BASE (env):', process.env.API_BASE || 'NO CONFIGURADO');
    console.error('[Frontend Autocomplete] API_URL (env):', process.env.API_URL || 'NO CONFIGURADO');
    console.error('[Frontend Autocomplete] API_BASE final:', API_BASE);
    console.error('[Frontend Autocomplete] normalizedApiBase:', normalizedApiBase);
    console.error('[Frontend Autocomplete] backendUrl:', backendUrl);
    console.error('[Frontend Autocomplete] Documento a consultar:', doc);
    
    // También usar console.log
    console.log('[Frontend Autocomplete] ========== CONFIGURACIÓN ==========');
    console.log('[Frontend Autocomplete] backendUrl:', backendUrl);
    console.log('[Frontend Autocomplete] Documento:', doc);
    
    let resp: Response;
    try {
      // Crear AbortController para timeout manual (AbortSignal.timeout puede no estar disponible)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      resp = await fetch(backendUrl, {
        method: 'GET',
        headers: {
      'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.error('[Frontend Autocomplete] ✅ Fetch completado, status:', resp.status);
      console.log('[Frontend Autocomplete] ✅ Fetch completado, status:', resp.status);
    } catch (fetchError: any) {
      console.error('[Frontend Autocomplete] ❌ Error al hacer fetch:', fetchError);
      console.error('[Frontend Autocomplete] ❌ Error stack:', fetchError?.stack);
      return NextResponse.json({ 
        ok: false, 
        error: `Error de conexión al backend: ${fetchError?.message || 'No se pudo conectar al servidor'}` 
      }, { status: 502 });
    }
    
    console.log('[Frontend Autocomplete] Respuesta del backend - status:', resp.status, resp.statusText);

      if (!resp.ok) {
        const text = await resp.text();
      console.error('[Frontend Autocomplete] Error del backend:', text);
      return NextResponse.json({ 
        ok: false, 
        error: `Error del backend (${resp.status}): ${text || resp.statusText}` 
      }, { status: resp.status || 502 });
      }

      const data = await resp.json();
    console.log('[Frontend Autocomplete] Respuesta del backend (datos):', JSON.stringify(data, null, 2));
    
    // Verificar que la respuesta tenga los campos esperados
    if (!data.ok && data.error) {
      console.error('[Frontend Autocomplete] Backend devolvió error:', data.error);
      return NextResponse.json(data, { status: 400 });
      }
    
    // Verificar que los datos no sean genéricos
    if (data.ok && data.type === 'DNI' && (!data.name || data.name === 'Cliente')) {
      console.warn('[Frontend Autocomplete] ⚠️ Backend devolvió nombre genérico para DNI:', data);
    }
    if (data.ok && data.type === 'RUC' && (!data.businessName || data.businessName === 'Empresa')) {
      console.warn('[Frontend Autocomplete] ⚠️ Backend devolvió razón social genérica para RUC:', data);
    }
    
    console.log('[Frontend Autocomplete] ✅ Devolviendo datos al cliente');
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en autocomplete proxy:', err);
    return NextResponse.json({ 
      ok: false, 
      error: err?.message || 'Error interno al consultar documento' 
    }, { status: 500 });
  }
}
