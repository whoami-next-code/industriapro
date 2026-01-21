# Arquitectura Event-Driven (EDA) - IndustriaSP

## Qué es un evento en este sistema
Un evento de negocio representa algo **que ya ocurrió** y es relevante para otros módulos.
Ejemplos: `pedido.creado`, `pago.completado`, `cotizacion.estado_cambiado`.

Reglas:
- Nombre en pasado.
- Un evento = un hecho de negocio.
- Payload limpio, solo datos relevantes para consumidores.

## Contratos de eventos
Los contratos tipados se encuentran en `src/events/events.contracts.ts`.
Cada evento define el payload esperado y sus campos.

## Mensajería RabbitMQ
Se usa un **exchange tipo topic** para enrutar eventos por dominio:

- Exchange: `industria.events` (topic)
- Queue core: `industria.events.core` (procesamiento interno: emails, auditoría, sockets)
- DLX: `industria.events.dlx`
- DLQ: `industria.events.dlq`

Bindings:
- `industria.events.core` ← `#` (recibe todos los eventos)

Justificación:
- Un punto central de procesamiento desacoplado (email, auditoría, sockets).
- Permite agregar nuevas colas por dominio sin cambiar productores.

## Flujo de eventos (resumen)
1. Un caso de uso guarda en DB.
2. Publica evento en `industria.events`.
3. Consumer procesa (email/auditoría/realtime) y confirma mensaje.
4. Si falla, reintenta hasta `MAX_RETRIES` y luego envía a DLQ.

## Frontend integrado a la EDA
El frontend dispara acciones vía API.
El backend publica eventos y notifica cambios por WebSockets (`EventsService`).
El frontend consume cambios vía API/Socket.IO, no accede directamente a DB.
