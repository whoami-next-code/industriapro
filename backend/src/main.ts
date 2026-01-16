import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar Helmet con políticas más permisivas para archivos estáticos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  const corsOriginsEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return cb(null, true);

      if (corsOriginsEnv.includes(origin)) return cb(null, true);

      try {
        const url = new URL(origin);
        const hostname = url.hostname;
        
        const isLocalNetwork = 
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '10.0.2.2' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.');

        if (!isProd && isLocalNetwork) {
          return cb(null, true);
        }
      } catch {}

      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'x-external-secret',
      'stripe-signature',
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });
  // Webhook de Stripe necesita el body RAW para verificar firmas
  app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));
  
  // Servir archivos estáticos desde public/uploads
  // NOTA: ServeStaticModule en AppModule ya maneja esto desde la raíz 'public'
  // app.use('/uploads', express.static(join(process.cwd(), 'public', 'uploads')));
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
