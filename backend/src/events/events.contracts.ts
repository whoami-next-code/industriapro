import { EVENT_NAMES } from './events.constants';

export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];

export interface EventEnvelope<TPayload> {
  /** Nombre del evento (pasado) */
  event: EventName;
  /** Fecha ISO de ocurrencia */
  occurredAt: string;
  /** Datos relevantes del evento */
  data: TPayload;
}

export interface PedidoCreadoEvent {
  id: number;
  orderNumber: string;
  customerEmail?: string;
  customerName?: string;
  total: number;
  status: string;
  paymentMethod?: string;
  createdAt: Date | string;
}

export interface PedidoActualizadoEvent {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  updatedAt: Date | string;
}

export interface PedidoEstadoCambiadoEvent {
  pedidoId: number;
  oldStatus: string;
  newStatus: string;
  timestamp: Date | string;
}

export interface CotizacionCreadaEvent {
  id: number;
  customerEmail?: string;
  customerName?: string;
  status: string;
  total?: number;
  createdAt: Date | string;
}

export interface CotizacionActualizadaEvent {
  id: number;
  status: string;
  updatedAt: Date | string;
}

export interface CotizacionEstadoCambiadoEvent {
  cotizacionId: number;
  oldStatus: string;
  newStatus: string;
  timestamp: Date | string;
}

export interface CotizacionImagenEvent {
  imageId: string;
  quotationId: number;
  timestamp: Date | string;
}

export interface ProductoCreadoEvent {
  id: number;
  name: string;
  category?: string;
  price?: number;
  createdAt: Date | string;
}

export interface ProductoActualizadoEvent {
  id: number;
  name: string;
  category?: string;
  price?: number;
  updatedAt: Date | string;
}

export interface ProductoEliminadoEvent {
  id: number;
  timestamp: Date | string;
}

export interface PagoCreadoEvent {
  id: number;
  pedidoId: number;
  amount: number;
  status: string;
  method?: string;
  createdAt: Date | string;
}

export interface PagoCompletadoEvent {
  id: number;
  pedidoId: number;
  amount: number;
  timestamp: Date | string;
}

export interface UsuarioCreadoEvent {
  id: number;
  email: string;
  role?: string;
  createdAt: Date | string;
}

export interface UsuarioActualizadoEvent {
  id: number;
  email: string;
  role?: string;
  updatedAt: Date | string;
}
