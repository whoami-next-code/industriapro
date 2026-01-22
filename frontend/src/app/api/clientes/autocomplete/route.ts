import { NextResponse } from 'next/server';

// API interno para autocompletar datos de cliente (DNI/RUC)
// Fuente: https://api.decolecta.com
// Requiere configurar un token en el entorno del frontend:
//  - DECOLECTA_API_TOKEN=sk_... (NO usar NEXT_PUBLIC_ para evitar exponerlo al cliente)

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

    const token = process.env.DECOLECTA_API_TOKEN;
    if (!token) {
      const dniMocks: Record<string, { name: string; address: string }> = {
        '12345678': { name: 'Juan Pérez', address: 'Av. Siempre Viva 123, Lima' },
        '87654321': { name: 'María López', address: 'Jr. Las Flores 456, Arequipa' },
      };
      const rucMocks: Record<string, { businessName: string; address: string }> = {
        '20123456789': { businessName: 'Industrias Ficticias S.A.C.', address: 'Calle Industria 789, Lima' },
      };
      if (doc.length <= 8) {
        const data = dniMocks[doc] || { name: 'Cliente', address: 'Dirección no disponible' };
        return NextResponse.json({ type: 'DNI', ...data });
      }
      if (doc.length === 11) {
        const data = rucMocks[doc] || { businessName: 'Empresa', address: 'Dirección no disponible' };
        return NextResponse.json({ type: 'RUC', ...data });
      }
      return NextResponse.json({ error: 'Documento no válido' }, { status: 400 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    } as const;

    // Determinar si es DNI (8) o RUC (11)
    if (doc.length === 8) {
      // RENIEC DNI
      const endpoint = `https://api.decolecta.com/v1/reniec/dni?numero=${encodeURIComponent(doc)}`;
      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ ok: false, error: `RENIEC error: ${text || resp.statusText}` }, { status: resp.status || 502 });
      }
      const data = await resp.json();
      // Ejemplo de respuesta esperada:
      // { first_name, first_last_name, second_last_name, full_name, document_number, direccion }
      
      // Construir nombre completo desde diferentes formatos posibles
      let fullName = '';
      
      if (data?.full_name) {
        fullName = String(data.full_name).trim();
      } else if (data?.nombres_completos) {
        fullName = String(data.nombres_completos).trim();
      } else if (data?.nombre_completo) {
        fullName = String(data.nombre_completo).trim();
      } else {
        // Construir desde partes
        const parts = [
          data?.first_name || data?.nombres || data?.primer_nombre,
          data?.first_last_name || data?.apellido_paterno || data?.primer_apellido,
          data?.second_last_name || data?.apellido_materno || data?.segundo_apellido,
        ].filter(Boolean);
        fullName = parts.join(' ').trim();
      }
      
      // Extraer dirección desde diferentes campos posibles
      const address = data?.direccion || data?.address || data?.domicilio || data?.domicilio_fiscal || undefined;
      
      return NextResponse.json({
        ok: true,
        type: 'DNI',
        name: fullName || 'Cliente',
        document: String(data?.document_number || data?.numero_documento || data?.dni || doc),
        address: address ? String(address) : undefined,
        civilStatus: (data?.estado_civil ? String(data.estado_civil) : undefined),
        raw: data,
      });
    }

    if (doc.length === 11) {
      // SUNAT RUC
      const endpoint = `https://api.decolecta.com/v1/sunat/ruc/full?numero=${encodeURIComponent(doc)}`;
      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ ok: false, error: `SUNAT error: ${text || resp.statusText}` }, { status: resp.status || 502 });
      }
      const data = await resp.json();
      // Ejemplo de respuesta:
      // { razon_social, numero_documento, direccion, representantes_legales, ... }
      
      // Extraer representantes legales en diferentes formatos posibles
      let legalRepresentatives: any[] = [];
      
      // Formato 1: Array directo
      if (Array.isArray(data?.representantes_legales)) {
        legalRepresentatives = data.representantes_legales;
      }
      // Formato 2: Campo con nombre alternativo
      else if (Array.isArray(data?.representantes)) {
        legalRepresentatives = data.representantes;
      }
      // Formato 3: Campo en data.representantes_legales
      else if (Array.isArray((data as any)?.data?.representantes_legales)) {
        legalRepresentatives = (data as any).data.representantes_legales;
      }
      // Formato 4: Campo representante_legal (singular) como objeto
      else if (data?.representante_legal) {
        legalRepresentatives = [data.representante_legal];
      }
      // Formato 5: Campo en formato de objeto con propiedades
      else if (data?.representantes_legales && typeof data.representantes_legales === 'object') {
        legalRepresentatives = Object.values(data.representantes_legales);
      }
      
      // Normalizar representantes legales para que tengan formato consistente
      const normalizedRepresentatives = legalRepresentatives.map((rep: any) => {
        if (typeof rep === 'string') {
          return { nombre: rep, documento: '' };
        }
        if (typeof rep === 'object' && rep !== null) {
          return {
            nombre: rep.nombre || rep.name || rep.nombres || rep.razon_social || '',
            documento: rep.documento || rep.document || rep.dni || rep.numero_documento || '',
            cargo: rep.cargo || rep.position || '',
          };
        }
        return { nombre: String(rep || ''), documento: '' };
      });
      
      return NextResponse.json({
        ok: true,
        type: 'RUC',
        businessName: String(data?.razon_social || data?.nombre_o_razon_social || ''),
        document: String(data?.numero_documento || data?.ruc || doc),
        address: String(data?.direccion || data?.domicilio_fiscal || ''),
        status: (data?.estado ? String(data.estado) : undefined),
        condition: (data?.condicion ? String(data.condicion) : undefined),
        activity: (data?.actividad_economica ? String(data.actividad_economica) : undefined),
        legalRepresentatives: normalizedRepresentatives,
        raw: data,
      });
    }

    return NextResponse.json({ ok: false, error: 'Formato de documento inválido (DNI 8 dígitos, RUC 11 dígitos)' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 });
  }
}
