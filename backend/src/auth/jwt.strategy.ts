import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { UserStatus } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger('JwtStrategy');

  constructor(
    private readonly users: UsersService,
    private readonly redis: RedisService,
  ) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET requerido');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    if (!payload?.sub || !payload?.jti) {
      throw new UnauthorizedException('Token inválido');
    }

    const sessionKey = `session:${payload.jti}`;
    const session = await this.redis.get(sessionKey);

    const user = await this.users.findOne(Number(payload.sub));
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Sesión inválida');
    }
    if (!user.active || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Usuario inactivo');
    }
    if (!user.verified || (user.status && user.status !== UserStatus.VERIFIED)) {
      throw new UnauthorizedException('Correo no verificado');
    }

    if (!session) {
      try {
        const ttlRaw = Number(process.env.JWT_EXPIRES_IN ?? 604800);
        const ttl = Number.isFinite(ttlRaw) ? ttlRaw : 604800;
        await this.redis.set(sessionKey, String(user.id), ttl);
        await this.redis.sadd(`user_sessions:${user.id}`, payload.jti);
        this.logger.warn(`Sesión rehidratada para userId=${user.id}`);
      } catch (err) {
        this.logger.error('No se pudo rehidratar sesión', err as any);
      }
    }

    return { userId: user.id, email: user.email, role: user.role };
  }
}
