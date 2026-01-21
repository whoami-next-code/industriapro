import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { EventsService } from '../realtime/events.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from './rabbitmq.service';
import {
  EVENT_NAMES,
  EVENTS_CORE_QUEUE,
  EVENTS_DLX_EXCHANGE,
  EVENTS_DLX_ROUTING_KEY,
  EVENTS_EXCHANGE,
} from './events.constants';
import { EventEnvelope } from './events.contracts';

const MAX_RETRIES = 3;

/**
 * Consumer de eventos RabbitMQ (topic exchange)
 */
@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);

  constructor(
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly rabbit: RabbitMQService,
  ) {}

  async onModuleInit() {
    if (!this.rabbit.isReady()) return;
    await this.rabbit.consume(EVENTS_CORE_QUEUE, async (message, channel) =>
      this.handleMessage(message, channel),
    );
    this.logger.log('EventsConsumer iniciado - Escuchando eventos RabbitMQ');
  }

  onModuleDestroy() {
    this.logger.log('EventsConsumer detenido');
  }

  private getRetryCount(message: ConsumeMessage) {
    const retry = message.properties.headers?.['x-retry-count'];
    return Number(retry ?? 0);
  }

  private async sendToDlq(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    routingKey: string,
  ) {
    channel.publish(
      EVENTS_DLX_EXCHANGE,
      EVENTS_DLX_ROUTING_KEY,
      message.content,
      {
        headers: {
          'x-original-routing-key': routingKey,
          'x-retry-count': this.getRetryCount(message),
        },
        contentType: 'application/json',
        persistent: true,
      },
    );
  }

  private async handleMessage(message: ConsumeMessage, channel: ConfirmChannel) {
    const routingKey = message.fields.routingKey;
    const raw = message.content.toString();
    let envelope: EventEnvelope<any>;

    try {
      envelope = JSON.parse(raw) as EventEnvelope<any>;
    } catch (error) {
      this.logger.error('Mensaje inválido (JSON)', error);
      channel.ack(message);
      return;
    }

    if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) {
      this.logger.error('Mensaje inválido (envelope)', { routingKey });
      channel.ack(message);
      return;
    }

    const event = envelope.event || routingKey;

    try {
      switch (event) {
        case EVENT_NAMES.PEDIDO_CREADO:
          await this.handlePedidoCreado(envelope.data);
          break;
        case EVENT_NAMES.PEDIDO_ACTUALIZADO:
          await this.handlePedidoActualizado(envelope.data);
          break;
        case EVENT_NAMES.PEDIDO_ESTADO_CAMBIADO:
          await this.handlePedidoEstadoCambiado(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_CREADA:
          await this.handleCotizacionCreada(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_ACTUALIZADA:
          await this.handleCotizacionActualizada(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_ESTADO_CAMBIADO:
          await this.handleCotizacionEstadoCambiado(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_IMAGEN_SUBIDA:
          await this.handleImagenSubida(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_IMAGEN_APROBADA:
          await this.handleImagenAprobada(envelope.data);
          break;
        case EVENT_NAMES.COTIZACION_IMAGEN_RECHAZADA:
          await this.handleImagenRechazada(envelope.data);
          break;
        case EVENT_NAMES.PRODUCTO_CREADO:
          await this.handleProductoCreado(envelope.data);
          break;
        case EVENT_NAMES.PRODUCTO_ACTUALIZADO:
          await this.handleProductoActualizado(envelope.data);
          break;
        case EVENT_NAMES.PRODUCTO_ELIMINADO:
          await this.handleProductoEliminado(envelope.data);
          break;
        case EVENT_NAMES.PAGO_CREADO:
          await this.handlePagoCreado(envelope.data);
          break;
        case EVENT_NAMES.PAGO_COMPLETADO:
          await this.handlePagoCompletado(envelope.data);
          break;
        case EVENT_NAMES.USUARIO_CREADO:
          await this.handleUsuarioCreado(envelope.data);
          break;
        case EVENT_NAMES.USUARIO_ACTUALIZADO:
          await this.handleUsuarioActualizado(envelope.data);
          break;
        default:
          this.logger.warn(`Evento no manejado: ${event}`);
          break;
      }

      await this.audit.log('event.processed', undefined, {
        event,
        routingKey,
        messageId: message.properties.messageId,
      });

      channel.ack(message);
    } catch (error) {
      const retryCount = this.getRetryCount(message);
      this.logger.error(`Error procesando ${event}`, error);

      if (retryCount < MAX_RETRIES) {
        channel.publish(
          EVENTS_EXCHANGE,
          routingKey,
          message.content,
          {
            headers: {
              'x-retry-count': retryCount + 1,
            },
            contentType: 'application/json',
            persistent: true,
          },
        );
      } else {
        await this.sendToDlq(channel, message, routingKey);
      }
      channel.ack(message);
    }
  }

  private async handlePedidoCreado(data: any) {
    this.logger.log(`Pedido creado: ${data.orderNumber}`);

    if (data.customerEmail) {
      await this.mail.sendPedidoConfirmation({
        orderNumber: data.orderNumber,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        total: data.total,
      }).catch((error: any) => {
        this.logger.error('Error enviando email de confirmación:', error);
      });
    }

    await this.audit.log('pedido.creado', data.userId, {
      entityType: 'pedido',
      entityId: data.id,
      orderNumber: data.orderNumber,
    }).catch((error: any) => {
      this.logger.error('Error registrando auditoría:', error);
    });

    this.events.pedidosUpdated({
      id: data.id,
      orderNumber: data.orderNumber,
      status: data.status,
      action: 'created',
    });
  }

  private async handlePedidoActualizado(data: any) {
    this.logger.log(`Pedido actualizado: ${data.orderNumber}`);
    this.events.pedidosUpdated({
      id: data.id,
      orderNumber: data.orderNumber,
      status: data.status,
      paymentStatus: data.paymentStatus,
      action: 'updated',
    });
  }

  private async handlePedidoEstadoCambiado(data: any) {
    this.logger.log(`Estado pedido: ${data.oldStatus} -> ${data.newStatus}`);
    this.events.pedidosUpdated({
      pedidoId: data.pedidoId,
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
      action: 'status_changed',
    });
  }

  private async handleCotizacionCreada(data: any) {
    this.logger.log(`Cotización creada: ${data.id}`);
    if (data.customerEmail) {
      await this.mail.sendQuotationConfirmation({
        quotationId: data.id,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
      }).catch((error: any) => {
        this.logger.error('Error enviando email de cotización:', error);
      });
    }

    this.events.cotizacionesUpdated({
      id: data.id,
      status: data.status,
      action: 'created',
    });
  }

  private async handleCotizacionActualizada(data: any) {
    this.logger.log(`Cotización actualizada: ${data.id}`);
    this.events.cotizacionesUpdated({
      id: data.id,
      status: data.status,
      action: 'updated',
    });
  }

  private async handleCotizacionEstadoCambiado(data: any) {
    this.logger.log(`Estado cotización: ${data.oldStatus} -> ${data.newStatus}`);
    this.events.cotizacionesUpdated({
      cotizacionId: data.cotizacionId,
      oldStatus: data.oldStatus,
      newStatus: data.newStatus,
      action: 'status_changed',
    });
  }

  private async handleImagenSubida(data: any) {
    this.logger.log(`Imagen de cotización subida: ${data.imageId}`);
    this.events.emit(EVENT_NAMES.COTIZACION_IMAGEN_SUBIDA, data);
  }

  private async handleImagenAprobada(data: any) {
    this.logger.log(`Imagen de cotización aprobada: ${data.imageId}`);
    this.events.emit(EVENT_NAMES.COTIZACION_IMAGEN_APROBADA, data);
  }

  private async handleImagenRechazada(data: any) {
    this.logger.log(`Imagen de cotización rechazada: ${data.imageId}`);
    this.events.emit(EVENT_NAMES.COTIZACION_IMAGEN_RECHAZADA, data);
  }

  private async handleProductoCreado(data: any) {
    this.logger.log(`Producto creado: ${data.name}`);
    this.events.productosUpdated({
      id: data.id,
      name: data.name,
      action: 'created',
    });
  }

  private async handleProductoActualizado(data: any) {
    this.logger.log(`Producto actualizado: ${data.name}`);
    this.events.productosUpdated({
      id: data.id,
      name: data.name,
      action: 'updated',
    });
  }

  private async handleProductoEliminado(data: any) {
    this.logger.log(`Producto eliminado: ${data.id}`);
    this.events.productosUpdated({
      id: data.id,
      action: 'deleted',
    });
  }

  private async handlePagoCreado(data: any) {
    this.logger.log(`Pago creado: ${data.id}`);
  }

  private async handlePagoCompletado(data: any) {
    this.logger.log(`Pago completado: ${data.id}`);
  }

  private async handleUsuarioCreado(data: any) {
    this.logger.log(`Usuario creado: ${data.email}`);
    if (data.email) {
      await this.mail.sendWelcomeEmail({
        email: data.email,
        name: data.name,
      }).catch((error: any) => {
        this.logger.error('Error enviando email de bienvenida:', error);
      });
    }
  }

  private async handleUsuarioActualizado(data: any) {
    this.logger.log(`Usuario actualizado: ${data.email}`);
  }
}
