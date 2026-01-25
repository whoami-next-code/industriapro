import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { UserStatus } from '../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    if (!session) {
      throw new UnauthorizedException('Sesión expirada');
    }

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

    return { userId: user.id, email: user.email, role: user.role };
  }
}
