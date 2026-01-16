import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H2',
        location: 'supabase-auth.guard.ts:canActivate',
        message: 'Auth header check',
        data: {
          hasAuth: !!authHeader,
          tokenPrefix: authHeader ? authHeader.slice(0, 12) : null,
          url: req.url,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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

      if (!localUser) {
        // Intento de fallback por email si el trigger falló o es una cuenta antigua
        if (decoded.email) {
          localUser = await this.usersService.findByEmail(decoded.email);
          if (localUser) {
            // Vincular con supabaseUid
            await this.usersService.update(localUser.id, {
              supabaseUid,
            } as any);
            this.logger.log(
              `Usuario sincronizado por email en guard: ${localUser.email}`,
            );
          }
        }

        // Si aún no existe, crear usuario local automáticamente
        if (!localUser && decoded.email) {
          const fullName =
            decoded.user_metadata?.fullName ||
            decoded.user_metadata?.name ||
            decoded.email?.split('@')[0] ||
            'Usuario';

          localUser = await this.usersService.create({
            email: decoded.email,
            fullName,
            role: decoded.user_metadata?.role || 'CLIENTE',
            verified: decoded.email_confirmed_at ? true : false,
            supabaseUid,
          });

          this.logger.log(
            `Usuario creado automáticamente en guard: ${localUser.email}`,
          );
        }
      }

      if (!localUser) {
        throw new UnauthorizedException(
          'Usuario no sincronizado. Por favor, contacte al administrador.',
        );
      }

      req.user = {
        userId: localUser.id,
        supabaseId: supabaseUid,
        email: localUser.email,
        role: localUser.role,
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H2',
          location: 'supabase-auth.guard.ts:canActivate',
          message: 'SupabaseAuthGuard user attached',
          data: { userId: localUser.id, email: localUser.email, role: localUser.role, url: req.url },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // #region agent log
      fetch(
        'http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H2',
            location: 'supabase-auth.guard.ts:canActivate',
            message: 'Guard success',
            data: {
              userId: localUser.id,
              email: localUser.email,
              role: localUser.role,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion

      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.error(`Auth error: ${e.message}`, e.stack);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H2',
          location: 'supabase-auth.guard.ts:canActivate',
          message: 'Auth error',
          data: { error: e?.message, url: req.url },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      // #region agent log
      fetch(
        'http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'H2',
            location: 'supabase-auth.guard.ts:canActivate',
            message: 'Guard error',
            data: { error: e?.message, path: req.url },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      throw new UnauthorizedException('No autorizado');
    }
  }
}
