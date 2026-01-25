import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

type StoredValue = { value: string; expiresAt?: number };

@Injectable()
export class RedisService {
  private readonly logger = new Logger('RedisService');
  private readonly client?: Redis;
  private readonly memory = new Map<string, StoredValue>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
      });
      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });
    } else {
      this.logger.warn('REDIS_URL no configurado. Usando memoria local.');
    }
  }

  async get(key: string) {
    if (this.client) {
      return this.client.get(key);
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (this.client) {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memory.set(key, { value, expiresAt });
  }

  async del(key: string) {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.memory.delete(key);
  }

  async sadd(key: string, value: string) {
    if (this.client) {
      await this.client.sadd(key, value);
      return;
    }
    const existing = (await this.get(key)) ?? '';
    const parts = new Set(existing ? existing.split(',') : []);
    parts.add(value);
    await this.set(key, Array.from(parts).join(','));
  }

  async smembers(key: string) {
    if (this.client) {
      return this.client.smembers(key);
    }
    const existing = (await this.get(key)) ?? '';
    return existing ? existing.split(',') : [];
  }

  async srem(key: string, value: string) {
    if (this.client) {
      await this.client.srem(key, value);
      return;
    }
    const existing = (await this.get(key)) ?? '';
    const parts = new Set(existing ? existing.split(',') : []);
    parts.delete(value);
    await this.set(key, Array.from(parts).join(','));
  }

  async status() {
    if (this.client) {
      try {
        const pong = await this.client.ping();
        return { ok: pong === 'PONG', mode: 'redis' };
      } catch (err: any) {
        return { ok: false, mode: 'redis', error: err?.message || String(err) };
      }
    }
    return { ok: true, mode: 'memory' };
  }
}
