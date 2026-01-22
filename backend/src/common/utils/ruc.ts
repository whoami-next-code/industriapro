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

  // Intento con Decolecta API (Prioridad)
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

  // Intento con proveedor público si hay base configurada
  if (base) {
    const url = `${base}/ruc/${clean}`;
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        // Normalización defensiva
        const razon =
          data?.razonSocial ||
          data?.nombre_o_razon_social ||
          data?.data?.nombre_o_razon_social;
        const comercio = data?.nombreComercial || data?.data?.nombre_comercial;
        const direccion = data?.direccion || data?.data?.direccion;
        const estado = data?.estado || data?.data?.estado;
        if (razon) {
          return {
            ruc: clean,
            razonSocial: String(razon),
            nombreComercial: comercio ? String(comercio) : undefined,
            direccion: direccion ? String(direccion) : undefined,
            estado: estado ? String(estado) : undefined,
          };
        }
      }
    } catch (err) {
      // Ignorar y seguir al fallback
      console.warn('obtenerDatosPorRUC: error consultando proveedor', err);
    }
  }

  // Fallback: datos simulados
  return {
    ruc: clean,
    razonSocial: 'Empresa Demo S.A.C.',
    nombreComercial: 'Industrias Demo',
    direccion: 'Av. Ejemplo 123, Lima',
    estado: 'ACTIVO',
  };
}
