import { Module } from '@nestjs/common';
import { EventsPublisher } from './events.publisher';
import { EventsConsumer } from './events.consumer';
import { RabbitMQService } from './rabbitmq.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Módulo de Eventos con RabbitMQ
 * 
 * Este módulo proporciona:
 * - EventsPublisher: Para publicar eventos desde otros servicios
 * - EventsConsumer: Para procesar eventos de RabbitMQ
 * 
 * Configuración para Railway:
 * Railway proporciona automáticamente las variables de entorno:
 * - RABBITMQ_URL (formato: amqp://user:pass@host:port/vhost)
 * - O variables individuales: RABBITMQ_HOST, RABBITMQ_PORT, etc.
 */
@Module({
  imports: [
    // Módulos necesarios para los consumers
    RealtimeModule,
    MailModule,
    AuditModule,
  ],
  providers: [
    RabbitMQService,
    EventsPublisher,
    EventsConsumer,
  ],
  exports: [EventsPublisher, RabbitMQService], // Exportar para salud y publicación de eventos
})
export class EventsModule {}
