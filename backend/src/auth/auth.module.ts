import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserToken } from './user-token.entity';
import { RedisModule } from '../redis/redis.module';
import { SystemLogModule } from '../system-log/system-log.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: (() => {
          if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET requerido');
          }
          return process.env.JWT_SECRET;
        })(),
        // usar segundos para cumplir con el tipo de Nest JWT (number)
        signOptions: {
          expiresIn: Number(process.env.JWT_EXPIRES_IN ?? 604800),
        },
      }),
    }),
    MailModule,
    AuditModule,
    SystemLogModule,
    RedisModule,
    TypeOrmModule.forFeature([UserToken]),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 120,
      },
    ]),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, UsersModule],
  controllers: [AuthController],
})
export class AuthModule {}
