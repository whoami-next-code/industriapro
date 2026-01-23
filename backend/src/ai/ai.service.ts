import { Injectable, Logger } from '@nestjs/common';
import { AnalizarContactoDto } from './dto/analizar-contacto.dto';

@Injectable()
export class AiService {
  private apiKey = process.env.OPENAI_API_KEY;
  private readonly logger = new Logger(AiService.name);

  async analizarContacto(dto: AnalizarContactoDto) {
    if (!dto?.nombre || !dto?.mensaje) {
      return this.mockAnalysis({
        nombre: dto?.nombre ?? 'Cliente',
        mensaje: dto?.mensaje ?? '',
        email: dto?.email,
      });
    }
    // Si hay API Key configurada, intentamos usar OpenAI.
    // En caso de error, hacemos fallback al análisis local.
    if (this.apiKey) {
      try {
        return await this.callOpenAI(dto);
      } catch (err) {
        this.logger.error(
          `Error llamando a OpenAI, usando análisis local. Detalle: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return this.mockAnalysis(dto);
      }
    }

    return this.mockAnalysis(dto);
  }

  private async callOpenAI(dto: AnalizarContactoDto) {
    const systemPrompt =
      'Eres un asistente para un CRM industrial. Tienes que analizar mensajes de contacto ' +
      'de clientes y responder SIEMPRE en JSON con esta forma exacta: ' +
      '{ "categoria": string, "prioridad": string, "respuestaSugerida": string, "analisis": string }. ' +
      'No incluyas nada fuera del JSON. ' +
      'Las categorías típicas pueden ser: "Ventas / Cotización", "Soporte Técnico", "Logística / Envíos", "Facturación", "Postventa / Reclamo", "Consulta General". ' +
      'La prioridad puede ser "Alta", "Media" o "Baja". ' +
      'La respuesta sugerida debe ser coherente con el mensaje y el servicio de interés. ' +
      'Si el mensaje es de soporte técnico, sugiere de forma natural coordinar una visita técnica si aplica.';

    const userPrompt = [
      `Nombre: ${dto.nombre}`,
      dto.email ? `Email: ${dto.email}` : '',
      '',
      'Mensaje del cliente:',
      dto.mensaje,
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.6,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(
        `Error de OpenAI: ${res.status} ${
          text.length > 200 ? text.slice(0, 200) + '...' : text
        }`,
      );
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      throw new Error('Respuesta inválida de OpenAI (sin contenido de mensaje)');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error('No se pudo parsear el JSON devuelto por OpenAI');
    }

    const categoria =
      typeof parsed.categoria === 'string'
        ? parsed.categoria
        : 'Consulta General';
    const prioridad =
      typeof parsed.prioridad === 'string' ? parsed.prioridad : 'Media';
    const respuestaSugerida =
      typeof parsed.respuestaSugerida === 'string'
        ? parsed.respuestaSugerida
        : `Hola ${dto.nombre},\n\nGracias por contactarte con nosotros. Hemos recibido tu mensaje y te responderemos a la brevedad.\n\nSaludos,`;
    const analisis =
      typeof parsed.analisis === 'string'
        ? parsed.analisis
        : 'Análisis generado automáticamente a partir del mensaje del cliente.';

    return {
      categoria,
      prioridad,
      respuestaSugerida,
      analisis,
    };
  }

  private mockAnalysis(dto: AnalizarContactoDto) {
    const msgRaw = dto.mensaje ?? '';
    const msg = msgRaw.toLowerCase();
    const seed = this.hashSeed(`${dto.nombre}|${dto.email ?? ''}|${msgRaw}`);

    const flags = {
      ventas: this.hasAny(msg, ['precio', 'costo', 'cotizacion', 'cotización', 'proforma', 'comprar', 'adquirir', 'presupuesto']),
      soporte: this.hasAny(msg, ['error', 'falla', 'problema', 'no funciona', 'averiado', 'dañado', 'intermitente', 'garantia', 'garantía', 'mantenimiento', 'instalacion', 'instalación']),
      logistica: this.hasAny(msg, ['envio', 'envío', 'entrega', 'seguimiento', 'tracking', 'guia', 'guía', 'pedido', 'retraso', 'demora']),
      facturacion: this.hasAny(msg, ['factura', 'boleta', 'ruc', 'comprobante', 'credito', 'crédito', 'nc', 'nd']),
      reclamo: this.hasAny(msg, ['reclamo', 'queja', 'devolucion', 'devolución', 'mal servicio', 'reembolso', 'garantia', 'garantía']),
      urgente: this.hasAny(msg, ['urgente', 'hoy', 'inmediato', 'ahora', 'asap', 'ya', 'critico', 'crítico', 'produccion', 'producción', 'parado']),
      saludo: this.hasAny(msg, ['hola', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'gracias']),
    };

    let categoria = 'Consulta General';
    if (flags.facturacion) categoria = 'Facturación';
    else if (flags.reclamo) categoria = 'Postventa / Reclamo';
    else if (flags.soporte) categoria = 'Soporte Técnico';
    else if (flags.logistica) categoria = 'Logística / Envíos';
    else if (flags.ventas) categoria = 'Ventas / Cotización';

    let prioridad: 'Alta' | 'Media' | 'Baja' = 'Media';
    if (flags.urgente || (flags.soporte && this.hasAny(msg, ['no funciona', 'parado', 'critico', 'crítico']))) {
      prioridad = 'Alta';
    } else if (flags.logistica && this.hasAny(msg, ['retraso', 'demora', 'no llega'])) {
      prioridad = 'Alta';
    } else if (flags.saludo && msg.length < 60 && !flags.ventas && !flags.soporte && !flags.logistica) {
      prioridad = 'Baja';
    }

    const templates: Record<string, string[]> = {
      'Ventas / Cotización': [
        `Hola ${dto.nombre},\n\nGracias por tu interés. Para cotizarte con precisión, ¿podrías indicarnos cantidades, medidas y uso previsto?\n\nQuedamos atentos,\nEquipo Comercial`,
        `Hola ${dto.nombre},\n\nCon gusto te ayudamos con la cotización. ¿Tienes ficha técnica o especificaciones? También indícanos cantidades y fecha estimada.\n\nSaludos,`,
        `Hola ${dto.nombre},\n\nPara avanzar con el presupuesto necesito: producto(s), cantidades y lugar de entrega.\n\nQuedo atento,`,
      ],
      'Soporte Técnico': [
        `Hola ${dto.nombre},\n\nLamentamos el inconveniente. ¿Puedes describir el error, cuándo ocurre y adjuntar fotos o video? Si es necesario, podemos coordinar una visita técnica para revisarlo en sitio.\n\nRevisaremos tu caso con prioridad.\n\nSaludos,`,
        `Hola ${dto.nombre},\n\nPara ayudarte mejor, indícanos modelo, fecha de compra y el síntoma exacto. Con esa info podemos diagnosticar rápido y, si aplica, programar una visita técnica.\n\nGracias,`,
        `Hola ${dto.nombre},\n\nEstamos para ayudarte. ¿El equipo muestra algún código de error o sonido inusual? Envíanos detalles y coordinamos una visita técnica si se requiere.\n\nSaludos,`,
      ],
      'Logística / Envíos': [
        `Hola ${dto.nombre},\n\nVerificaremos el estado de tu envío y te compartiremos el tracking actualizado.\n\nSaludos cordiales,`,
        `Hola ${dto.nombre},\n\nGracias por escribirnos. ¿Podrías confirmar tu número de pedido para revisar la entrega?\n\nSaludos,`,
        `Hola ${dto.nombre},\n\nEstamos revisando tu despacho. En breve te informamos el avance y la fecha estimada.\n\nGracias,`,
      ],
      'Facturación': [
        `Hola ${dto.nombre},\n\nPodemos ayudarte con el comprobante. Envíanos RUC, razón social y el número de pedido.\n\nSaludos,`,
        `Hola ${dto.nombre},\n\nPara emitir o corregir tu factura necesito: RUC, dirección fiscal y detalle del pedido.\n\nQuedo atento,`,
      ],
      'Postventa / Reclamo': [
        `Hola ${dto.nombre},\n\nLamentamos lo ocurrido. Para atender el reclamo, cuéntanos qué sucedió y adjunta evidencias si es posible.\n\nEstamos atentos,`,
        `Hola ${dto.nombre},\n\nQueremos resolverlo cuanto antes. ¿Podrías indicar fecha de compra y descripción del problema?\n\nGracias,`,
      ],
      'Consulta General': [
        `Hola ${dto.nombre},\n\nGracias por contactarnos. Cuéntanos un poco más para orientarte correctamente.\n\nSaludos,`,
        `Hola ${dto.nombre},\n\nRecibimos tu mensaje. ¿Podrías ampliar la información para ayudarte mejor?\n\nSaludos cordiales,`,
      ],
    };

    const sugerencia = this.pickTemplate(templates[categoria] ?? templates['Consulta General'], seed);

    const razones: string[] = [];
    if (flags.ventas) razones.push('consulta comercial');
    if (flags.soporte) razones.push('menciona fallas/soporte');
    if (flags.logistica) razones.push('temas de envio/entrega');
    if (flags.facturacion) razones.push('consulta de facturacion');
    if (flags.reclamo) razones.push('reclamo/postventa');
    if (flags.urgente) razones.push('indicadores de urgencia');
    if (!razones.length) razones.push('mensaje general');

    return {
      categoria,
      prioridad,
      respuestaSugerida: sugerencia,
      analisis: `Clasificacion basada en: ${razones.join(', ')}. Prioridad ${prioridad} por el contexto del mensaje.`,
    };
  }

  private hasAny(text: string, words: string[]) {
    return words.some((w) => text.includes(w));
  }

  private hashSeed(text: string) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  private pickTemplate(list: string[], seed: number) {
    if (!list.length) return '';
    return list[seed % list.length];
  }
}
