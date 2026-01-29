import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { AdminGateway } from './admin.gateway';
import { PublicGateway } from './public.gateway';
import { EventsPublisher } from '../events/events.publisher';

/**
 * EventsService - Servicio de eventos para Socket.IO
 * 
 * Este servicio actúa como puente entre:
 * 1. RabbitMQ (eventos internos del backend)
 * 2. Socket.IO (notificaciones en tiempo real a clientes)
 * 
 * Los eventos pueden venir de:
 * - EventsConsumer (después de procesar eventos de RabbitMQ)
 * - Directamente desde servicios que necesitan notificar inmediatamente
 * 
 * IMPORTANTE: Para publicar eventos que deben procesarse asíncronamente
 * (emails, auditoría, etc.), usa EventsPublisher directamente.
 * Este servicio solo notifica vía Socket.IO.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly gateway: AdminGateway,
    @Optional() private readonly publicGateway?: PublicGateway,
    @Optional() @Inject(forwardRef(() => EventsPublisher))
    private readonly eventsPublisher?: EventsPublisher,
  ) {}

  /**
   * Emite un evento vía Socket.IO a todos los clientes conectados
   * Este método NO publica en RabbitMQ, solo notifica vía WebSocket
   */
  emit(event: string, data: any) {
    this.gateway.broadcast(event, data);
    if (this.publicGateway) this.publicGateway.broadcast(event, data);
  }

  /**
   * Notifica actualización de productos vía Socket.IO
   */
  productosUpdated(payload: any) {
    this.emit('productos.updated', payload);
  }

  /**
   * Notifica actualización de pedidos vía Socket.IO
   */
  pedidosUpdated(payload: any) {
    this.emit('pedidos.updated', payload);
  }

  /**
   * Notifica actualización de cotizaciones vía Socket.IO
   */
  cotizacionesUpdated(payload: any) {
    this.emit('cotizaciones.updated', payload);
  }

  /**
   * Notifica actualización de contactos vía Socket.IO
   */
  contactosUpdated(payload: any) {
    this.emit('contactos.updated', payload);
  }
}
