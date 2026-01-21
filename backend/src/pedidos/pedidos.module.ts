import { Module } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { TrabajosController } from './trabajos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from './pedido.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { ComprobantesModule } from '../comprobantes/comprobantes.module';
import { CotizacionesModule } from '../cotizaciones/cotizaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido]),
    RealtimeModule,
    MailModule,
    AuthModule,
    EventsModule,
    ComprobantesModule,
    CotizacionesModule,
  ],
  providers: [PedidosService],
  controllers: [PedidosController, TrabajosController],
})
export class PedidosModule {}
