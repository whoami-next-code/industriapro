/**
 * Configuración de RabbitMQ para Railway y desarrollo local
 * 
 * Railway proporciona variables de entorno automáticamente cuando agregas
 * el servicio RabbitMQ desde el marketplace.
 */
export function getRabbitMQConfig() {
  // Railway puede proporcionar RABBITMQ_URL directamente
  if (process.env.RABBITMQ_URL) {
    return {
      urls: [process.env.RABBITMQ_URL],
    };
  }

  // O variables individuales (Railway también puede usar este formato)
  const host = process.env.RABBITMQ_HOST || 'localhost';
  const port = process.env.RABBITMQ_PORT || 5672;
  const user = process.env.RABBITMQ_USER || 'guest';
  const password = process.env.RABBITMQ_PASSWORD || 'guest';
  const vhost = process.env.RABBITMQ_VHOST || '/';

  // Construir URL de conexión
  const url = `amqp://${user}:${password}@${host}:${port}${vhost}`;

  return {
    urls: [url],
  };
}

export function isRabbitMQConfigured() {
  return Boolean(process.env.RABBITMQ_URL || process.env.RABBITMQ_HOST);
}

/**
 * Configuración completa para NestJS Microservices
 */
export function getRabbitMQServiceConfig() {
  const config = getRabbitMQConfig();

  return {
    transport: 'RMQ' as const,
    options: {
      ...config,
      queue: 'industria_events',
      queueOptions: {
        durable: true, // Las colas sobreviven a reinicios del servidor
      },
      socketOptions: {
        heartbeatIntervalInSeconds: 60,
        reconnectTimeInSeconds: 5,
      },
      // Prefetch: cuántos mensajes sin confirmar puede tener un consumer
      prefetchCount: 10,
    },
  };
}
