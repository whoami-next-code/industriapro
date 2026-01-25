import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisModule } from '../redis/redis.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RedisModule, EventsModule],
  controllers: [HealthController],
})
export class HealthModule {}
