import { accountCreationTemplate, passwordResetTemplate, orderRegisteredTemplate, promotionalTemplate, renderBaseTemplate } from '../src/mail/templates';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg: string, color: string = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

async function verifyEmailSystem() {
  log('=== INICIANDO AUDITORÍA DEL SISTEMA DE CORREOS ===\n', GREEN);

  // 1. Verificación de Configuración
  log('1. Verificando Configuración (.env)...');
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const primaryMode = process.env.EMAIL_PRIMARY_MODE;

  if (!apiKey || !apiKey.startsWith('re_')) {
    log(`[ERROR] RESEND_API_KEY inválida o faltante: ${apiKey}`, RED);
  } else {
    log(`[OK] RESEND_API_KEY detectada (${apiKey.substring(0, 5)}...)`, GREEN);
  }

  if (!fromEmail || fromEmail.includes('example.com')) {
    log(`[WARN] RESEND_FROM_EMAIL parece genérico o faltante: ${fromEmail}`, YELLOW);
  } else {
    log(`[OK] RESEND_FROM_EMAIL configurado: ${fromEmail}`, GREEN);
  }

  if (primaryMode === 'true') {
    log(`[CRÍTICO] EMAIL_PRIMARY_MODE está activado (true). Esto forzará el envío de texto plano y romperá el HTML.`, RED);
  } else {
    log(`[OK] EMAIL_PRIMARY_MODE está desactivado (false/undefined). HTML habilitado.`, GREEN);
  }

  // 2. Auditoría de Plantillas
  log('\n2. Auditando Plantillas de Correo...');
  
  const templates = [
    { name: 'Bienvenida', fn: () => accountCreationTemplate('Juan Pérez') },
    { name: 'Reset Password', fn: () => passwordResetTemplate() },
    { name: 'Orden Confirmada', fn: () => orderRegisteredTemplate('ORD-123', '<li>Item 1 - $50</li><li>Item 2 - $50</li>', 100.00) },
    { name: 'Promocional', fn: () => promotionalTemplate('<p>Contenido promocional de prueba</p>') }
  ];

  const dummyData = {
    user_full_name: 'Juan Pérez',
    user_email: 'juan@test.com',
    verify_url: 'http://test.com/verify',
    login_url: 'http://test.com/login',
    profile_url: 'http://test.com/profile',
    support_email: 'support@test.com',
    reset_url: 'http://test.com/reset',
    expire_hours: '24',
    order_number: 'ORD-123',
    tracking_number: 'TRACK-999',
    total: '$100.00',
    items_summary_html: '<li>Item 1</li>',
    details_url: 'http://test.com/order/123',
    promo_title: 'Gran Venta',
    promo_body_html: '<p>Descuentos increíbles</p>',
    promo_cta_url: 'http://test.com/promo',
    promo_cta_text: 'Ver Ofertas'
  };

  function render(template: string, vars: Record<string, string | number>) {
    let html = template;
    for (const [key, value] of Object.entries(vars)) {
      const token = '${' + key + '}';
      html = html.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
    }
    return html;
  }

  for (const t of templates) {
    try {
      const rawTpl = t.fn();
      const rendered = render(rawTpl, dummyData);
      
      // Chequeo de variables no reemplazadas
      const missingVars = rendered.match(/\$\{[a-zA-Z0-9_]+\}/g);
      if (missingVars) {
        log(`[FAIL] Plantilla ${t.name} tiene variables sin reemplazar: ${missingVars.join(', ')}`, RED);
      } else {
        log(`[OK] Plantilla ${t.name} renderizada correctamente.`, GREEN);
      }

      // Chequeo de estructura HTML
      if (!rendered.includes('<!DOCTYPE html>') || !rendered.includes('</html>')) {
        log(`[WARN] Plantilla ${t.name} podría tener estructura HTML inválida.`, YELLOW);
      }

      // Chequeo de enlaces rotos (básico)
      if (rendered.includes('href=""') || rendered.includes("href=''")) {
        log(`[WARN] Plantilla ${t.name} contiene enlaces vacíos.`, YELLOW);
      }

    } catch (e) {
      log(`[ERROR] Fallo al procesar plantilla ${t.name}: ${e}`, RED);
    }
  }

  log('\n=== AUDITORÍA COMPLETADA ===', GREEN);
}

verifyEmailSystem().catch(console.error);
