export function renderBaseTemplate(
  content: string,
  title: string = 'IndustriaSP',
) {
  // Styles for compatibility
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Roboto', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .wrapper { width: 100%; background-color: #f3f4f6; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 40px; text-align: left; }
    .logo-text { color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: block; }
    .welcome-text { color: #ffffff; font-size: 32px; font-weight: 700; margin: 0; line-height: 1.2; }
    .content { padding: 40px; color: #374151; font-size: 16px; line-height: 1.6; background-color: #ffffff; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-weight: 600; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-size: 16px; text-align: center; width: auto; min-width: 200px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
    .btn:hover { background-color: #1d4ed8; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .footer-link { color: #64748b; text-decoration: underline; }
    
    /* Feature boxes */
    .features-table { width: 100%; margin-top: 30px; margin-bottom: 30px; }
    .feature-box { background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .feature-title { font-weight: 700; color: #1e293b; font-size: 14px; margin-bottom: 4px; display: block; }
    .feature-desc { color: #64748b; font-size: 14px; margin: 0; }

    @media (max-width: 600px) {
      .wrapper { padding: 10px; }
      .container { border-radius: 12px; }
      .header { padding: 30px 20px; }
      .content { padding: 30px 20px; }
      .welcome-text { font-size: 28px; }
      .features-td { display: block; width: 100%; padding-bottom: 10px; }
      .features-td:last-child { padding-bottom: 0; }
    }
  `;

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    <div class="wrapper">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <!-- Main Container -->
            <table role="presentation" class="container" width="600" border="0" cellspacing="0" cellpadding="0">
              
              <!-- Header -->
              <tr>
                <td class="header">
                  <span class="logo-text">INDUSTRIAS SP</span>
                  <h1 class="welcome-text">${title}</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td class="content">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td class="footer">
                  <div class="footer-text">
                    Enviado por Industrias SP · © ${new Date().getFullYear()}
                  </div>
                  <div class="footer-text">
                    <a href="mailto:soporte@industriasp.com" class="footer-link">Soporte</a> · 
                    <a href="#" class="footer-link">Privacidad</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>`;
}

export function accountCreationTemplate(name: string) {
  return renderBaseTemplate(
    `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Tu cuenta en <strong>Industrias SP</strong> ha sido creada exitosamente.</p>
    <p>Estamos emocionados de tenerte con nosotros. Ahora podrás acceder a nuestro catálogo exclusivo, realizar cotizaciones y gestionar tus pedidos.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.WEB_URL || 'http://localhost:3000'}/auth/login" class="btn">Iniciar Sesión</a>
    </div>
    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
    `,
    'Bienvenido'
  );
}

export function verifyEmailTemplate(name: string, url: string) {
  return renderBaseTemplate(
    `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Gracias por registrarte. Por favor verifica tu dirección de correo electrónico para activar tu cuenta.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" class="btn">Verificar Email</a>
    </div>
    <p>Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
    `,
    'Verifica tu Email'
  );
}

export function passwordResetTemplate() {
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Restablecer contraseña</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Restablecer contraseña</h2>
      <p>Hola \${user_full_name},</p>
      <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
      <p><a href="\${reset_url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a></p>
      <p>Este enlace expirará en \${expire_hours} horas.</p>
      <p>Si no solicitaste esto, puedes ignorar este correo.</p>
    </div>
  </body>
  </html>`;
}

export function orderRegisteredTemplate(orderNumber: string, itemsHtml: string, total: number) {
  return renderBaseTemplate(
    `
    <p>Tu pedido <strong>#${orderNumber}</strong> ha sido registrado correctamente.</p>
    <p>Resumen del pedido:</p>
    ${itemsHtml}
    <p style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">Total: $${total.toFixed(2)}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.WEB_URL || 'http://localhost:3000'}/mi-cuenta/pedidos" class="btn">Ver Mis Pedidos</a>
    </div>
    `,
    'Pedido Confirmado'
  );
}

export function promotionalTemplate(content: string) {
  return renderBaseTemplate(content, 'Novedades');
}

export function quotationUpdateTemplate(
  name: string,
  quotationId: number,
  status: string,
  message: string,
  url: string
) {
  return renderBaseTemplate(
    `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Hay una actualización en tu cotización <strong>#${quotationId}</strong>.</p>
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
      <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Estado Actual</p>
      <p style="margin: 5px 0 0; font-size: 18px; font-weight: 700; color: #1e293b;">${status}</p>
    </div>
    ${
      message
        ? `<p><strong>Mensaje del técnico:</strong></p><p style="font-style: italic; color: #555;">"${message}"</p>`
        : ''
    }
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" class="btn">Ver Detalles</a>
    </div>
    `,
    'Actualización de Cotización'
  );
}
