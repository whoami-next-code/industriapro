import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import { getRabbitMQConfig, isRabbitMQConfigured } from './rabbitmq.config';
import {
  EVENTS_BINDINGS,
  EVENTS_CORE_QUEUE,
  EVENTS_DLQ_QUEUE,
  EVENTS_DLX_EXCHANGE,
  EVENTS_DLX_ROUTING_KEY,
  EVENTS_EXCHANGE,
  EVENTS_EXCHANGE_TYPE,
} from './events.constants';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  onModuleInit() {
    if (!isRabbitMQConfigured()) {
      this.logger.warn('RabbitMQ no configurado - eventos asíncronos deshabilitados');
      return;
    }

    const config = getRabbitMQConfig();
    this.connection = connect(config.urls);

    this.connection.on('connect', () => {
      this.logger.log('RabbitMQ conectado');
    });
    this.connection.on('disconnect', (err) => {
      this.logger.error('RabbitMQ desconectado', err);
    });

    this.channel = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(EVENTS_EXCHANGE, EVENTS_EXCHANGE_TYPE, { durable: true });
        await channel.assertExchange(EVENTS_DLX_EXCHANGE, 'direct', { durable: true });

        await channel.assertQueue(EVENTS_DLQ_QUEUE, { durable: true });
        await channel.bindQueue(EVENTS_DLQ_QUEUE, EVENTS_DLX_EXCHANGE, EVENTS_DLX_ROUTING_KEY);

        await channel.assertQueue(EVENTS_CORE_QUEUE, {
          durable: true,
          deadLetterExchange: EVENTS_DLX_EXCHANGE,
          deadLetterRoutingKey: EVENTS_DLX_ROUTING_KEY,
        });

        for (const binding of EVENTS_BINDINGS) {
          await channel.bindQueue(binding.queue, EVENTS_EXCHANGE, binding.pattern);
        }
      },
    });
  }

  onModuleDestroy() {
    this.channel?.close().catch(() => undefined);
    this.connection?.close().catch(() => undefined);
  }

  isReady() {
    return Boolean(this.channel);
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: Options.Publish,
  ) {
    if (!this.channel) return;
    await this.channel.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
      ...options,
    });
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage, channel: ConfirmChannel) => Promise<void>,
  ) {
    if (!this.channel) return;
    await this.channel.addSetup(async (channel: ConfirmChannel) => {
      if (queue === EVENTS_CORE_QUEUE) {
        await channel.assertExchange(EVENTS_EXCHANGE, EVENTS_EXCHANGE_TYPE, { durable: true });
        await channel.assertExchange(EVENTS_DLX_EXCHANGE, 'direct', { durable: true });
        await channel.assertQueue(EVENTS_DLQ_QUEUE, { durable: true });
        await channel.bindQueue(EVENTS_DLQ_QUEUE, EVENTS_DLX_EXCHANGE, EVENTS_DLX_ROUTING_KEY);
        await channel.assertQueue(EVENTS_CORE_QUEUE, {
          durable: true,
          deadLetterExchange: EVENTS_DLX_EXCHANGE,
          deadLetterRoutingKey: EVENTS_DLX_ROUTING_KEY,
        });
        for (const binding of EVENTS_BINDINGS) {
          await channel.bindQueue(binding.queue, EVENTS_EXCHANGE, binding.pattern);
        }
      } else {
        await channel.assertQueue(queue, { durable: true });
      }
      await channel.consume(queue, async (message: ConsumeMessage | null) => {
        if (!message) return;
        try {
          await handler(message, channel);
        } catch (error) {
          this.logger.error(`Error procesando mensaje en ${queue}`, error);
        }
      });
    });
  }
}
