import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private mail: MailService,
    private audit: AuditService,
  ) {}

  private generateTempPassword(length = 12) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const pool = upper + lower + digits;
    const pick = (chars: string) =>
      chars[randomBytes(1)[0] % chars.length];
    const result = [pick(upper), pick(lower), pick(digits)];
    while (result.length < length) {
      result.push(pick(pool));
    }
    return result
      .sort(() => (randomBytes(1)[0] % 2 === 0 ? -1 : 1))
      .join('');
  }

  async createUserByAdmin(data: {
    email: string;
    fullName?: string;
    phone?: string;
    role?: string;
    active?: boolean;
  }) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException(
        'Configuración de Supabase incompleta en el servidor',
      );
    }

    const tempPassword = this.generateTempPassword();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: userData, error } = await supabase.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        fullName: data.fullName,
        phone: data.phone,
        role: data.role ?? 'CLIENTE',
        mustChangePassword: true,
      },
    });

    let supabaseUser = userData?.user;
    let created = true;
    if (error) {
      if (error.message.includes('already been registered')) {
        created = false;
        const { data: listData, error: listError } =
          await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
        if (listError) {
          throw new BadRequestException(
            `Error de Supabase: ${listError.message}`,
          );
        }
        supabaseUser =
          listData?.users?.find(
            (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
          ) ?? null;
        if (!supabaseUser) {
          throw new BadRequestException(
            'Error de Supabase: usuario ya registrado pero no encontrado',
          );
        }
        const { error: updateError } =
          await supabase.auth.admin.updateUserById(supabaseUser.id, {
            password: tempPassword,
            user_metadata: {
              fullName: data.fullName,
              phone: data.phone,
              role: data.role ?? 'CLIENTE',
              mustChangePassword: true,
            },
          });
        if (updateError) {
          throw new BadRequestException(
            `Error de Supabase: ${updateError.message}`,
          );
        }
      } else {
        throw new BadRequestException(`Error de Supabase: ${error.message}`);
      }
    }

    const email = data.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    const userPayload = {
      email,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role as any,
      verified: true,
      supabaseUid: supabaseUser?.id,
      active: data.active ?? true,
      mustChangePassword: true,
    };

    const user = existing
      ? await this.users.update(existing.id, userPayload as any)
      : await this.users.create({ ...userPayload, password: tempPassword });

    await this.audit.log('user.created_by_admin', user.id, {
      email,
      role: user.role,
    });

    return {
      ok: true,
      user,
      tempPassword,
      created,
    };
  }

  // Nota: Login/Registro principal debe ocurrir en el Frontend (Cliente Supabase).
  // Estos métodos quedan como soporte para flujos legacy o administrativos.

  async register(data: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }) {
    // Delegar a Supabase
    return this.registerWithSupabase(data);
  }

  async registerWithSupabase(data: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException(
        'Configuración de Supabase incompleta en el servidor',
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Crear usuario via Admin API (confirma automáticamente si se desea, o envía correos)
    const { data: userData, error } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirmar si lo crea un admin, o false si requiere verificación
      user_metadata: {
        fullName: data.fullName,
        phone: data.phone,
        role: 'CLIENTE', // Default
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        // Si ya existe, intentar re-enviar verificación y devolver respuesta OK
        let resendResult: { sent?: boolean } = {};
        try {
          resendResult = await this.resendVerificationByEmail(data.email);
        } catch (resendErr: any) {
          this.logger.warn(
            `Error reenviando verificación a ${data.email}: ${resendErr?.message || resendErr}`,
          );
        }
        await this.audit.log('user.register_already_exists', 0, {
          email: data.email,
          method: 'backend_admin_api',
          resent: !!resendResult?.sent,
        });
        return {
          ok: true,
          alreadyExists: true,
          emailSent: !!resendResult?.sent,
          message:
            'El correo ya estaba registrado. Se intentó reenviar la verificación.',
        };
      }
      throw new BadRequestException(`Error de Supabase: ${error.message}`);
    }

    // La sincronización ocurrirá vía Trigger en la DB.
    // Sin embargo, para responder rápido, podemos devolver el usuario local si ya se sincronizó,
    // o el objeto de Supabase.

    // Esperar brevemente a que el trigger se ejecute (opcional)
    const delayMs =
      process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID ? 0 : 1000;
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const localUser = await this.users.findBySupabaseUid(userData.user.id);

    // Generar link de verificación y enviar correo vía Resend
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: data.email,
        password: data.password,
        options: {
          redirectTo: `${process.env.WEB_URL || 'http://localhost:3000'}/auth/login`,
        },
      });
      const url = linkData?.properties?.action_link;
      if (url) {
        await this.mail.sendVerification({
          to: data.email,
          fullName: data.fullName || 'Usuario',
          url,
        });
      } else {
        await this.mail.sendAccountCreation({
          to: data.email,
          fullName: data.fullName || 'Usuario',
        });
      }
    } catch {
      await this.mail.sendAccountCreation({
        to: data.email,
        fullName: data.fullName || 'Usuario',
      });
    }

    await this.audit.log('user.registered_backend', localUser?.id || 0, {
      email: data.email,
      method: 'backend_admin_api',
    });

    return {
      ok: true,
      message: 'Usuario creado exitosamente.',
      user: localUser || userData.user,
    };
  }

  async login(data: { email: string; password: string }) {
    // Proxy a Supabase Auth (SignIn)
    // Útil si el frontend no usa el SDK de Supabase directamente aún
    const supabaseUrl = process.env.SUPABASE_URL;
    // Usar ANON key para login normal, o Service Role si es admin simulando
    // Lo ideal es que el login sea client-side.
    // Aquí usaremos la API REST de Supabase para sign-in

    // NOTA: No podemos loguear usuarios con Service Key fácilmente sin ser admin.
    // Se requiere la Anon Key para 'signInWithPassword' público.
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!anonKey) {
      throw new BadRequestException('Falta SUPABASE_ANON_KEY para login proxy');
    }

    if (!supabaseUrl) {
      throw new BadRequestException('Falta SUPABASE_URL');
    }

    const supabase = createClient(supabaseUrl, anonKey);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw new UnauthorizedException('Credenciales inválidas (Supabase)');
    }

    const user = await this.users.findBySupabaseUid(authData.user.id);

    if (!user) {
      throw new UnauthorizedException(
        'Usuario no registrado en el sistema. Contacte al administrador.',
      );
    }

    if (!user.active) {
      throw new UnauthorizedException('Usuario inactivo. Contacte al administrador.');
    }

    await this.audit.log('user.logged_in_proxy', user.id, {
      email: user.email,
    });

    // Retornar el token de Supabase directamente
    return {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      user,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  async changePasswordFirst(
    userId: number,
    supabaseUid: string,
    newPassword: string,
  ) {
    if (!userId || !supabaseUid) {
      throw new BadRequestException('Usuario inválido');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña es muy corta');
    }

    const user = await this.users.findOne(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }
    if (!user.mustChangePassword) {
      return { ok: true, changed: false };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException('Configuración Supabase incompleta');
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.admin.updateUserById(supabaseUid, {
      password: newPassword,
    });
    if (error) {
      throw new BadRequestException(`Error de Supabase: ${error.message}`);
    }

    await this.users.update(user.id, {
      password: newPassword,
      mustChangePassword: false,
    } as any);

    await this.audit.log('user.password_changed_first', user.id, {
      email: user.email,
    });

    return { ok: true, changed: true };
  }

  // Métodos legacy simplificados o eliminados

  async forgotPassword(email: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey)
      throw new BadRequestException('Configuración Supabase incompleta');

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Generar Link de Recuperación (Magic Link)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.WEB_URL || 'http://localhost:3000'}/auth/reset-password`,
      },
    });

    if (error) {
      // Si el usuario no existe, Supabase devuelve error.
      // Por seguridad, a veces es mejor no revelar si existe o no, pero aquí seguiremos el error.
      throw new BadRequestException(error.message);
    }

    // 2. Enviar correo usando MailService (Resend)
    const { user, properties } = data;

    // action_link contiene la URL completa con token y redirect
    await this.mail.sendPasswordReset({
      to: email,
      fullName: user.user_metadata?.fullName,
      token: 'token_oculto_en_url',
      url: properties.action_link,
    });

    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    throw new BadRequestException(
      'El reset de password debe hacerse en el Frontend con Supabase SDK (updateUser).',
    );
  }

  async verifyEmail(token: string) {
    throw new BadRequestException(
      'La verificación de email es manejada por Supabase Auth.',
    );
  }

  async resendVerificationByEmail(email: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException('Configuración Supabase incompleta');
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    let sentByResend = false;
    try {
      const genMagic = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.WEB_URL || 'http://localhost:3000'}/auth/login`,
        },
      });
      const magicUrl = genMagic?.data?.properties?.action_link;
      if (magicUrl) {
        await this.mail.sendVerification({
          to: email,
          fullName: genMagic.data?.user?.user_metadata?.fullName || 'Usuario',
          url: magicUrl,
        });
        sentByResend = true;
      }
    } catch {}
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        // No interrumpir si Supabase no puede enviar; ya enviamos con Resend
      }
    } catch {}
    return { sent: sentByResend };
  }
}
