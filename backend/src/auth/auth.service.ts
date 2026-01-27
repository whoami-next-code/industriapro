import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { randomBytes, createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { UserToken, UserTokenType } from './user-token.entity';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { SystemLogService } from '../system-log/system-log.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly webUrl =
    process.env.WEB_URL ||
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    'http://localhost:3000';

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private mail: MailService,
    private audit: AuditService,
    private readonly redis: RedisService,
    private readonly systemLog: SystemLogService,
    @InjectRepository(UserToken)
    private readonly tokens: Repository<UserToken>,
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
    const tempPassword = this.generateTempPassword();

    const email = data.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    const userPayload = {
      email,
      fullName: data.fullName,
      phone: data.phone,
      role: (data.role as any) ?? UserRole.CLIENTE,
      verified: true,
      status: UserStatus.VERIFIED,
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
      created: !existing,
    };
  }

  async register(data: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.status === UserStatus.SUSPENDED || !existing.active) {
        throw new UnauthorizedException('Usuario suspendido');
      }
      if (existing.status === UserStatus.VERIFIED && existing.verified) {
        throw new BadRequestException('El correo ya está registrado');
      }
      const resend = await this.resendVerificationByEmail(email);
      return {
        ok: true,
        alreadyExists: true,
        emailSent: resend.sent,
        message:
          'El correo ya estaba registrado. Se reenvió la verificación si era necesario.',
      };
    }

    const user = await this.users.create({
      email,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone,
      role: UserRole.CLIENTE,
      verified: false,
      status: UserStatus.PENDING,
      active: true,
    });

    const token = await this.createUserToken(
      user,
      UserTokenType.EMAIL_VERIFICATION,
      24 * 60 * 60,
    );

    const url = `${this.webUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    let emailSent = false;
    let emailError: string | null = null;
    try {
      await this.mail.sendVerification({
        to: user.email,
        fullName: user.fullName || 'Usuario',
        url,
      });
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message || 'No se pudo enviar el correo';
      await this.systemLog.error('user.register_email_failed', {
        email: user.email,
        error: emailError,
      });
    }

    await this.audit.log('user.registered', user.id, { email: user.email });
    await this.systemLog.info('user.registered', { email: user.email });

    return {
      ok: true,
      emailSent,
      message: emailSent
        ? 'Cuenta creada. Revisa tu correo para verificarla.'
        : 'Cuenta creada, pero no se pudo enviar el correo. Solicita reenvio.',
    };
  }

  async login(data: { email: string; password: string }) {
    const email = data.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.active || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Usuario inactivo');
    }
    if (!user.verified || (user.status && user.status !== UserStatus.VERIFIED)) {
      throw new UnauthorizedException('Correo no verificado');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Cuenta sin clave local. Usa "Olvide mi contrasena" para establecerla.',
      );
    }
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { token, jti } = await this.issueJwt(user);
    await this.audit.log('user.logged_in', user.id, { email: user.email });

    return {
      access_token: token,
      user,
      mustChangePassword: !!user.mustChangePassword,
    };
  }

  async changePasswordFirst(userId: number, newPassword: string) {
    if (!userId) {
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

    await this.users.update(user.id, {
      password: newPassword,
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
    } as any);

    await this.invalidateSessions(user.id);

    await this.audit.log('user.password_changed_first', user.id, {
      email: user.email,
    });

    return { ok: true, changed: true };
  }

  async forgotPassword(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      return { sent: true };
    }
    if (!user.active || user.status === UserStatus.SUSPENDED) {
      return { sent: true };
    }

    const token = await this.createUserToken(
      user,
      UserTokenType.PASSWORD_RESET,
      2 * 60 * 60,
    );
    const url = `${this.webUrl}/auth/reset/${encodeURIComponent(token)}`;
    try {
      await this.mail.sendPasswordReset({
        to: user.email,
        fullName: user.fullName,
        token,
        url,
        expireHours: 2,
      });
    } catch (err: any) {
      await this.systemLog.error('user.password_reset_email_failed', {
        email: user.email,
        error: err?.message || 'No se pudo enviar el correo',
      });
    }

    await this.audit.log('user.password_reset_requested', user.id, {
      email: user.email,
    });
    await this.systemLog.info('user.password_reset_requested', {
      email: user.email,
    });

    return { sent: true };
  }

  async adminResetPassword(
    email: string,
    requester?: { userId?: number; email?: string; role?: string },
  ) {
    const normalized = email.toLowerCase().trim();
    const user = await this.users.findByEmail(normalized);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }
    if (user.role === UserRole.CLIENTE) {
      throw new ForbiddenException(
        'Solo se puede restablecer contraseñas del personal',
      );
    }
    if (!user.active || user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Usuario inactivo o suspendido');
    }

    const token = await this.createUserToken(
      user,
      UserTokenType.PASSWORD_RESET,
      2 * 60 * 60,
    );
    const url = `${this.webUrl}/auth/reset/${encodeURIComponent(token)}`;

    await this.users.update(user.id, {
      mustChangePassword: true,
      tokenVersion: user.tokenVersion + 1,
    } as any);
    await this.invalidateSessions(user.id);

    try {
      await this.mail.sendPasswordReset({
        to: user.email,
        fullName: user.fullName,
        token,
        url,
        expireHours: 2,
      });
    } catch (err: any) {
      await this.systemLog.error('user.password_reset_admin_email_failed', {
        email: user.email,
        error: err?.message || 'No se pudo enviar el correo',
      });
    }

    await this.audit.log('user.password_reset_admin_requested', user.id, {
      email: user.email,
      requestedBy: requester?.email,
      requesterRole: requester?.role,
    });
    await this.systemLog.info('user.password_reset_admin_requested', {
      email: user.email,
      requestedBy: requester?.email,
      requesterRole: requester?.role,
    });

    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || token.length < 20) {
      throw new BadRequestException('Token inválido');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña es muy corta');
    }

    const record = await this.findValidToken(token, UserTokenType.PASSWORD_RESET);
    const user = await this.users.findOne(record.userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    await this.users.update(user.id, {
      password: newPassword,
      mustChangePassword: false,
      tokenVersion: user.tokenVersion + 1,
    } as any);

    await this.invalidateSessions(user.id);
    record.usedAt = new Date();
    await this.tokens.save(record);

    await this.audit.log('user.password_reset_completed', user.id, {
      email: user.email,
    });
    await this.systemLog.info('user.password_reset_completed', {
      email: user.email,
    });

    return { ok: true };
  }

  async verifyEmail(token: string) {
    const record = await this.findValidToken(
      token,
      UserTokenType.EMAIL_VERIFICATION,
    );
    const user = await this.users.findOne(record.userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    await this.users.update(user.id, {
      verified: true,
      status: UserStatus.VERIFIED,
    } as any);

    record.usedAt = new Date();
    await this.tokens.save(record);

    await this.audit.log('user.email_verified', user.id, { email: user.email });
    await this.systemLog.info('user.email_verified', { email: user.email });

    const { token: accessToken } = await this.issueJwt({
      ...user,
      verified: true,
      status: UserStatus.VERIFIED,
    } as User);
    return { ok: true, access_token: accessToken, user };
  }

  async resendVerificationByEmail(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.users.findByEmail(normalized);
    if (!user) return { sent: true };
    if (user.verified && user.status === UserStatus.VERIFIED) {
      return { sent: true };
    }

    const token = await this.createUserToken(
      user,
      UserTokenType.EMAIL_VERIFICATION,
      24 * 60 * 60,
    );
    const url = `${this.webUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    await this.mail.sendVerification({
      to: user.email,
      fullName: user.fullName || 'Usuario',
      url,
    });
    return { sent: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createUserToken(
    user: User,
    type: UserTokenType,
    ttlSeconds: number,
  ) {
    await this.tokens.update(
      { userId: user.id, type, usedAt: IsNull() },
      { usedAt: new Date() } as any,
    );
    const raw = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const record = this.tokens.create({
      userId: user.id,
      type,
      tokenHash,
      expiresAt,
    });
    await this.tokens.save(record);
    await this.redis.set(`${type}:${raw}`, String(user.id), ttlSeconds);
    return raw;
  }

  private async findValidToken(raw: string, type: UserTokenType) {
    const tokenHash = this.hashToken(raw);
    const record = await this.tokens.findOne({
      where: { tokenHash, type },
      order: { createdAt: 'DESC' },
    });
    if (!record || record.usedAt) {
      throw new BadRequestException('Token inválido o usado');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token expirado');
    }
    return record;
  }

  private async issueJwt(user: User) {
    const jti = randomBytes(12).toString('hex');
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      jti,
    });
    const ttl = Number(process.env.JWT_EXPIRES_IN ?? 604800);
    await this.redis.set(`session:${jti}`, String(user.id), ttl);
    await this.redis.sadd(`user_sessions:${user.id}`, jti);
    return { token, jti };
  }

  private async invalidateSessions(userId: number) {
    const sessionKey = `user_sessions:${userId}`;
    const sessions = await this.redis.smembers(sessionKey);
    for (const jti of sessions) {
      await this.redis.del(`session:${jti}`);
    }
    await this.redis.del(sessionKey);
  }
}
