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

  // Prioridad: Decolecta API
  if (token && token.startsWith('sk_')) {
    try {
      const url = `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`;
      console.log(`[RENIEC] Consultando Decolecta para DNI: ${dni}`);
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`[RENIEC] Respuesta de Decolecta:`, JSON.stringify(data, null, 2));

      // Intentar múltiples formatos de respuesta de Decolecta
      const nombres = data.nombres ?? data.nombresCompleto ?? data.first_name ?? data.nombre;
      const apellidoPaterno =
        data.apellidoPaterno ?? data.apellido_paterno ?? data.first_last_name ?? data.primer_apellido;
      const apellidoMaterno =
        data.apellidoMaterno ?? data.apellido_materno ?? data.second_last_name ?? data.segundo_apellido;
      const fullName = data.full_name ?? data.nombre_completo ?? data.nombres_completos;

      console.log(`[RENIEC] Datos extraídos - nombres: ${nombres}, apellidoPaterno: ${apellidoPaterno}, apellidoMaterno: ${apellidoMaterno}, fullName: ${fullName}`);

      // Si tenemos fullName, intentar extraer las partes
      let nombresFinal = nombres;
      let apellidoPaternoFinal = apellidoPaterno;
      let apellidoMaternoFinal = apellidoMaterno;

      if (fullName && !nombres && !apellidoPaterno && !apellidoMaterno) {
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
      }

      // Si tenemos nombres o fullName, devolver los datos
      if (nombresFinal || apellidoPaternoFinal || apellidoMaternoFinal || fullName) {
        const result = {
          nombres: String(nombresFinal || ''),
          apellidoPaterno: String(apellidoPaternoFinal || ''),
          apellidoMaterno: String(apellidoMaternoFinal || ''),
          direccion: data.direccion || data.address || data.domicilio || data.direccion_completa,
          estadoCivil: data.estado_civil || data.civil_status || data.estadoCivil,
        };
        console.log(`[RENIEC] Resultado final:`, result);
        return result;
      } else {
        console.warn(`[RENIEC] No se encontraron nombres en la respuesta para DNI: ${dni}. Datos recibidos:`, data);
      }
    } catch (e: any) {
      console.error('Error consultando Decolecta (DNI):', e.message, e.response?.data);
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

  // Candidatos comunes
  urls.push(
    `https://api.apis.net.pe/v1/dni?numero=${dni}${token ? `&token=${token}` : ''}`,
  );
  urls.push(
    `https://dniruc.apisperu.com/api/DNI/${dni}${token ? `?token=${token}` : ''}`,
  );

  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { timeout: 5000 });
      // Normalizar campos según proveedor
      const nombres = data.nombres ?? data.nombresCompleto ?? data.nombre;
      const apellidoPaterno = data.apellidoPaterno ?? data.apellido_paterno;
      const apellidoMaterno = data.apellidoMaterno ?? data.apellido_materno;
      if (nombres) {
        return {
          nombres: String(nombres),
          apellidoPaterno: String(apellidoPaterno ?? ''),
          apellidoMaterno: String(apellidoMaterno ?? ''),
        };
      }
      if (data.success && data.data) {
        return {
          nombres: String(data.data.nombres ?? ''),
          apellidoPaterno: String(data.data.apellidoPaterno ?? ''),
          apellidoMaterno: String(data.data.apellidoMaterno ?? ''),
        };
      }
    } catch (err) {
      // continuar con siguiente URL
    }
  }

  // Fallback: datos simulados
  return {
    nombres: 'Cliente',
    apellidoPaterno: 'Demo',
    apellidoMaterno: dni?.slice(-2) || 'XX',
  };
}
