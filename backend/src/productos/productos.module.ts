import { Module } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), RealtimeModule, AuthModule, EventsModule],
  providers: [ProductosService],
  controllers: [ProductosController],
  exports: [ProductosService], // Exportar para que otros módulos puedan usarlo
})
export class ProductosModule {}
