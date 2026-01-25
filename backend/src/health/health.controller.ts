import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../events/rabbitmq.service';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly rabbit: RabbitMQService,
  ) {}

  @Get()
  async health() {
    const redis = await this.redis.status();
    const rabbit = { ok: this.rabbit.isReady() };
    return { ok: true, redis, rabbit };
  }

  @Get('redis')
  async redisStatus() {
    return this.redis.status();
  }

  @Get('rabbit')
  rabbitStatus() {
    return { ok: this.rabbit.isReady() };
  }
}
