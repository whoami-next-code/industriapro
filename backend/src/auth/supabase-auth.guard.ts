import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');

    try {
      let decoded: any;

      if (jwtSecret) {
        // Validación Offline (Más rápida)
        try {
          decoded = jwt.verify(token, jwtSecret) as any;
        } catch (err) {
          this.logger.error(`Token verification failed: ${err.message}`);
          throw new UnauthorizedException('Token inválido o expirado');
        }
      } else {
        // Fallback: Validación Online (Lenta)
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const serviceKey = this.configService.get<string>(
          'SUPABASE_SERVICE_KEY',
        ); // O Service Role

        if (!supabaseUrl || !serviceKey) {
          throw new UnauthorizedException(
            'Configuración de Supabase incompleta',
          );
        }

        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: serviceKey,
          } as any,
        });

        if (!res.ok) {
          throw new UnauthorizedException('Token inválido o expirado');
        }
        decoded = await res.json();
      }

      // El token de Supabase tiene 'sub' como el UUID del usuario
      const supabaseUid = decoded.sub || decoded.id;

      // Buscar usuario en DB local
      let localUser = await this.usersService.findBySupabaseUid(supabaseUid);

      if (!localUser && decoded.email) {
        localUser = await this.usersService.findByEmail(decoded.email);
        if (localUser) {
          await this.usersService.update(localUser.id, {
            supabaseUid,
          } as any);
          this.logger.log(
            `Usuario sincronizado por email en guard: ${localUser.email}`,
          );
        }
      }

      if (!localUser) {
        throw new UnauthorizedException(
          'Usuario no sincronizado. Por favor, contacte al administrador.',
        );
      }

      if (!localUser.active) {
        throw new UnauthorizedException(
          'Usuario inactivo. Por favor, contacte al administrador.',
        );
      }

      if (localUser.mustChangePassword) {
        const path = req?.originalUrl || '';
        const method = (req?.method || 'GET').toUpperCase();
        const allowlist = [
          '/auth/change-password-first',
          '/auth/profile',
        ];
        const allowReadonly =
          method === 'GET' &&
          (path.startsWith('/api/pedidos') ||
            path.startsWith('/api/trabajos') ||
            path.startsWith('/api/cotizaciones'));
        const allowProgressReport =
          method === 'POST' &&
          path.startsWith('/api/cotizaciones/') &&
          path.includes('/avances');
        const allowQuoteAttachments =
          method === 'POST' && path.startsWith('/api/cotizaciones/adjuntos');
        const allowed =
          allowlist.some((p) => path.includes(p)) ||
          allowReadonly ||
          allowProgressReport ||
          allowQuoteAttachments;
        if (!allowed) {
          throw new ForbiddenException(
            'Debe cambiar su contraseña antes de continuar.',
          );
        }
      }

      req.user = {
        userId: localUser.id,
        supabaseId: supabaseUid,
        email: localUser.email,
        role: localUser.role,
        mustChangePassword: !!localUser.mustChangePassword,
      };

      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.error(`Auth error: ${e.message}`, e.stack);
      throw new UnauthorizedException('No autorizado');
    }
  }
}
