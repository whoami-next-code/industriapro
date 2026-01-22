import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RolesGuard } from './auth/roles.guard';
import { LoggingInterceptor } from './common/logging.interceptor';
import { ReportesModule } from './reportes/reportes.module';
import { ContactosModule } from './contactos/contactos.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductosModule } from './productos/productos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { CotizacionesModule } from './cotizaciones/cotizaciones.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { ComprasModule } from './compras/compras.module';
import { PagosModule } from './pagos/pagos.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { MailModule } from './mail/mail.module';
import { AiModule } from './ai/ai.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    AiModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbType = (process.env.DB_TYPE ?? '').toLowerCase();
        const isProd =
          (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

        // OPCIÓN 1: SQLite para desarrollo local (si DB_TYPE=sqlite o no hay configuración válida de PostgreSQL)
        const hasDatabaseUrl = !!process.env.DATABASE_URL;
        const hasDbHost =
          !!process.env.DB_HOST || !!process.env.SUPABASE_DB_HOST;

        // Detectar si DB_HOST es una IP (IPv4 o IPv6) - esto es incorrecto para Supabase
        const dbHost =
          process.env.DB_HOST ?? process.env.SUPABASE_DB_HOST ?? '';
        const isIpAddress =
          dbHost.match(/^\d+\.\d+\.\d+\.\d+$/) ||
          (dbHost.includes(':') && !dbHost.includes('.supabase.co'));

        // Si DB_TYPE=sqlite, o no hay configuración válida, o hay una IP incorrecta, usar SQLite
        if (
          dbType === 'sqlite' ||
          (!isProd && !hasDatabaseUrl && !hasDbHost) ||
          (!isProd && isIpAddress && !dbHost.includes('.supabase.co'))
        ) {
          const sqlitePath =
            process.env.SQLITE_PATH ?? join(process.cwd(), 'dev.sqlite');
          if (isIpAddress) {
            console.warn(
              '⚠️  DB_HOST parece ser una IP directa. Usando SQLite para desarrollo.',
            );
            console.warn(
              '💡 Para usar Supabase, configura DB_HOST con el hostname (ej: db.xxxxx.supabase.co)',
            );
          }
          console.log(`📊 Usando SQLite para desarrollo: ${sqlitePath}`);
          return {
            type: 'better-sqlite3' as const,
            database: sqlitePath,
            autoLoadEntities: true,
            synchronize: true,
          };
        }

        // OPCIÓN 2: PostgreSQL (Supabase o local)
        const dbName = process.env.DB_NAME ?? 'postgres';
        const pass =
          process.env.DB_PASS ??
          process.env.PG_PASS ??
          process.env.SUPABASE_DB_PASSWORD ??
          '';

        // Si hay DATABASE_URL, usarla directamente (formato: postgres://user:pass@host:port/db)
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          try {
            // Manejar tanto postgres:// como postgresql://
            let urlString = databaseUrl.replace(/^postgres:/, 'postgresql:');

            // Si la URL no tiene protocolo, agregarlo
            if (!urlString.startsWith('postgresql://')) {
              urlString = 'postgresql://' + urlString;
            }

            const url = new URL(urlString);

            // Validar que el hostname no sea una IP directa (especialmente IPv6)
            const hostname = url.hostname;
            const isUrlIpAddress =
              hostname.match(/^\d+\.\d+\.\d+\.\d+$/) ||
              (hostname.includes(':') &&
                !hostname.includes('.supabase.co') &&
                !hostname.includes('.supabase.com'));

            if (isUrlIpAddress && !isProd) {
              console.warn(
                '⚠️  DATABASE_URL contiene una IP directa. Usando SQLite para desarrollo.',
              );
              console.warn(
                '💡 Para usar Supabase, usa el hostname en la URL (ej: db.xxxxx.supabase.co)',
              );
              const sqlitePath =
                process.env.SQLITE_PATH ?? join(process.cwd(), 'dev.sqlite');
              console.log(`📊 Usando SQLite para desarrollo: ${sqlitePath}`);
              return {
                type: 'better-sqlite3' as const,
                database: sqlitePath,
                autoLoadEntities: true,
                synchronize: true,
              };
            }

            // Decodificar la contraseña si está codificada
            const password = decodeURIComponent(url.password || '');

            const config = {
              type: 'postgres' as const,
              host: hostname,
              port: Number(url.port) || 5432,
              username: decodeURIComponent(url.username || 'postgres'),
              password: password,
              database: url.pathname.slice(1) || 'postgres',
              autoLoadEntities: true,
              synchronize: true,
              ssl:
                url.searchParams.get('sslmode') === 'require' ||
                url.searchParams.get('sslmode') === 'prefer' ||
                url.searchParams.get('ssl') === 'true' ||
                hostname.includes('supabase.co') ||
                hostname.includes('supabase.com')
                  ? { rejectUnauthorized: false }
                  : (process.env.DB_SSL ?? 'true') === 'true'
                    ? { rejectUnauthorized: false }
                    : undefined,
            };

            console.log(
              `📊 Conectando a PostgreSQL: ${config.host}:${config.port}/${config.database} (usuario: ${config.username})`,
            );

            return config;
          } catch (e: any) {
            console.error('❌ Error parseando DATABASE_URL:', e.message);
            console.warn(
              '💡 Tip: Verifica que la URL tenga el formato: postgresql://user:password@host:port/database',
            );
            // Continuar con variables individuales
          }
        }

        if (isProd && !pass) {
          throw new Error(
            'DB_PASS o SUPABASE_DB_PASSWORD requerido en producción',
          );
        }

        const host =
          process.env.DB_HOST ??
          process.env.PG_HOST ??
          process.env.SUPABASE_DB_HOST ??
          'localhost';

        // Validar que no sea una IP directa (Supabase requiere hostname)
        if (host.match(/^\d+\.\d+\.\d+\.\d+$/) || host.includes(':')) {
          console.error(
            '⚠️  ADVERTENCIA: DB_HOST parece ser una IP directa. Para Supabase, usa el hostname (ej: db.xxxxx.supabase.co)',
          );
        }

        const config = {
          type: 'postgres' as const,
          host,
          port: Number(
            process.env.DB_PORT ??
              process.env.PG_PORT ??
              process.env.SUPABASE_DB_PORT ??
              5432,
          ),
          username:
            process.env.DB_USER ??
            process.env.PG_USER ??
            process.env.SUPABASE_DB_USER ??
            'postgres',
          password: pass,
          database: dbName,
          autoLoadEntities: true,
          synchronize: true,
          ssl:
            (process.env.DB_SSL ?? 'true') === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
        };

        // Log de configuración (sin mostrar password completo)
        console.log(
          `📊 Configuración PostgreSQL: ${config.host}:${config.port}/${config.database} (usuario: ${config.username})`,
        );

        return config;
      },
    }),
    UsersModule,
    AuthModule,
    ProductosModule,
    CategoriasModule,
    CotizacionesModule,
    PedidosModule,
    ComprasModule,
    PagosModule,
    ComprobantesModule,
    ContactosModule,
    ReportesModule,
    RealtimeModule,
    MailModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
