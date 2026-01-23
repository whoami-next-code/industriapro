import axios from 'axios';

type ReniecResponse = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  direccion?: string;
  estadoCivil?: string;
};

/**
 * Obtiene datos del ciudadano por DNI utilizando servicios públicos.
 * Intenta varias URLs conocidas y usa un token de entorno.
 * En caso de error, devuelve datos simulados para que la pasarela ficticia funcione.
 */
export async function obtenerDatosPorDNI(dni: string): Promise<ReniecResponse> {
  const token = process.env.API_TOKEN_RENIEC;

  console.log(`[RENIEC] ========== INICIANDO CONSULTA DNI: ${dni} ==========`);
  console.log(`[RENIEC] Token configurado: ${token ? (token.substring(0, 10) + '...') : 'NO CONFIGURADO'}`);

  // PRIORIDAD 1: APIs.NET.PE - API pública gratuita de Perú
  try {
    const apisNetPeUrl = `https://api.apis.net.pe/v1/dni?numero=${dni}`;
    console.log(`[RENIEC] Consultando APIs.NET.PE para DNI: ${dni}`);
    
    const response = await axios.get(apisNetPeUrl, {
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://apis.net.pe',
      },
      timeout: 8000,
    });

    const data = response.data;
    console.log(`[RENIEC] ✅ Respuesta recibida de APIs.NET.PE (status: ${response.status})`);
    console.log(`[RENIEC] Respuesta completa:`, JSON.stringify(data, null, 2));

    // APIs.NET.PE devuelve los datos directamente o en data.data
    const responseData = data.data || data;
    
    const nombres = responseData.nombres || responseData.nombre || '';
    const apellidoPaterno = responseData.apellidoPaterno || responseData.apellido_paterno || '';
    const apellidoMaterno = responseData.apellidoMaterno || responseData.apellido_materno || '';
    const direccion = responseData.direccion || responseData.direccionCompleta || '';

    if (nombres && nombres.trim().length > 0) {
      const result = {
        nombres: String(nombres).trim(),
        apellidoPaterno: String(apellidoPaterno).trim(),
        apellidoMaterno: String(apellidoMaterno).trim(),
        direccion: direccion ? String(direccion).trim() : undefined,
        estadoCivil: responseData.estadoCivil || responseData.estado_civil,
      };
      
      console.log(`[RENIEC] ✅ Resultado válido de APIs.NET.PE:`, JSON.stringify(result, null, 2));
      return result;
    }
  } catch (e: any) {
    console.warn(`[RENIEC] ⚠️ APIs.NET.PE no disponible:`, e.message);
    // Continuar con otras opciones
  }

  // PRIORIDAD 2: APISPERU - Otra API pública gratuita
  try {
    const apisPeruUrl = `https://dniruc.apisperu.com/api/dni/${dni}`;
    console.log(`[RENIEC] Consultando APISPERU para DNI: ${dni}`);
    
    const response = await axios.get(apisPeruUrl, {
      timeout: 8000,
    });

    const data = response.data;
    console.log(`[RENIEC] ✅ Respuesta recibida de APISPERU (status: ${response.status})`);
    
    if (data.nombres || data.nombre) {
      const result = {
        nombres: String(data.nombres || data.nombre || '').trim(),
        apellidoPaterno: String(data.apellidoPaterno || data.apellido_paterno || '').trim(),
        apellidoMaterno: String(data.apellidoMaterno || data.apellido_materno || '').trim(),
        direccion: data.direccion || data.direccionCompleta,
        estadoCivil: data.estadoCivil || data.estado_civil,
      };
      
      if (result.nombres.length > 0) {
        console.log(`[RENIEC] ✅ Resultado válido de APISPERU:`, JSON.stringify(result, null, 2));
        return result;
      }
    }
  } catch (e: any) {
    console.warn(`[RENIEC] ⚠️ APISPERU no disponible:`, e.message);
    // Continuar con otras opciones
  }

  // PRIORIDAD 3: Decolecta API (si hay token)
  if (token && token.startsWith('sk_')) {
    try {
      const url = `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`;
      console.log(`[RENIEC] Consultando Decolecta para DNI: ${dni}`);
      console.log(`[RENIEC] URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const data = response.data;
      console.log(`[RENIEC] ✅ Respuesta recibida de Decolecta (status: ${response.status})`);
      console.log(`[RENIEC] Respuesta completa:`, JSON.stringify(data, null, 2));

      // Verificar si la respuesta tiene un campo de error
      if (data.error || data.message) {
        console.error(`[RENIEC] ❌ Error en respuesta de Decolecta:`, data.error || data.message);
        throw new Error(data.error || data.message || 'Error en respuesta de Decolecta');
      }

      // Intentar múltiples formatos de respuesta de Decolecta
      // Buscar en data.data si existe (algunas APIs envuelven la respuesta)
      const responseData = data.data || data;
      
      const nombres = responseData.nombres ?? responseData.nombresCompleto ?? responseData.first_name ?? responseData.nombre ?? responseData.nombres_completos;
      const apellidoPaterno =
        responseData.apellidoPaterno ?? responseData.apellido_paterno ?? responseData.first_last_name ?? responseData.primer_apellido;
      const apellidoMaterno =
        responseData.apellidoMaterno ?? responseData.apellido_materno ?? responseData.second_last_name ?? responseData.segundo_apellido;
      const fullName = responseData.full_name ?? responseData.nombre_completo ?? responseData.nombres_completos ?? responseData.complete_name;

      console.log(`[RENIEC] Datos extraídos - nombres: "${nombres}", apellidoPaterno: "${apellidoPaterno}", apellidoMaterno: "${apellidoMaterno}", fullName: "${fullName}"`);

      // Si tenemos fullName, intentar extraer las partes
      let nombresFinal = nombres;
      let apellidoPaternoFinal = apellidoPaterno;
      let apellidoMaternoFinal = apellidoMaterno;

      if (fullName && !nombres && !apellidoPaterno && !apellidoMaterno) {
        console.log(`[RENIEC] Usando fullName y dividiéndolo: "${fullName}"`);
        // Si solo tenemos fullName, intentar dividirlo
        const partes = fullName.trim().split(/\s+/);
        if (partes.length >= 3) {
          apellidoPaternoFinal = partes[0];
          apellidoMaternoFinal = partes[1];
          nombresFinal = partes.slice(2).join(' ');
        } else if (partes.length === 2) {
          apellidoPaternoFinal = partes[0];
          nombresFinal = partes[1];
        } else {
          nombresFinal = fullName;
        }
        console.log(`[RENIEC] Después de dividir - nombresFinal: "${nombresFinal}", apellidoPaternoFinal: "${apellidoPaternoFinal}", apellidoMaternoFinal: "${apellidoMaternoFinal}"`);
      }

      // Validar que tengamos al menos un nombre (no genérico)
      const nombreCompleto = [apellidoPaternoFinal, apellidoMaternoFinal, nombresFinal].filter(Boolean).join(' ').trim();
      
      if (!nombreCompleto || nombreCompleto === 'Cliente' || nombreCompleto.length < 3) {
        console.warn(`[RENIEC] ⚠️ Nombre completo inválido o genérico: "${nombreCompleto}"`);
        throw new Error('No se encontraron datos válidos en la respuesta de Decolecta');
      }

      // Si tenemos nombres o fullName, devolver los datos
      if (nombresFinal || apellidoPaternoFinal || apellidoMaternoFinal || fullName) {
        const result = {
          nombres: String(nombresFinal || ''),
          apellidoPaterno: String(apellidoPaternoFinal || ''),
          apellidoMaterno: String(apellidoMaternoFinal || ''),
          direccion: responseData.direccion || responseData.address || responseData.domicilio || responseData.direccion_completa || data.direccion || data.address,
          estadoCivil: responseData.estado_civil || responseData.civil_status || responseData.estadoCivil || data.estado_civil,
        };
        console.log(`[RENIEC] ✅ Resultado final válido:`, JSON.stringify(result, null, 2));
        return result;
      } else {
        console.warn(`[RENIEC] ⚠️ No se encontraron nombres en la respuesta para DNI: ${dni}. Datos recibidos:`, JSON.stringify(data, null, 2));
        throw new Error('No se encontraron datos de nombre en la respuesta de Decolecta');
      }
    } catch (e: any) {
      console.error(`[RENIEC] ❌ Error consultando Decolecta (DNI: ${dni}):`, {
        message: e.message,
        status: e.response?.status,
        statusText: e.response?.statusText,
        data: e.response?.data,
        code: e.code,
      });
      
      // Si es un error de autenticación o token inválido, no intentar otros servicios
      if (e.response?.status === 401 || e.response?.status === 403) {
        throw new Error(`Error de autenticación con Decolecta: ${e.response?.data?.message || e.message}`);
      }
      
      // Si es un error 404 o el DNI no existe, no usar fallback genérico
      if (e.response?.status === 404) {
        throw new Error(`DNI ${dni} no encontrado en RENIEC`);
      }
      
      // Re-lanzar el error para que se intente con otros servicios
      throw e;
    }
  }

  const base = process.env.RENIEC_API_BASE; // opcional: permite sobreescribir la base

  const urls: string[] = [];
  if (base) {
    // Admitir bases tipo apis.net.pe (con query) o apisperu (path)
    if (base.includes('apis.net.pe')) {
      urls.push(
        `${base}${base.includes('?') ? '&' : '?'}numero=${dni}${token ? `&token=${token}` : ''}`,
      );
    } else {
      urls.push(`${base}/${dni}${token ? `?token=${token}` : ''}`);
    }
  }

  // Si llegamos aquí, todas las APIs fallaron
  console.error(`[RENIEC] ❌ No se pudo obtener datos de ningún servicio para DNI: ${dni}`);
  throw new Error(`No se pudieron obtener datos del DNI ${dni}. Por favor, verifique que el DNI sea correcto.`);
}
