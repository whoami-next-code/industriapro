/*
  Utilidades para validar RUC peruano y obtener datos básicos desde SUNAT.
  - validarRUC: verifica longitud (11) y dígito verificador usando ponderaciones [5,4,3,2,7,6,5,4,3,2].
  - obtenerDatosPorRUC: intenta consultar un endpoint público configurable y, si falla, devuelve datos simulados.

  Nota: Para producción se recomienda usar un proveedor oficial o un servicio propio con caché.
*/

export function validarRUC(ruc: string): boolean {
  const clean = (ruc || '').replace(/[^0-9]/g, '');
  if (clean.length !== 11) return false;
  // Ponderaciones para los 10 primeros dígitos
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = Number(clean[i]);
    if (Number.isNaN(d)) return false;
    sum += d * weights[i];
  }
  const remainder = sum % 11;
  let check = 11 - remainder;
  if (check === 10) check = 0;
  if (check === 11) check = 1;
  const last = Number(clean[10]);
  return check === last;
}

export type DatosRUC = {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  actividadEconomica?: string;
  representantesLegales?: Array<{
    nombre: string;
    documento?: string;
    cargo?: string;
  }>;
};

/**
 * Obtiene datos básicos de SUNAT por RUC.
 * Usa variables de entorno opcionales:
 *  - SUNAT_API_BASE: base URL del proveedor (por ejemplo, https://apiperu.dev/api)
 *  - API_TOKEN_SUNAT: token de autenticación si el proveedor lo requiere
 */
export async function obtenerDatosPorRUC(
  ruc: string,
): Promise<DatosRUC | null> {
  const clean = (ruc || '').replace(/[^0-9]/g, '');
  if (!validarRUC(clean)) return null;

  const base = process.env.SUNAT_API_BASE?.replace(/\/$/, '') || '';
  const token =
    process.env.API_TOKEN_SUNAT || process.env.API_TOKEN_RENIEC || '';

  console.log(`[SUNAT] ========== INICIANDO CONSULTA RUC: ${clean} ==========`);

  // PRIORIDAD 1: APIs.NET.PE - API pública gratuita de Perú
  try {
    const apisNetPeUrl = `https://api.apis.net.pe/v1/ruc?numero=${clean}`;
    console.log(`[SUNAT] Consultando APIs.NET.PE para RUC: ${clean}`);
    
    const response = await fetch(apisNetPeUrl, {
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://apis.net.pe',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[SUNAT] ✅ Respuesta recibida de APIs.NET.PE (status: ${response.status})`);
      console.log(`[SUNAT] Respuesta completa:`, JSON.stringify(data, null, 2));

      const responseData = data.data || data;
      const razonSocial = responseData.nombre || responseData.nombre_o_razon_social || responseData.razonSocial || '';
      
      if (razonSocial && razonSocial.trim().length > 0) {
        const result: DatosRUC = {
          ruc: clean,
          razonSocial: String(razonSocial).trim(),
          nombreComercial: responseData.nombreComercial || responseData.nombre_comercial,
          direccion: responseData.direccion || responseData.direccionCompleta || responseData.domicilio_fiscal,
          estado: responseData.estado || responseData.estadoContribuyente,
          condicion: responseData.condicion || responseData.condicionContribuyente,
          actividadEconomica: responseData.actividadEconomica || responseData.actividad_economica,
        };
        
        console.log(`[SUNAT] ✅ Resultado válido de APIs.NET.PE:`, JSON.stringify(result, null, 2));
        return result;
      }
    }
  } catch (e: any) {
    console.warn(`[SUNAT] ⚠️ APIs.NET.PE no disponible:`, e.message);
    // Continuar con otras opciones
  }

  // PRIORIDAD 2: APISPERU - Otra API pública gratuita
  try {
    const apisPeruUrl = `https://dniruc.apisperu.com/api/ruc/${clean}`;
    console.log(`[SUNAT] Consultando APISPERU para RUC: ${clean}`);
    
    const response = await fetch(apisPeruUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[SUNAT] ✅ Respuesta recibida de APISPERU (status: ${response.status})`);
      
      const razonSocial = data.razonSocial || data.nombre_o_razon_social || data.nombre || '';
      
      if (razonSocial && razonSocial.trim().length > 0) {
        const result: DatosRUC = {
          ruc: clean,
          razonSocial: String(razonSocial).trim(),
          nombreComercial: data.nombreComercial || data.nombre_comercial,
          direccion: data.direccion || data.direccionCompleta || data.domicilio_fiscal,
          estado: data.estado || data.estadoContribuyente,
          condicion: data.condicion || data.condicionContribuyente,
          actividadEconomica: data.actividadEconomica || data.actividad_economica,
        };
        
        console.log(`[SUNAT] ✅ Resultado válido de APISPERU:`, JSON.stringify(result, null, 2));
        return result;
      }
    }
  } catch (e: any) {
    console.warn(`[SUNAT] ⚠️ APISPERU no disponible:`, e.message);
    // Continuar con otras opciones
  }

  // PRIORIDAD 3: Decolecta API (si hay token)
  if (token && token.startsWith('sk_')) {
    try {
      const url = `https://api.decolecta.com/v1/sunat/ruc/full?numero=${clean}`;
      console.log(`[SUNAT] Consultando Decolecta para RUC: ${clean}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[SUNAT] Respuesta de Decolecta:`, JSON.stringify(data, null, 2));
        
        // Extraer representantes legales
        let representantesLegales: Array<{ nombre: string; documento?: string; cargo?: string }> = [];
        if (Array.isArray(data?.representantes_legales)) {
          console.log(`[SUNAT] Encontrados ${data.representantes_legales.length} representantes legales`);
          representantesLegales = data.representantes_legales.map((rep: any) => {
            if (typeof rep === 'string') {
              return { nombre: rep };
            }
            if (typeof rep === 'object' && rep !== null) {
              return {
                nombre: rep.nombre || rep.name || rep.nombres || rep.razon_social || '',
                documento: rep.documento || rep.document || rep.dni || rep.numero_documento,
                cargo: rep.cargo || rep.position,
              };
            }
            return { nombre: String(rep || '') };
          });
        } else if (data?.representante_legal) {
          console.log(`[SUNAT] Encontrado representante_legal (singular)`);
          const rep = data.representante_legal;
          representantesLegales = [{
            nombre: typeof rep === 'string' ? rep : (rep.nombre || rep.name || ''),
            documento: typeof rep === 'object' ? (rep.documento || rep.document || rep.dni) : undefined,
            cargo: typeof rep === 'object' ? (rep.cargo || rep.position) : undefined,
          }];
        } else {
          console.log(`[SUNAT] No se encontraron representantes legales en la respuesta`);
        }
        
        // Mapeo respuesta Decolecta
        const result = {
          ruc: clean,
          razonSocial: data.razon_social || data.nombre_o_razon_social || '',
          nombreComercial: data.nombre_comercial,
          direccion: data.direccion || data.domicilio_fiscal,
          estado: data.estado,
          condicion: data.condicion,
          actividadEconomica: data.actividad_economica,
          representantesLegales: representantesLegales.length > 0 ? representantesLegales : undefined,
        };
        console.log(`[SUNAT] Resultado final:`, JSON.stringify(result, null, 2));
        return result;
      } else {
        const errorText = await res.text();
        console.error(`[SUNAT] Error de Decolecta (${res.status}):`, errorText);
      }
    } catch (err: any) {
      console.error('obtenerDatosPorRUC: error consultando Decolecta', err.message, err);
    }
  }

  // Si llegamos aquí, todas las APIs fallaron
  console.error(`[SUNAT] ❌ No se pudo obtener datos de ningún servicio para RUC: ${clean}`);
  return null;
}
