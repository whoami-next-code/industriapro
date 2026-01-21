import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  // ===== DEBUG INICIAL (CRÍTICO PARA RAILWAY) =====
  console.log('🚀 Bootstrap started');
  console.log('ENV PORT:', process.env.PORT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS);
  console.log('RABBITMQ_URL:', process.env.RABBITMQ_URL ? 'Configurado' : 'No configurado');

  const app = await NestFactory.create(AppModule);
  console.log('✅ Nest app created');

  if (!process.env.RABBITMQ_URL && !process.env.RABBITMQ_HOST) {
    console.warn('⚠️  RabbitMQ no configurado - Los eventos funcionarán solo vía Socket.IO');
  }

  // ===== HELMET =====
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
  console.log('✅ Helmet configured');

  // ===== CORS =====
  const corsOriginsEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

  console.log('[CORS] Environment:', process.env.NODE_ENV);
  console.log('[CORS] Allowed Origins:', corsOriginsEnv.length ? corsOriginsEnv : 'NONE');

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Permitir requests sin origin (Flutter, curl, Postman)
      if (!origin) return cb(null, true);

      // Permitir wildcard
      if (corsOriginsEnv.includes('*')) return cb(null, true);

      // Permitir si está en la lista
      if (corsOriginsEnv.includes(origin)) return cb(null, true);

      try {
        const hostname = new URL(origin).hostname;
        // Permitir localhost siempre (útil para admin/local)
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          return cb(null, true);
        }
        // Permitir red local SOLO en no-producción
        if (!isProd) {
          if (
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.')
          ) {
            return cb(null, true);
          }
        }
      } catch {}

      console.error(`[CORS] Blocked origin: ${origin}`);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
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

  console.log('✅ CORS enabled');

  // ===== STRIPE WEBHOOK (RAW BODY) =====
  app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));
  console.log('✅ Stripe webhook configured');

  // ===== VALIDATION =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  console.log('✅ Global validation pipes enabled');

  // ===== START SERVER (CRÍTICO) =====
  const port = Number(process.env.PORT) || 3001;
  console.log(`🚀 Server listening on 0.0.0.0:${port}`);

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed', err);
  process.exit(1);
});
