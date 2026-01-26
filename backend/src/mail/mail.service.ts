import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailLog, MailType } from './mail-log.entity';
import {
  accountCreationTemplate,
  passwordResetTemplate,
  orderRegisteredTemplate,
  promotionalTemplate,
  verifyEmailTemplate,
  renderBaseTemplate,
  quotationUpdateTemplate,
} from './templates';
import { promises as dns } from 'dns';

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  type: MailType;
  text?: string;
  suppressAlert?: boolean;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly webUrl: string;
  private readonly fromName?: string;
  private readonly fromHeader: string;
  private lastAlertAt?: number;
  private readonly alertMinIntervalMs = 10 * 60 * 1000;
  private smtpTransport?: nodemailer.Transporter;
  private emailProvider: 'smtp' | 'resend';

  constructor(
    @InjectRepository(MailLog) private readonly logs: Repository<MailLog>,
  ) {
    const apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'no-reply@whoamicode.com';
    this.fromName = process.env.RESEND_FROM_NAME || 'WhoamiCode';
    this.webUrl = process.env.WEB_URL || 'http://localhost:3000';
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurado. El servicio de correo estará deshabilitado.',
      );
      this.logger.warn(
        'Para habilitarlo, agrega RESEND_API_KEY a tu archivo .env',
      );
      // Crear instancia con string vacío para evitar error, pero el envío fallará
      this.resend = new Resend('');
    } else {
      if (apiKey.startsWith('re_test_')) {
        this.logger.error(
          'API Key de Resend de entorno TEST detectada. Configure una clave de PRODUCCIÓN (prefijo re_).',
        );
      }
      if (apiKey && !apiKey.startsWith('re_')) {
        this.logger.warn(
          'Formato de RESEND_API_KEY inesperado. Debe comenzar con re_.',
        );
      }
      this.resend = new Resend(apiKey);
    }
    this.fromHeader = this.fromName
      ? `${this.fromName} <${this.fromEmail}>`
      : this.fromEmail;
    this.emailProvider =
      ((process.env.EMAIL_PROVIDER || 'smtp').toLowerCase() as any) === 'resend'
        ? 'resend'
        : 'smtp';
    if (this.emailProvider === 'smtp') {
      const host = process.env.SMTP_HOST || '';
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = ['true', '1', 'yes'].includes(
        (process.env.SMTP_SECURE || '').toLowerCase(),
      );
      const user = process.env.SMTP_USER || '';
      const pass = process.env.SMTP_PASS || '';
      if (!host || !user || !pass) {
        this.logger.warn(
          'SMTP no configurado completamente. Se usará Resend como fallback.',
        );
      } else {
        this.smtpTransport = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          tls: { rejectUnauthorized: false },
        });
        this.logger.log(`SMTP inicializado en ${host}:${port}`);
      }
    }
  }

  private render(template: string, vars: Record<string, string | number>) {
    let html = template;
    for (const [key, value] of Object.entries(vars)) {
      const token = '${' + key + '}';
      html = html.replace(
        new RegExp(this.escapeRegExp(token), 'g'),
        String(value),
      );
      const escaped = '\\${' + key + '}';
      html = html.replace(
        new RegExp(this.escapeRegExp(escaped), 'g'),
        String(value),
      );
    }
    return html;
  }

  private escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async _retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const delay = Math.min(2000 * i, 6000);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    throw lastErr;
  }

  private async _validateLinks(html: string) {
    const links = Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g)).map(
      (m) => m[1],
    );
    for (const url of links) {
      try {
        const resp = await fetch(url, { method: 'HEAD' });
        if (!resp.ok) {
          this.logger.warn(`Link check failed: ${url} -> ${resp.status}`);
        }
      } catch (e) {
        this.logger.warn(`Link check error: ${url} -> ${String(e)}`);
      }
    }
  }

  private _spamHeuristics(subject: string, html: string) {
    const risky = ['free', 'gratis', 'oferta', 'promoción', 'ganar dinero'];
    const s = `${subject} ${html}`.toLowerCase();
    const hits = risky.filter((w) => s.includes(w)).length;
    if (hits >= 3) {
      this.logger.warn('Contenido potencialmente spammy detectado');
    }
  }

  private async validateRecipientEmail(email: string): Promise<boolean> {
    const basic =
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
      email.length <= 254 &&
      email.split('@')[0].length <= 64;
    if (!basic) return false;
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    const domain = email.split('@')[1];
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        this.logger.warn(
          `MX lookup sin resultados para dominio ${domain} - Permitiedo envío de todos modos por política laxa`,
        );
        return true;
      }
      return true;
    } catch {
      this.logger.warn(
        `MX lookup fallido para dominio ${domain} - Permitiedo envío de todos modos por política laxa`,
      );
      return true;
    }
  }

  private async _send(opts: SendOptions, fromOverride?: string) {
    const originalTo = opts.to;
    const forceTo = process.env.EMAIL_FORCE_TO || '';
    const forceEnabled = ['true', '1', 'yes'].includes(
      (process.env.EMAIL_FORCE_TO_ENABLE || '').toLowerCase(),
    );
    const applyForce =
      forceEnabled && forceTo && process.env.NODE_ENV !== 'test' ? forceTo : '';
    const actualTo = applyForce || originalTo;
    const isValid = await this.validateRecipientEmail(actualTo);
    if (!isValid) {
      await this.logs.save(
        this.logs.create({
          type: opts.type,
          to: actualTo,
          originalTo,
          subject: opts.subject,
          status: 'FAIL',
          errorMessage: 'invalid_email',
          providerErrorCode: 'invalid_email',
        }),
      );
      this.logger.warn(`Email inválido, no se envía: ${actualTo}`);
      if (!opts.suppressAlert) {
        await this.checkHealthAndAlert().catch(() => {});
      }
      return { ok: false, error: 'invalid_email' };
    }
    await this._validateLinks(opts.html);
    this._spamHeuristics(opts.subject, opts.html);
    const textAlt = opts.text ?? this.htmlToText(opts.html);
    const apiKey = process.env.RESEND_API_KEY || '';
    if (apiKey.startsWith('re_test_')) {
      await this.logs.save(
        this.logs.create({
          type: opts.type,
          to: actualTo,
          originalTo,
          subject: opts.subject,
          status: 'FAIL',
          errorMessage: 'invalid_api_key_environment',
          providerErrorCode: 're_test_key',
        }),
      );
      this.logger.error(
        'Clave de Resend de TEST en uso. Debe usar clave de PRODUCCIÓN (re_...).',
      );
      if (!opts.suppressAlert) {
        await this.checkHealthAndAlert().catch(() => {});
      }
      return { ok: false, error: 'invalid_api_key_environment' };
    }
    try {
      if (this.emailProvider === 'smtp' && this.smtpTransport) {
        const info = await this._retry(() =>
          this.smtpTransport!.sendMail({
            from: fromOverride ?? this.fromHeader,
            to: actualTo,
            subject: opts.subject,
            html: opts.html,
            text: textAlt,
            replyTo: this.fromEmail,
          }),
        );
        const messageId = info?.messageId;
        await this.logs.save(
          this.logs.create({
            type: opts.type,
            to: actualTo,
            originalTo,
            subject: opts.subject,
            providerMessageId: messageId,
            status: 'SUCCESS',
          }),
        );
        await this.checkHealthAndAlert().catch(() => {});
        return { ok: true, id: messageId };
      }
      const result = await this._retry(async () => {
        const r = await this.resend.emails.send({
          from: fromOverride ?? this.fromHeader,
          to: actualTo,
          subject: opts.subject,
          html: opts.html,
          text: textAlt,
          reply_to: this.fromEmail,
          tags: [{ name: 'type', value: opts.type }],
        });
        this.logger.log(`Resend response: ${JSON.stringify(r)}`);
        if (r.error) throw new Error(r.error.message);
        return r;
      });
      const messageId =
        (result as any)?.id || (result as any)?.data?.id || undefined;
      await this.logs.save(
        this.logs.create({
          type: opts.type,
          to: actualTo,
          originalTo,
          subject: opts.subject,
          providerMessageId: messageId,
          status: 'SUCCESS',
        }),
      );
      await this.checkHealthAndAlert().catch(() => {});
      return { ok: true, id: messageId };
    } catch (err: any) {
      const msg = err?.message || String(err);
      const code = err?.code || err?.statusCode || err?.name || 'send_error';
      await this.logs.save(
        this.logs.create({
          type: opts.type,
          to: actualTo,
          originalTo,
          subject: opts.subject,
          status: 'FAIL',
          errorMessage: msg,
          providerErrorCode: String(code),
        }),
      );
      this.logger.error(`Error enviando email: ${msg}`);
      if (!opts.suppressAlert) {
        await this.checkHealthAndAlert().catch(() => {});
      }
      return { ok: false, error: msg };
    }
  }

  private async _sendDirectResend(
    from: string,
    to: string,
    subject: string,
    html: string,
    text?: string,
  ) {
    const r = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      reply_to: this.fromEmail,
    });
    this.logger.log(`Resend direct response: ${JSON.stringify(r)}`);
    if ((r as any)?.error) {
      throw new Error((r as any).error?.message || 'resend_error');
    }
    return r;
  }

  async verifyResendConfig() {
    const apiKeyPresent = !!(process.env.RESEND_API_KEY || '');
    const from = this.fromHeader;
    const fromDomain = (this.fromEmail.split('@')[1] || '').toLowerCase();
    let domainVerified: boolean | 'unknown' = 'unknown';
    try {
      const resp = await fetch('https://api.resend.com/domains', {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY || ''}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const list = (data?.data ?? data?.domains ?? []) as any[];
        const found = Array.isArray(list)
          ? list.find(
              (d) => (d?.name || d?.domain || '').toLowerCase() === fromDomain,
            )
          : null;
        const status = (found?.status || found?.state || '').toLowerCase();
        domainVerified = ['verified', 'connected', 'active'].includes(status)
          ? true
          : false;
      }
    } catch {
      domainVerified = 'unknown';
    }
    const testTo =
      process.env.TEST_EMAIL ||
      process.env.ADMIN_ALERT_EMAIL ||
      'admin@example.com';
    let sendOk = false;
    let sendError: string | undefined;
    try {
      const html = '<p>Prueba de verificación de configuración de Resend.</p>';
      const text = this.htmlToText(html);
      await this._sendDirectResend(
        from,
        testTo,
        'Prueba de configuración Resend',
        html,
        text,
      );
      sendOk = true;
    } catch (e: any) {
      sendError = e?.message || String(e);
    }
    return {
      apiKeyPresent,
      fromEmail: this.fromEmail,
      fromDomain,
      domainVerified,
      sendOk,
      sendError,
    };
  }

  async sendAccountCreation(data: { to: string; fullName: string }) {
    const html = accountCreationTemplate(data.fullName);
    return this._send({
      to: data.to,
      subject: '¡Bienvenido a Industrias SP!',
      html,
      type: 'ACCOUNT_CREATION',
    });
  }

  async sendVerification(data: { to: string; fullName: string; url: string }) {
    const html = verifyEmailTemplate(data.fullName, data.url);
    return this._send({
      to: data.to,
      subject: 'Verifica tu cuenta - Industrias SP',
      html,
      type: 'ACCOUNT_CREATION',
    });
  }

  async sendPasswordReset(params: {
    to: string;
    fullName?: string;
    token: string;
    url?: string; // Permitir URL completa (ej: Supabase Action Link)
    expireHours?: number;
  }) {
    const primaryMode = ['true', '1', 'yes'].includes(
      (process.env.EMAIL_PRIMARY_MODE || '').toLowerCase(),
    );
    const expireHours = params.expireHours ?? 24;
    // Usar URL proporcionada o construirla
    const resetUrl =
      params.url || `${this.webUrl}/auth/reset?token=${params.token}`;
    const htmlTpl = passwordResetTemplate();
    const html = this.render(htmlTpl, {
      user_full_name: params.fullName ?? 'Usuario',
      reset_url: resetUrl,
      expire_hours: expireHours,
    });
    const subject = primaryMode
      ? 'Restablece tu contraseña'
      : 'Recuperación de contraseña';
    return this._send({
      to: params.to,
      subject,
      html,
      type: 'PASSWORD_RESET',
    });
  }

  async sendOrderRegistered(params: {
    to: string;
    fullName?: string;
    orderNumber: string;
    trackingNumber: string;
    items: Array<{ name: string; qty: number; price: number }>;
    total: number;
  }) {
    const primaryMode = ['true', '1', 'yes'].includes(
      (process.env.EMAIL_PRIMARY_MODE || '').toLowerCase(),
    );
    const detailsUrl = `${this.webUrl}/mi-cuenta/pedidos/${encodeURIComponent(
      params.orderNumber,
    )}`;
    const itemsRows = params.items
      .map(
        (it) =>
          `<tr>
             <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.name}</td>
             <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${it.qty}</td>
             <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${it.price.toFixed(
               2,
             )}</td>
           </tr>`,
      )
      .join('');
    const itemsSummaryHtml = `
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Producto</th>
            <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #ddd;">Cantidad</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Precio</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    `;
    const htmlTpl = orderRegisteredTemplate(
      params.orderNumber,
      itemsSummaryHtml,
      params.total,
    );
    const html = this.render(htmlTpl, {}); // Template already rendered in helper, but kept consistent if we used raw template strings
    // Helper function returns full HTML, so no need to render again unless it had variables.
    // The helpers in templates.ts return fully rendered strings.
    // So we just pass it.
    
    return this._send({
      to: params.to,
      subject: `Pedido #${params.orderNumber} confirmado`,
      html: htmlTpl,
      type: 'ORDER_REGISTERED',
    });
  }

  async sendQuotationUpdate(params: {
    to: string;
    fullName: string;
    quotationId: number;
    status: string;
    message?: string;
  }) {
    const url = `${this.webUrl}/mis-pedidos`; // Or specific quotation URL
    const html = quotationUpdateTemplate(
      params.fullName,
      params.quotationId,
      params.status,
      params.message || '',
      url
    );
    return this._send({
      to: params.to,
      subject: `Actualización de Cotización #${params.quotationId}`,
      html,
      type: 'QUOTATION_UPDATE',
    });
  }

  async sendTechnicianAssigned(params: {
    to: string;
    technicianName: string;
    quotationId: number;
    customerName?: string;
    status?: string;
  }) {
    const adminUrl = process.env.ADMIN_URL || this.webUrl;
    const url = `${adminUrl}/cotizaciones`;
    const content = `
      <p>Hola <strong>${params.technicianName}</strong>,</p>
      <p>Se te asignó una nueva cotización.</p>
      <ul>
        <li><strong>ID:</strong> ${params.quotationId}</li>
        ${params.customerName ? `<li><strong>Cliente:</strong> ${params.customerName}</li>` : ''}
        ${params.status ? `<li><strong>Estado:</strong> ${params.status}</li>` : ''}
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" class="btn">Ver cotización</a>
      </div>
      <p>Gracias,</p>
      <p>Equipo Industrias SP</p>
    `;
    const html = renderBaseTemplate(content, 'Nueva cotización asignada');
    return this._send({
      to: params.to,
      subject: `Asignación de cotización #${params.quotationId}`,
      html,
      type: 'QUOTATION_UPDATE',
    });
  }

  async sendContactoReporteTecnico(params: {
    to: string;
    cliente: string;
    contactoId: number;
    message: string;
    found?: string;
    resolved?: string;
    evidenceUrls?: string[];
  }) {
    const evidenceList = (params.evidenceUrls || [])
      .map((u) => `<li><a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a></li>`)
      .join('') || '<li>Sin evidencias adjuntas</li>';

    const content = `
      <p>Hola <strong>${params.cliente}</strong>,</p>
      <p>Hemos registrado el reporte técnico de tu solicitud.</p>
      <div style="background-color:#f8fafc;padding:14px;border-radius:10px;border:1px solid #e2e8f0;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Reporte:</strong> ${params.message}</p>
        ${params.found ? `<p style="margin:0 0 8px;"><strong>Cómo se encontró:</strong> ${params.found}</p>` : ''}
        ${params.resolved ? `<p style="margin:0;"><strong>Cómo quedó:</strong> ${params.resolved}</p>` : ''}
      </div>
      <p><strong>Evidencias:</strong></p>
      <ul>${evidenceList}</ul>
      <div style="text-align:center;margin:30px 0;">
        <a href="${this.webUrl}/mis-mensajes" class="btn">Ver detalles</a>
      </div>
      <p>Gracias por confiar en nosotros.</p>
    `;
    const html = renderBaseTemplate(content, 'Reporte técnico del servicio');
    return this._send({
      to: params.to,
      subject: `Reporte técnico del servicio #${params.contactoId}`,
      html,
      type: 'QUOTATION_UPDATE',
    });
  }

  async sendPromotional(params: {
    to: string;
    title: string;
    bodyHtml: string;
    ctaUrl?: string;
    ctaText?: string;
  }) {
    const content = `
      <h2>${params.title}</h2>
      <div>${params.bodyHtml}</div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.ctaUrl ?? this.webUrl}" class="btn">${params.ctaText ?? 'Ver más'}</a>
      </div>
    `;
    const html = promotionalTemplate(content);
    return this._send({
      to: params.to,
      subject: params.title,
      html,
      type: 'PROMOTIONAL',
    });
  }

  async sendQuoteNotification(params: {
    to: string;
    customerName: string;
    customerEmail: string;
    productName?: string;
    status?: string;
    notes?: string;
    attachmentHtml?: string;
    itemsHtml?: string;
  }) {
    const content = `
      <p>Se registró una nueva cotización.</p>
      <p><strong>Cliente:</strong> ${params.customerName} (${params.customerEmail})</p>
      ${params.productName ? `<p><strong>Producto:</strong> ${params.productName}</p>` : ''}
      ${params.status ? `<p><strong>Estado:</strong> ${params.status}</p>` : ''}
      ${params.notes ? `<p><strong>Notas:</strong> ${params.notes}</p>` : ''}
      <p><strong>Items:</strong></p>
      ${params.itemsHtml ?? '<p>Sin items</p>'}
      <p><strong>Adjuntos:</strong></p>
      ${params.attachmentHtml ?? '<p>Sin adjuntos</p>'}
    `;
    const html = renderBaseTemplate(content, 'Nueva cotización');
    return this._send({
      to: params.to,
      subject: 'Nueva cotización registrada',
      html,
      type: 'PROMOTIONAL',
    });
  }

  async sendTest(to: string, subject: string, html: string) {
    return this._send({ to, subject, html, type: 'PROMOTIONAL' });
  }

  async sendPedidoConfirmation(params: {
    orderNumber: string;
    customerEmail: string;
    customerName?: string;
    total: number;
  }) {
    // Usar sendOrderRegistered con datos adaptados
    return this.sendOrderRegistered({
      to: params.customerEmail,
      fullName: params.customerName || 'Cliente',
      orderNumber: params.orderNumber,
      trackingNumber: params.orderNumber, // Usar orderNumber como tracking temporal
      items: [], // Los items deberían venir en el evento, pero por ahora vacío
      total: params.total,
    });
  }

  async sendQuotationConfirmation(params: {
    quotationId: number;
    customerEmail: string;
    customerName?: string;
  }) {
    // Usar sendQuotationUpdate para notificar la creación
    return this.sendQuotationUpdate({
      to: params.customerEmail,
      fullName: params.customerName || 'Cliente',
      quotationId: params.quotationId,
      status: 'Creada',
      message: 'Su cotización ha sido recibida y está siendo procesada.',
    });
  }

  async sendWelcomeEmail(params: {
    email: string;
    name?: string;
  }) {
    // Usar sendAccountCreation para el email de bienvenida
    return this.sendAccountCreation({
      to: params.email,
      fullName: params.name || 'Usuario',
    });
  }

  async sendComprobante(params: {
    to: string;
    customerName: string;
    orderNumber: string;
    comprobante: any;
    documentType: 'BOLETA' | 'FACTURA';
  }) {
    const docType = params.documentType === 'FACTURA' ? 'Factura Electrónica' : 'Boleta de Venta';
    const docId =
      params.comprobante?.id || params.comprobante?.numero || params.orderNumber;
    
    const itemsHtml = (params.comprobante?.items || []).map((item: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.description || item.name || 'Producto'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity || item.cantidad || 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">S/ ${(item.unitPrice || item.price || 0).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">S/ ${(item.total || (item.unitPrice || item.price || 0) * (item.quantity || item.cantidad || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    const content = `
      <p>Estimado/a <strong>${params.customerName}</strong>,</p>
      <p>Adjuntamos su ${docType} correspondiente al pedido <strong>#${params.orderNumber}</strong>.</p>
      
      <div style="background-color:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0;">
        <h3 style="margin-top:0;color:#1e293b;">Detalles del ${docType}</h3>
        <p style="margin:8px 0;"><strong>Número:</strong> ${docId}</p>
        <p style="margin:8px 0;"><strong>Pedido:</strong> ${params.orderNumber}</p>
        <p style="margin:8px 0;"><strong>Fecha:</strong> ${new Date(params.comprobante?.issueDate || Date.now()).toLocaleDateString('es-PE')}</p>
        <p style="margin:8px 0;"><strong>Total:</strong> S/ ${(params.comprobante?.totals?.total || params.comprobante?.total || 0).toFixed(2)}</p>
      </div>
      ${
        params.comprobante?.pdfUrl
          ? `<p><a href="${params.comprobante.pdfUrl}" target="_blank">Ver PDF Nubefact</a></p>`
          : ''
      }

      <h4 style="margin-top:24px;color:#1e293b;">Items:</h4>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;">Producto</th>
            <th style="text-align:center;padding:8px;border-bottom:2px solid #cbd5e1;">Cantidad</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #cbd5e1;">Precio Unit.</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #cbd5e1;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right;padding:8px;font-weight:bold;border-top:2px solid #cbd5e1;">Total:</td>
            <td style="text-align:right;padding:8px;font-weight:bold;border-top:2px solid #cbd5e1;">S/ ${(params.comprobante?.totals?.total || params.comprobante?.total || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top:24px;">Gracias por su compra.</p>
      <p>Equipo Industrias SP</p>
    `;

    const html = renderBaseTemplate(content, `${docType} - Pedido #${params.orderNumber}`);
    
    return this._send({
      to: params.to,
      subject: `${docType} - Pedido #${params.orderNumber}`,
      html,
      type: 'ORDER_REGISTERED',
    });
  }

  async listLogs(limit = 20) {
    return this.logs.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async metrics() {
    const last = await this.logs.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const total = last.length;
    const success = last.filter((l) => l.status === 'SUCCESS').length;
    const fail = total - success;
    const bounced = last.filter((l) => l.lastEvent === 'email.bounced').length;
    const delivered = last.filter(
      (l) => l.lastEvent === 'email.delivered',
    ).length;
    const opened = last.filter((l) => (l.opens ?? 0) > 0).length;
    return {
      window: total,
      delivery_rate: total ? Math.round((success / total) * 10000) / 100 : 0,
      fail_rate: total ? Math.round((fail / total) * 10000) / 100 : 0,
      bounced,
      delivered,
      opened,
    };
  }

  private async checkHealthAndAlert() {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@whoamicode.com';
    const now = Date.now();
    if (this.lastAlertAt && now - this.lastAlertAt < this.alertMinIntervalMs) {
      return;
    }
    const recent = await this.logs.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (recent.length === 0) return;
    const total = recent.length;
    const fails = recent.filter((l) => l.status === 'FAIL').length;
    const rate = fails / total;
    const last20 = recent.slice(0, 20);
    const last20Fails = last20.filter((l) => l.status === 'FAIL').length;
    if (rate >= 0.02 || last20Fails >= 3) {
      const html = `
        <h2>Alerta de entregabilidad</h2>
        <p>Ventana: últimos ${total} envíos</p>
        <p>Fallos: ${fails} (${Math.round(rate * 100)}%)</p>
        <p>Fallos en últimos 20: ${last20Fails}</p>
        <p>Dominio: ${this.fromEmail}</p>
        <p>Acciones sugeridas: verificar DKIM/SPF/DMARC, revisar dashboard de Resend.</p>
      `;
      await this._send({
        to: adminEmail,
        subject: 'Alerta: caída en entregabilidad de correos',
        html,
        type: 'PROMOTIONAL',
        suppressAlert: true,
      }).catch(() => {});
    }
  }

  async updateEvent(messageId: string, event: string, at?: string | Date) {
    const log = await this.logs.findOne({
      where: { providerMessageId: messageId },
    });
    const date = at ? new Date(at) : new Date();
    if (!log) return;
    log.lastEvent = event;
    log.lastEventAt = date;
    if (event === 'email.opened') log.opens += 1;
    if (event === 'email.clicked') log.clicks += 1;
    await this.logs.save(log);
  }
}
