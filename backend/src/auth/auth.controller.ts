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

  @Get('verify-supabase-token')
  async verifySupabaseToken(
    @Query('token') token: string,
    @Query('type') type: string = 'magiclink',
  ) {
    this.logger.log(`verify-supabase-token start token=${token?.substring(0, 20)}... type=${type}`);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException('Configuración de Supabase faltante');
    }

    if (!token) {
      throw new BadRequestException('Token de verificación faltante');
    }

    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Verificar el token con Supabase
      const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=${type}`;
      
      const response = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        const errorMessage = errorData.error || errorData.message || `Error ${response.status}`;
        this.logger.error(`verify-supabase-token error: ${errorMessage}`);
        throw new BadRequestException(errorMessage);
      }

      const responseData = await response.json();
      
      if (!responseData.access_token) {
        throw new BadRequestException('No se recibió access_token de Supabase. El token puede haber expirado.');
      }

      this.logger.log(`verify-supabase-token success email=${responseData.user?.email || 'unknown'}`);
      
      return {
        ok: true,
        access_token: responseData.access_token,
        refresh_token: responseData.refresh_token,
        user: responseData.user,
      };
    } catch (error: any) {
      this.logger.error(`verify-supabase-token exception: ${error.message || error}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error?.message || 'Error al verificar el token');
    }
  }

  @Post('check-email')
  async checkEmail(@Body() body: CheckEmailDto) {
    this.logger.log(`check-email start email=${body.email}`);
    
    // Primero verificar en la base de datos local
    const existing = await this.users.findByEmail(body.email);
    if (existing && existing.verified) {
      // Si existe y está verificado, el correo está en uso
      this.logger.log(
        `check-email local-hit verified email=${body.email}`,
      );
      return {
        exists: true,
        verified: true,
      };
    }

    // Si existe pero NO está verificado, permitir registro (el usuario puede re-registrarse)
    if (existing && !existing.verified) {
      this.logger.log(
        `check-email local-hit unverified email=${body.email} - permitiendo registro`,
      );
      return {
        exists: false,
        verified: false,
      };
    }

    // Verificar en Supabase solo si no existe en la base de datos local
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
      
      // Buscar usuario específico por email en lugar de listar todos
      const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Aumentar para buscar mejor
      });
      
      if (listError) {
        this.logger.warn(
          `check-email supabase error email=${body.email}: ${listError.message}`,
        );
        return { exists: false, verified: false };
      }
      
      const user = userList?.users?.find(
        (u) => u.email?.toLowerCase() === body.email.toLowerCase(),
      );
      
      if (!user) {
        // No existe en Supabase, el correo está disponible
        this.logger.log(
          `check-email supabase-not-found email=${body.email} - correo disponible`,
        );
        return {
          exists: false,
          verified: false,
        };
      }
      
      const emailConfirmed = !!user?.email_confirmed_at;
      
      // IMPORTANTE: Solo considerar que el correo está "en uso" si está VERIFICADO
      // Si existe pero NO está verificado, permitir el registro
      if (!emailConfirmed) {
        this.logger.log(
          `check-email supabase-found unverified email=${body.email} - permitiendo registro (usuario no verificado)`,
        );
        // Eliminar el usuario no verificado de Supabase para limpiar
        try {
          await supabase.auth.admin.deleteUser(user.id);
          this.logger.log(
            `check-email deleted unverified user from Supabase email=${body.email}`,
          );
        } catch (deleteErr: any) {
          this.logger.warn(
            `check-email failed to delete unverified user email=${body.email}: ${deleteErr.message}`,
          );
        }
        return {
          exists: false,
          verified: false,
        };
      }
      
      // Si está verificado en Supabase pero NO existe en la base de datos local,
      // significa que fue eliminado de la BD local, así que permitir registro de nuevo
      // Solo bloquear si existe Y está verificado en la BD local
      this.logger.log(
        `check-email supabase-found verified but not in local DB email=${body.email} - permitiendo registro (usuario fue eliminado de BD local)`,
      );
      
      // Opcional: eliminar también de Supabase para permitir registro limpio
      // O simplemente permitir el registro y que se actualice el usuario existente
      // Por ahora, permitimos el registro
      return {
        exists: false,
        verified: false,
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
          // Verificar si el usuario ya existe en Supabase y tiene contraseña
          const { data: existingUser } = await supabase.auth.admin.getUserById(body.id || '');
          
          // Si el usuario ya existe y fue creado con signUp, usar 'signup' link para mantener la contraseña
          // Si no, usar 'magiclink' (pero esto no establecerá contraseña)
          const linkType = existingUser?.user && existingUser.user.created_at ? 'signup' : 'magiclink';
          
          this.logger.log(
            `Generando link de tipo ${linkType} para email=${body.email}`,
          );
          
          // Usar 'signup' si el usuario ya tiene contraseña, 'magiclink' si no
          const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: linkType as any,
            email: body.email,
            ...(linkType === 'signup' && existingUser?.user ? {
              password: undefined, // No podemos obtener la contraseña, pero signup link funcionará si ya existe
            } : {}),
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
          
          // SOLUCIÓN: Construir nuestro propio link que redirija directamente al frontend
          // Extraer el token del link de Supabase y construir un link que vaya a nuestro frontend
          let finalUrlToSend = url;
          if (url) {
            // Extraer el token del link de Supabase
            const tokenMatch = url.match(/[?&]token=([^&]+)/);
            const typeMatch = url.match(/[?&]type=([^&]+)/);
            const token = tokenMatch ? tokenMatch[1] : null;
            const type = typeMatch ? typeMatch[1] : 'magiclink';
            
            if (token) {
              this.logger.log(
                `Token extraído: ${token.substring(0, 20)}...`,
              );
              // Construir nuestro propio link que vaya directamente al frontend
              // El frontend manejará la verificación del token con Supabase
              finalUrlToSend = `${webUrl}/auth/verify-supabase?token=${encodeURIComponent(token)}&type=${type}`;
              this.logger.log(
                `✅ Link personalizado construido: ${finalUrlToSend}`,
              );
              this.logger.log(
                `Este link redirigirá directamente al frontend sin pasar por Supabase para la redirección final.`,
              );
            } else {
              this.logger.warn(
                `⚠️ No se pudo extraer el token del link de Supabase. Usando link original.`,
              );
            }
          }
          
          // Verificar que el link personalizado no contenga direcciones locales
          if (finalUrlToSend && (finalUrlToSend.includes('localhost') || finalUrlToSend.includes('127.0.0.1') || finalUrlToSend.includes('0.0.0.0'))) {
            this.logger.error(
              `❌ ERROR CRÍTICO: El link personalizado contiene dirección local: ${finalUrlToSend}`,
            );
            // Forzar uso de URL de producción
            const tokenMatch = finalUrlToSend.match(/[?&]token=([^&]+)/);
            const typeMatch = finalUrlToSend.match(/[?&]type=([^&]+)/);
            if (tokenMatch && typeMatch) {
              finalUrlToSend = `${webUrl}/auth/verify-supabase?token=${tokenMatch[1]}&type=${typeMatch[1]}`;
              this.logger.warn(
                `Link corregido forzadamente: ${finalUrlToSend}`,
              );
            }
          }
          
          if (finalUrlToSend) {
            this.logger.log(
              `Enviando correo de verificación con Resend a ${created.email}`,
            );
            this.logger.log(
              `URL final que se enviará en el correo: ${finalUrlToSend}`,
            );
            const mailResult = await this.mail.sendVerification({
              to: created.email,
              fullName: created.fullName ?? 'Usuario',
              url: finalUrlToSend,
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
