import { Module } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cotizacion } from './cotizacion.entity';
import { QuotationImage } from './quotation-image.entity';
import { Product } from '../productos/product.entity';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { WhatsappService } from './whatsapp.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cotizacion, Product, QuotationImage, User]),
    AuthModule,
    MailModule,
    RealtimeModule,
    AuditModule,
  ],
  providers: [CotizacionesService, WhatsappService],
  controllers: [CotizacionesController],
})
export class CotizacionesModule {}
