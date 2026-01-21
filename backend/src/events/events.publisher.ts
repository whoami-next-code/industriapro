import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { EVENT_NAMES } from './events.constants';
import {
  CotizacionActualizadaEvent,
  CotizacionCreadaEvent,
  CotizacionEstadoCambiadoEvent,
  CotizacionImagenEvent,
  EventEnvelope,
  PagoCompletadoEvent,
  PagoCreadoEvent,
  PedidoActualizadoEvent,
  PedidoCreadoEvent,
  PedidoEstadoCambiadoEvent,
  ProductoActualizadoEvent,
  ProductoCreadoEvent,
  ProductoEliminadoEvent,
  UsuarioActualizadoEvent,
  UsuarioCreadoEvent,
} from './events.contracts';
import { EVENTS_EXCHANGE } from './events.constants';

/**
 * Service para publicar eventos en RabbitMQ
 * 
 * Este servicio permite a otros módulos publicar eventos de forma
 * asíncrona sin conocer los detalles de RabbitMQ.
 */
@Injectable()
export class EventsPublisher {
  private readonly logger = new Logger(EventsPublisher.name);

  constructor(private readonly rabbit: RabbitMQService) {}

  /**
   * Publica un evento genérico en RabbitMQ
   * @param eventType Tipo de evento (ej: 'pedido.creado', 'cotizacion.actualizada')
   * @param payload Datos del evento
   */
  async publish(eventType: string, payload: any): Promise<void> {
    try {
      if (!this.rabbit.isReady()) return;
      const envelope: EventEnvelope<any> = {
        event: eventType as any,
        occurredAt: new Date().toISOString(),
        data: payload,
      };
      await this.rabbit.publish(
        EVENTS_EXCHANGE,
        eventType,
        Buffer.from(JSON.stringify(envelope)),
      );
      this.logger.debug(`Evento publicado: ${eventType}`);
    } catch (error) {
      this.logger.error(`Error publicando evento ${eventType}:`, error);
      throw error;
    }
  }

  // ========== EVENTOS DE PEDIDOS ==========
  
  async pedidoCreated(pedido: any): Promise<void> {
    const payload: PedidoCreadoEvent = {
      id: pedido.id,
      orderNumber: pedido.orderNumber,
      customerEmail: pedido.customerEmail,
      customerName: pedido.customerName,
      total: pedido.total,
      status: pedido.orderStatus,
      paymentMethod: pedido.paymentMethod,
      createdAt: pedido.createdAt,
    };
    await this.publish(EVENT_NAMES.PEDIDO_CREADO, payload);
  }

  async pedidoUpdated(pedido: any): Promise<void> {
    const payload: PedidoActualizadoEvent = {
      id: pedido.id,
      orderNumber: pedido.orderNumber,
      status: pedido.orderStatus,
      paymentStatus: pedido.paymentStatus,
      updatedAt: pedido.updatedAt,
    };
    await this.publish(EVENT_NAMES.PEDIDO_ACTUALIZADO, payload);
  }

  async pedidoStatusChanged(pedidoId: number, oldStatus: string, newStatus: string): Promise<void> {
    const payload: PedidoEstadoCambiadoEvent = {
      pedidoId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.PEDIDO_ESTADO_CAMBIADO, payload);
  }

  // ========== EVENTOS DE COTIZACIONES ==========

  async cotizacionCreated(cotizacion: any): Promise<void> {
    const payload: CotizacionCreadaEvent = {
      id: cotizacion.id,
      customerEmail: cotizacion.customerEmail,
      customerName: cotizacion.customerName,
      status: cotizacion.status,
      total: cotizacion.total,
      createdAt: cotizacion.createdAt,
    };
    await this.publish(EVENT_NAMES.COTIZACION_CREADA, payload);
  }

  async cotizacionUpdated(cotizacion: any): Promise<void> {
    const payload: CotizacionActualizadaEvent = {
      id: cotizacion.id,
      status: cotizacion.status,
      updatedAt: cotizacion.updatedAt,
    };
    await this.publish(EVENT_NAMES.COTIZACION_ACTUALIZADA, payload);
  }

  async cotizacionStatusChanged(cotizacionId: number, oldStatus: string, newStatus: string): Promise<void> {
    const payload: CotizacionEstadoCambiadoEvent = {
      cotizacionId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.COTIZACION_ESTADO_CAMBIADO, payload);
  }

  async cotizacionImageUploaded(imageId: string, quotationId: number): Promise<void> {
    const payload: CotizacionImagenEvent = {
      imageId,
      quotationId,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.COTIZACION_IMAGEN_SUBIDA, payload);
  }

  async cotizacionImageApproved(imageId: string, quotationId: number): Promise<void> {
    const payload: CotizacionImagenEvent = {
      imageId,
      quotationId,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.COTIZACION_IMAGEN_APROBADA, payload);
  }

  async cotizacionImageRejected(imageId: string, quotationId: number): Promise<void> {
    const payload: CotizacionImagenEvent = {
      imageId,
      quotationId,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.COTIZACION_IMAGEN_RECHAZADA, payload);
  }

  // ========== EVENTOS DE PRODUCTOS ==========

  async productoCreated(producto: any): Promise<void> {
    const payload: ProductoCreadoEvent = {
      id: producto.id,
      name: producto.name,
      category: producto.category,
      price: producto.price,
      createdAt: producto.createdAt,
    };
    await this.publish(EVENT_NAMES.PRODUCTO_CREADO, payload);
  }

  async productoUpdated(producto: any): Promise<void> {
    const payload: ProductoActualizadoEvent = {
      id: producto.id,
      name: producto.name,
      category: producto.category,
      price: producto.price,
      updatedAt: producto.updatedAt,
    };
    await this.publish(EVENT_NAMES.PRODUCTO_ACTUALIZADO, payload);
  }

  async productoDeleted(productoId: number): Promise<void> {
    const payload: ProductoEliminadoEvent = {
      id: productoId,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.PRODUCTO_ELIMINADO, payload);
  }

  // ========== EVENTOS DE PAGOS ==========

  async pagoCreated(pago: any): Promise<void> {
    const payload: PagoCreadoEvent = {
      id: pago.id,
      pedidoId: pago.pedidoId,
      amount: pago.amount,
      status: pago.status,
      method: pago.method,
      createdAt: pago.createdAt,
    };
    await this.publish(EVENT_NAMES.PAGO_CREADO, payload);
  }

  async pagoCompleted(pago: any): Promise<void> {
    const payload: PagoCompletadoEvent = {
      id: pago.id,
      pedidoId: pago.pedidoId,
      amount: pago.amount,
      timestamp: new Date(),
    };
    await this.publish(EVENT_NAMES.PAGO_COMPLETADO, payload);
  }

  // ========== EVENTOS DE USUARIOS ==========

  async usuarioCreated(usuario: any): Promise<void> {
    const payload: UsuarioCreadoEvent = {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      createdAt: usuario.createdAt,
    };
    await this.publish(EVENT_NAMES.USUARIO_CREADO, payload);
  }

  async usuarioUpdated(usuario: any): Promise<void> {
    const payload: UsuarioActualizadoEvent = {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      updatedAt: usuario.updatedAt,
    };
    await this.publish(EVENT_NAMES.USUARIO_ACTUALIZADO, payload);
  }
}
