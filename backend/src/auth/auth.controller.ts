import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Query,
  Headers,
  Put,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import { Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot.dto';
import { ResetPasswordDto } from './dto/reset.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { createClient } from '@supabase/supabase-js';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}
  private readonly logger = new Logger('AuthController');

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: any) {
    throw new ForbiddenException(
      'Registro público deshabilitado. Contacte al administrador.',
    );
  }

  @Post('register-custom')
  async registerCustom(@Body() body: RegisterDto) {
    throw new ForbiddenException(
      'Registro público deshabilitado. Contacte al administrador.',
    );
  }

  @Post('admin/create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminCreateUser(
    @Body()
    body: {
      email: string;
      fullName?: string;
      phone?: string;
      role?: UserRole;
      active?: boolean;
    },
  ) {
    return this.auth.createUserByAdmin(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body);
  }

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  profile(@Req() req: any) {
    return req.user;
  }

  @Put('profile')
  @UseGuards(SupabaseAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body()
    body: {
      fullName?: string;
      phone?: string;
      preferences?: Record<string, any>;
    },
  ) {
    const email = req.user?.email;
    if (!email) throw new BadRequestException('Usuario inválido');
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.users.update(user.id, {
      fullName: body.fullName ?? user.fullName,
      phone: body.phone ?? user.phone,
    });
  }

  // Recuperación de contraseña
  @Post('forgot-password')
  async forgot(@Body() body: ForgotPasswordDto, @Req() req: any) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('reset-password')
  async reset(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post('change-password-first')
  @UseGuards(SupabaseAuthGuard)
  async changePasswordFirst(
    @Req() req: any,
    @Body() body: { newPassword: string },
  ) {
    return this.auth.changePasswordFirst(
      req.user?.userId,
      req.user?.supabaseId,
      body.newPassword,
    );
  }

  /*
  // Verificación de email - DEPRECATED: Supabase maneja esto
  @Post('send-verification')
  @UseGuards(SupabaseAuthGuard)
  async sendVerification(@Req() req: any) {
    // return this.auth.sendVerification(req.user.userId);
    return { message: 'Use Supabase Auth flow' };
  }
  */

  @Post('verify')
  async verifyPost(@Body('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.auth.resendVerificationByEmail(email);
  }

  @Get('verify')
  async verify(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('check-email')
  async checkEmail(@Body() body: CheckEmailDto) {
    this.logger.log(`check-email start email=${body.email}`);
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      this.logger.log(
        `check-email local-hit email=${body.email} verified=${!!existing.verified}`,
      );
      return {
        exists: true,
        verified: !!existing.verified,
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
      this.logger.warn(
        `check-email missing-supabase-config email=${body.email}`,
      );
      return {
        exists: false,
        verified: false,
      };
    }

    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { data, error } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });
      if (error) {
        this.logger.warn(
          `check-email supabase error email=${body.email}: ${error.message}`,
        );
        return { exists: false, verified: false };
      }
      const user = data?.users?.find(
        (u) => u.email?.toLowerCase() === body.email.toLowerCase(),
      );
      const emailConfirmed = !!user?.email_confirmed_at;
      this.logger.log(
        `check-email supabase-result email=${body.email} exists=${!!user} verified=${emailConfirmed}`,
      );
      return {
        exists: !!user,
        verified: emailConfirmed,
      };
    } catch (err: any) {
      this.logger.warn(
        `check-email supabase exception email=${body.email}: ${err?.message || err}`,
      );
      return { exists: false, verified: false };
    }
  }

  @Get('fix-emails')
  async fixEmails() {
    return this.users.fixEmails();
  }

  @Post('register-external')
  async registerExternal(
    @Headers('x-external-secret') secret: string,
    @Body() body: { email: string; fullName?: string; id?: string },
  ) {
    const expected = process.env.EXTERNAL_REG_SECRET || '';
    if (!expected || secret !== expected) {
      this.logger.warn(
        `register-external unauthorized for email=${body?.email}`,
      );
      return { ok: false, error: 'unauthorized' };
    }
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      await this.users.update(existing.id, {
        fullName: body.fullName,
        verified: true,
        supabaseUid: body.id,
      } as any);
      this.logger.log(
        `register-external updated id=${existing.id} email=${body.email}`,
      );
      return { ok: true, created: false, id: existing.id };
    }
    const created = await this.users.create({
      email: body.email,
      fullName: body.fullName,
      role: UserRole.CLIENTE,
      verified: false, // Marcar como no verificado inicialmente, Supabase manejará la verificación
      supabaseUid: body.id,
    });
    const emailDomain = (body.email.split('@')[1] || '').toLowerCase();

    // Enviar correo de bienvenida y verificación para nuevos usuarios
    let emailSent = false;
    let emailError: string | null = null;

    this.logger.log(
      `register-external iniciando envío de correo para email=${body.email}`,
    );

    try {
      // Intentar generar link de verificación desde Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      let webUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
      
      // Validar que WEB_URL no sea localhost (siempre, no solo en producción)
      if (webUrl.includes('localhost') || webUrl.includes('127.0.0.1')) {
        this.logger.warn(
          `⚠️ WEB_URL está configurado como localhost (${webUrl}). Esto causará problemas con los links de verificación.`,
        );
        // Intentar usar la URL del frontend desde las variables de entorno
        const alternativeUrl = process.env.FRONTEND_URL 
          || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') 
          || process.env.NEXT_PUBLIC_API_BASE?.replace('/api', '')
          || 'https://frontend-production-cacc.up.railway.app';
        this.logger.warn(
          `Usando URL alternativa: ${alternativeUrl}`,
        );
        webUrl = alternativeUrl;
      }
      
      const resendApiKey = process.env.RESEND_API_KEY;

      this.logger.log(
        `Configuración: SUPABASE_URL=${supabaseUrl ? 'presente' : 'faltante'}, SUPABASE_SERVICE_KEY=${serviceKey ? 'presente' : 'faltante'}, WEB_URL=${webUrl}, RESEND_API_KEY=${resendApiKey ? 'presente' : 'faltante'}`,
      );
      this.logger.log(
        `🔗 URL que se usará para redirectTo: ${webUrl}/auth/confirm`,
      );

      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        try {
          // Generar link de confirmación de signup para el usuario recién creado
          // Este link será enviado con Resend usando la plantilla personalizada
          let redirectUrl = `${webUrl}/auth/confirm`;
          
          // Validar que redirectUrl no contenga direcciones locales
          if (redirectUrl.includes('localhost') || redirectUrl.includes('127.0.0.1') || redirectUrl.includes('0.0.0.0')) {
            this.logger.error(
              `❌ ERROR CRÍTICO: redirectUrl contiene dirección local: ${redirectUrl}`,
            );
            this.logger.error(
              `webUrl actual: ${webUrl}`,
            );
            // Forzar uso de URL de producción
            redirectUrl = 'https://frontend-production-cacc.up.railway.app/auth/confirm';
            this.logger.warn(
              `Usando URL forzada: ${redirectUrl}`,
            );
          }
          
          this.logger.log(
            `Generando link de verificación de Supabase para email=${body.email} con redirectTo=${redirectUrl}`,
          );
          // Usar 'magiclink' para generar un link de autenticación que también verifica el email
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: body.email,
            options: {
              redirectTo: redirectUrl,
            },
          });

          if (linkError) {
            this.logger.error(
              `Error de Supabase al generar link: ${linkError.message}`,
            );
            throw linkError;
          }

          const url = linkData?.properties?.action_link;
          this.logger.log(
            `Link generado: ${url ? 'presente' : 'faltante'}`,
          );
          let finalUrl = url;
          if (url) {
            this.logger.log(
              `URL completa del link de verificación (ANTES del reemplazo): ${url}`,
            );
            this.logger.log(
              `Longitud de la URL: ${url.length} caracteres`,
            );
            // Verificar si la URL contiene localhost, 127.0.0.1 o 0.0.0.0 y reemplazarlo
            const hasLocalhost = url.includes('localhost');
            const has127 = url.includes('127.0.0.1');
            const has000 = url.includes('0.0.0.0');
            this.logger.log(
              `Detección: localhost=${hasLocalhost}, 127.0.0.1=${has127}, 0.0.0.0=${has000}`,
            );
            if (hasLocalhost || has127 || has000) {
              this.logger.warn(
                `⚠️ PROBLEMA DETECTADO: El link generado por Supabase contiene dirección local: ${url}`,
              );
              this.logger.warn(
                `Reemplazando dirección local con la URL de producción: ${webUrl}`,
              );
              // Reemplazar localhost:3000, 127.0.0.1:3000 o 0.0.0.0:3000 con la URL de producción
              // Reemplazar todas las ocurrencias en toda la URL (incluyendo hash y query params)
              finalUrl = url;
              
              // Reemplazo agresivo: buscar y reemplazar cualquier patrón de dirección local
              // Primero reemplazar con protocolo completo
              finalUrl = finalUrl.replace(/https?:\/\/localhost:\d+/gi, webUrl);
              finalUrl = finalUrl.replace(/https?:\/\/127\.0\.0\.1:\d+/gi, webUrl);
              finalUrl = finalUrl.replace(/https?:\/\/0\.0\.0\.0:\d+/gi, webUrl);
              
              // Reemplazar sin protocolo (para hash y query params)
              const webUrlNoProtocol = webUrl.replace(/^https?:\/\//, '');
              finalUrl = finalUrl.replace(/localhost:\d+/gi, webUrlNoProtocol);
              finalUrl = finalUrl.replace(/127\.0\.0\.1:\d+/gi, webUrlNoProtocol);
              finalUrl = finalUrl.replace(/0\.0\.0\.0:\d+/gi, webUrlNoProtocol);
              
              // Reemplazo adicional: si la URL completa empieza con 0.0.0.0, reemplazarla completamente
              if (finalUrl.startsWith('0.0.0.0:') || finalUrl.startsWith('http://0.0.0.0:') || finalUrl.startsWith('https://0.0.0.0:')) {
                // Extraer el path y hash después de 0.0.0.0:3000
                const match = finalUrl.match(/(?:https?:\/\/)?0\.0\.0\.0:\d+(\/.*)/);
                if (match && match[1]) {
                  finalUrl = `${webUrl}${match[1]}`;
                } else {
                  finalUrl = webUrl;
                }
              }
              
              // Verificar una vez más si quedó alguna dirección local
              if (finalUrl.includes('localhost:') || finalUrl.includes('127.0.0.1:') || finalUrl.includes('0.0.0.0:')) {
                this.logger.error(
                  `❌ ERROR: Aún quedan direcciones locales después del reemplazo: ${finalUrl}`,
                );
                // Último intento: reemplazo manual más agresivo
                finalUrl = finalUrl.split('#')[0].replace(/0\.0\.0\.0:\d+/gi, webUrlNoProtocol);
                const hash = url.split('#')[1];
                if (hash) {
                  // Reemplazar en el hash también
                  const fixedHash = hash.replace(/0\.0\.0\.0:\d+/gi, webUrlNoProtocol);
                  finalUrl = `${finalUrl}#${fixedHash}`;
                }
              }
              this.logger.log(
                `URL corregida (DESPUÉS del reemplazo): ${finalUrl}`,
              );
              // Verificar que el reemplazo funcionó
              if (finalUrl.includes('localhost:') || finalUrl.includes('127.0.0.1:') || finalUrl.includes('0.0.0.0:')) {
                this.logger.error(
                  `❌ ERROR CRÍTICO: El reemplazo falló. La URL aún contiene direcciones locales: ${finalUrl}`,
                );
              } else {
                this.logger.log(
                  `✅ Reemplazo exitoso. La URL ya no contiene direcciones locales.`,
                );
              }
              this.logger.warn(
                `⚠️ IMPORTANTE: Configura en Supabase Dashboard → Authentication → URL Configuration → Site URL: ${webUrl}`,
              );
            } else {
              this.logger.log(
                `✅ URL del link es correcta (no contiene direcciones locales)`,
              );
            }
          }
          if (finalUrl) {
            this.logger.log(
              `Enviando correo de verificación con Resend a ${created.email}`,
            );
            const mailResult = await this.mail.sendVerification({
              to: created.email,
              fullName: created.fullName ?? 'Usuario',
              url: finalUrl,
            });
            if (mailResult?.ok) {
              emailSent = true;
              this.logger.log(
                `✅ Correo de verificación enviado exitosamente a ${created.email}`,
              );
            } else {
              emailError =
                mailResult?.error || 'Error al enviar correo de verificación';
              this.logger.error(
                `❌ Error enviando correo de verificación: ${emailError}`,
              );
            }
          } else {
            // Fallback a correo de bienvenida
            const mailResult = await this.mail.sendAccountCreation({
              to: created.email,
              fullName: created.fullName ?? 'Usuario',
            });
            if (mailResult?.ok) {
              emailSent = true;
              this.logger.log(
                `Correo de bienvenida enviado a ${created.email}`,
              );
            } else {
              emailError =
                mailResult?.error || 'Error al enviar correo de bienvenida';
              this.logger.warn(
                `Error enviando correo de bienvenida: ${emailError}`,
              );
            }
          }
        } catch (linkError: any) {
          this.logger.error(
            `❌ Error generando link de verificación de Supabase: ${linkError.message || linkError}`,
          );
          // Fallback a correo de bienvenida
          this.logger.log(
            `Intentando fallback: enviar correo de bienvenida a ${created.email}`,
          );
          try {
            const mailResult = await this.mail.sendAccountCreation({
              to: created.email,
              fullName: created.fullName ?? 'Usuario',
            });
            if (mailResult?.ok) {
              emailSent = true;
              this.logger.log(
                `✅ Correo de bienvenida enviado a ${created.email} (fallback)`,
              );
            } else {
              emailError =
                mailResult?.error || 'Error al enviar correo de bienvenida';
              this.logger.error(
                `❌ Error enviando correo de bienvenida (fallback): ${emailError}`,
              );
            }
          } catch (mailErr: any) {
            emailError =
              mailErr?.message || 'Error al enviar correo de bienvenida';
            this.logger.error(
              `❌ Error enviando correo de bienvenida (fallback): ${emailError}`,
            );
          }
        }
      } else {
        // Si no hay configuración de Supabase, solo enviar bienvenida
        this.logger.warn(
          `⚠️ Supabase no configurado (SUPABASE_URL o SUPABASE_SERVICE_KEY faltantes). Enviando solo correo de bienvenida.`,
        );
        try {
          const mailResult = await this.mail.sendAccountCreation({
            to: created.email,
            fullName: created.fullName ?? 'Usuario',
          });
          if (mailResult?.ok) {
            emailSent = true;
            this.logger.log(`✅ Correo de bienvenida enviado a ${created.email}`);
          } else {
            emailError =
              mailResult?.error || 'Error al enviar correo de bienvenida';
            this.logger.error(
              `❌ Error enviando correo de bienvenida: ${emailError}`,
            );
          }
        } catch (mailErr: any) {
          emailError =
            mailErr?.message || 'Error al enviar correo de bienvenida';
          this.logger.error(
            `❌ Error enviando correo de bienvenida: ${emailError}`,
          );
        }
      }
    } catch (error: any) {
      emailError =
        error?.message || 'Error al enviar correo electrónico de confirmación';
      this.logger.error(`❌ Error general enviando correo: ${emailError}`);
      // No fallar el registro si el correo falla
    }

    this.logger.log(
      `register-external finalizado: id=${created.id} email=${body.email} emailSent=${emailSent} emailError=${emailError || 'ninguno'}`,
    );
    return {
      ok: true,
      created: true,
      id: created.id,
      emailSent,
      emailError: emailError || undefined,
    };
  }

  // Desarrollo: endpoint para forzar la creación del usuario admin si no existe
  @Post('dev-seed-admin')
  async devSeedAdmin() {
    // ESTE MÉTODO SOLO DEBE USARSE SI EL USUARIO YA EXISTE EN SUPABASE
    // O SI TENEMOS LA SERVICE ROLE KEY (que no tenemos configurada).
    // Por ahora, solo devolverá instrucciones.
    return {
      message:
        'Cree el usuario admin desde el panel o con la API admin/create-user.',
      action: 'POST /auth/admin/create-user',
    };
  }

  // Desarrollo: restablecer contraseña del admin según ADMIN_PASSWORD
  @Post('dev-reset-admin')
  async devResetAdmin() {
    const email = process.env.ADMIN_EMAIL ?? 'admin@industriasp.local';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    const existing = await this.users.findByEmail(email);
    if (!existing) return { reset: false, error: 'admin_not_found', email };
    await this.users.update(existing.id, { password } as any);
    return { reset: true, email };
  }
}
