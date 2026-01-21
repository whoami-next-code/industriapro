# Arquitectura Event-Driven con RabbitMQ

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Componentes Principales](#componentes-principales)
4. [Flujo de Eventos](#flujo-de-eventos)
5. [Configuración para Railway](#configuración-para-railway)
6. [Eventos Disponibles](#eventos-disponibles)
7. [Integración con Flutter](#integración-con-flutter)
8. [Troubleshooting](#troubleshooting)

---

## Introducción

Este proyecto implementa una **Arquitectura Event-Driven** usando **RabbitMQ** como broker de mensajes. Esta arquitectura permite:

- ✅ **Desacoplamiento** entre servicios
- ✅ **Procesamiento asíncrono** de tareas (emails, auditoría, etc.)
- ✅ **Escalabilidad** horizontal
- ✅ **Confiabilidad** con garantías de entrega de mensajes
- ✅ **Integración** con Socket.IO para notificaciones en tiempo real

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTES                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Frontend │  │  Admin   │  │  Flutter │                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                │
└───────┼─────────────┼──────────────┼───────────────────────┘
        │             │              │
        │  HTTP/REST  │  HTTP/REST   │  HTTP/REST
        │             │              │
┌───────▼─────────────────────────────────────────────────────┐
│              BACKEND NESTJS                                  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Productos  │  │   Pedidos    │  │ Cotizaciones │   │
│  │   Service   │  │   Service    │  │   Service    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │            │
│         └─────────────────┼──────────────────┘            │
│                           │                                │
│                  ┌────────▼─────────┐                      │
│                  │ EventsPublisher  │                      │
│                  │  (Publica eventos)                     │
│                  └────────┬─────────┘                      │
└──────────────────────────┼────────────────────────────────┘
                            │
                            │ AMQP (RabbitMQ)
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    RABBITMQ BROKER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Exchanges  │  │    Queues    │  │   Messages   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└───────────────────────────┬────────────────────────────────┘
                            │
                            │ Subscribe
                            │
┌───────────────────────────▼────────────────────────────────┐
│              BACKEND NESTJS (Consumers)                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           EventsConsumer                             │ │
│  │  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ MailHandler  │  │ AuditHandler │                │ │
│  │  └──────────────┘  └──────────────┘                │ │
│  └──────────────────────────────────────────────────────┘ │
│                           │                                 │
│                  ┌────────▼─────────┐                       │
│                  │  EventsService   │                       │
│                  │  (Socket.IO)     │                       │
│                  └────────┬─────────┘                       │
└───────────────────────────┼────────────────────────────────┘
                            │
                            │ WebSocket
                            │
┌───────────────────────────▼────────────────────────────────┐
│                    CLIENTES CONECTADOS                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Frontend │  │  Admin   │  │  Flutter │                │
│  └──────────┘  └──────────┘  └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Componentes Principales

### 1. EventsPublisher (`backend/src/events/events.publisher.ts`)

**Responsabilidad**: Publicar eventos en RabbitMQ

**Uso**:
```typescript
// En cualquier servicio
constructor(
  private readonly eventsPublisher: EventsPublisher,
) {}

async create(data: any) {
  const saved = await this.repo.save(data);
  
  // Publicar evento
  await this.eventsPublisher.pedidoCreated(saved);
  
  return saved;
}
```

### 2. EventsConsumer (`backend/src/events/events.consumer.ts`)

**Responsabilidad**: Procesar eventos de RabbitMQ

**Funciones**:
- Escucha eventos de RabbitMQ
- Procesa tareas asíncronas (emails, auditoría)
- Notifica vía Socket.IO usando EventsService

### 3. EventsService (`backend/src/realtime/events.service.ts`)

**Responsabilidad**: Notificar vía Socket.IO a clientes conectados

**Diferencia con EventsPublisher**:
- `EventsPublisher`: Publica en RabbitMQ para procesamiento asíncrono
- `EventsService`: Notifica directamente vía Socket.IO (tiempo real)

### 4. RabbitMQ Config (`backend/src/events/rabbitmq.config.ts`)

**Responsabilidad**: Configuración de conexión a RabbitMQ

**Soporta**:
- Railway (variables automáticas)
- Desarrollo local
- Variables de entorno individuales

---

## Flujo de Eventos

### Ejemplo: Crear un Pedido

1. **Cliente** → HTTP POST `/api/pedidos`
2. **PedidosService.create()** → Guarda en BD
3. **EventsPublisher.pedidoCreated()** → Publica en RabbitMQ
4. **RabbitMQ** → Distribuye a consumers
5. **EventsConsumer.handlePedidoCreated()**:
   - Envía email de confirmación
   - Registra en auditoría
   - Llama a `EventsService.pedidosUpdated()`
6. **EventsService** → Notifica vía Socket.IO
7. **Clientes conectados** → Reciben actualización en tiempo real

### Ventajas

- ✅ El servicio de pedidos no espera el envío de email
- ✅ Si falla el email, el pedido ya está guardado
- ✅ Múltiples consumers pueden procesar el mismo evento
- ✅ Los clientes reciben notificaciones en tiempo real

---

## Configuración para Railway

### Paso 1: Agregar RabbitMQ en Railway

1. Ve a tu proyecto en Railway
2. Click en **"New"** → **"Service"**
3. Selecciona **"RabbitMQ"** del marketplace
4. Railway generará automáticamente las variables de entorno

### Paso 2: Variables de Entorno

Railway proporciona automáticamente:

```bash
RABBITMQ_URL=amqp://user:password@host:port/vhost
```

O variables individuales:
```bash
RABBITMQ_HOST=...
RABBITMQ_PORT=5672
RABBITMQ_USER=...
RABBITMQ_PASSWORD=...
RABBITMQ_VHOST=/
```

### Paso 3: Conectar Backend

El backend se conecta automáticamente al iniciar si detecta estas variables.

**Verificación**:
```bash
# En los logs del backend deberías ver:
✅ RabbitMQ Microservice conectado
```

### Paso 4: Verificar Funcionamiento

1. Crea un pedido desde la app
2. Revisa los logs del backend
3. Deberías ver: `Evento publicado: pedido.created`
4. El consumer debería procesar: `Pedido creado: ORD-...`

---

## Eventos Disponibles

### Pedidos

| Evento | Cuándo se dispara | Qué hace el Consumer |
|--------|-------------------|----------------------|
| `pedido.created` | Al crear un pedido | Envía email, registra auditoría, notifica vía Socket.IO |
| `pedido.updated` | Al actualizar un pedido | Notifica vía Socket.IO |
| `pedido.status_changed` | Al cambiar estado | Notifica cambio de estado |

### Cotizaciones

| Evento | Cuándo se dispara | Qué hace el Consumer |
|--------|-------------------|----------------------|
| `cotizacion.created` | Al crear cotización | Envía email de confirmación, notifica vía Socket.IO |
| `cotizacion.updated` | Al actualizar cotización | Notifica vía Socket.IO |
| `cotizacion.status_changed` | Al cambiar estado | Notifica cambio de estado |
| `quotation.image_uploaded` | Al subir imagen | Notifica a administradores |
| `quotation.image_approved` | Al aprobar imagen | Notifica aprobación |
| `quotation.image_rejected` | Al rechazar imagen | Notifica rechazo |

### Productos

| Evento | Cuándo se dispara | Qué hace el Consumer |
|--------|-------------------|----------------------|
| `producto.created` | Al crear producto | Notifica vía Socket.IO |
| `producto.updated` | Al actualizar producto | Notifica vía Socket.IO |
| `producto.deleted` | Al eliminar producto | Notifica vía Socket.IO |

### Pagos

| Evento | Cuándo se dispara | Qué hace el Consumer |
|--------|-------------------|----------------------|
| `pago.created` | Al crear pago | Registra en auditoría |
| `pago.completed` | Al completar pago | Envía email de confirmación |

### Usuarios

| Evento | Cuándo se dispara | Qué hace el Consumer |
|--------|-------------------|----------------------|
| `usuario.created` | Al crear usuario | Envía email de bienvenida |
| `usuario.updated` | Al actualizar usuario | Registra en auditoría |

---

## Integración con Flutter

### ✅ No se requieren cambios en Flutter

La app Flutter **NO** se conecta directamente a RabbitMQ. El flujo es:

1. **Flutter** → HTTP POST al backend
2. **Backend** → Publica evento en RabbitMQ
3. **RabbitMQ Consumer** → Procesa evento
4. **EventsService** → Notifica vía Socket.IO
5. **Flutter** → Recibe notificación vía Socket.IO (ya implementado)

### Código Flutter (sin cambios)

```dart
// mobile_app/lib/core/network/socket_service.dart
// Ya está implementado y funcionando

socket.listen('pedidos.updated', (data) {
  // Actualizar UI
  ref.invalidate(pedidosProvider);
});
```

---

## Troubleshooting

### Problema: RabbitMQ no se conecta

**Solución**:
1. Verifica variables de entorno en Railway
2. Revisa logs del backend al iniciar
3. Si no hay RabbitMQ configurado, el sistema funciona solo con Socket.IO

### Problema: Eventos no se procesan

**Solución**:
1. Verifica que el microservice esté conectado:
   ```
   ✅ RabbitMQ Microservice conectado
   ```
2. Revisa logs del consumer:
   ```
   EventsConsumer iniciado - Escuchando eventos de RabbitMQ
   ```
3. Verifica que los eventos se publiquen:
   ```
   Evento publicado: pedido.created
   ```

### Problema: Emails no se envían

**Solución**:
1. Los emails se envían de forma asíncrona desde el consumer
2. Revisa logs del MailService
3. Verifica configuración de Resend/SMTP

### Problema: Socket.IO no notifica

**Solución**:
1. Verifica que el cliente esté conectado
2. Revisa que `EventsService` se llame desde el consumer
3. Los eventos de Socket.IO son independientes de RabbitMQ

---

## Desarrollo Local

### Instalar RabbitMQ

```bash
# Docker
docker run -d -p 5672:5672 -p 15672:15672 \
  --name rabbitmq \
  rabbitmq:management

# Acceder a Management UI
# http://localhost:15672
# Usuario: guest / Contraseña: guest
```

### Variables de Entorno

```bash
# .env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/
```

### Verificar Conexión

```bash
# Iniciar backend
npm run start:dev

# Deberías ver:
✅ RabbitMQ Microservice conectado
```

---

## Mejores Prácticas

1. **Siempre usa try-catch** al publicar eventos
2. **No bloquees** operaciones críticas esperando eventos
3. **Usa EventsPublisher** para tareas asíncronas (emails, auditoría)
4. **Usa EventsService** para notificaciones inmediatas vía Socket.IO
5. **Maneja errores** en consumers sin bloquear el procesamiento

---

## Próximos Pasos

- [ ] Implementar Dead Letter Queue para mensajes fallidos
- [ ] Agregar métricas y monitoreo
- [ ] Implementar retry automático
- [ ] Agregar más eventos según necesidad

---

## Referencias

- [NestJS Microservices](https://docs.nestjs.com/microservices/rabbitmq)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Railway RabbitMQ](https://docs.railway.app/guides/rabbitmq)
