export const EVENTS_EXCHANGE = 'industria.events';
export const EVENTS_EXCHANGE_TYPE = 'topic' as const;

export const EVENTS_DLX_EXCHANGE = 'industria.events.dlx';
export const EVENTS_DLX_ROUTING_KEY = 'dead';

export const EVENTS_CORE_QUEUE = 'industria.events.core';
export const EVENTS_DLQ_QUEUE = 'industria.events.dlq';

export const EVENTS_BINDINGS = [
  { queue: EVENTS_CORE_QUEUE, pattern: '#' },
];

export const EVENT_NAMES = {
  PEDIDO_CREADO: 'pedido.creado',
  PEDIDO_ACTUALIZADO: 'pedido.actualizado',
  PEDIDO_ESTADO_CAMBIADO: 'pedido.estado_cambiado',
  COTIZACION_CREADA: 'cotizacion.creada',
  COTIZACION_ACTUALIZADA: 'cotizacion.actualizada',
  COTIZACION_ESTADO_CAMBIADO: 'cotizacion.estado_cambiado',
  COTIZACION_IMAGEN_SUBIDA: 'cotizacion.imagen_subida',
  COTIZACION_IMAGEN_APROBADA: 'cotizacion.imagen_aprobada',
  COTIZACION_IMAGEN_RECHAZADA: 'cotizacion.imagen_rechazada',
  PRODUCTO_CREADO: 'producto.creado',
  PRODUCTO_ACTUALIZADO: 'producto.actualizado',
  PRODUCTO_ELIMINADO: 'producto.eliminado',
  PAGO_CREADO: 'pago.creado',
  PAGO_COMPLETADO: 'pago.completado',
  USUARIO_CREADO: 'usuario.creado',
  USUARIO_ACTUALIZADO: 'usuario.actualizado',
} as const;
