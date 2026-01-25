import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog } from './system-log.entity';

@Injectable()
export class SystemLogService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly repo: Repository<SystemLog>,
  ) {}

  info(message: string, context?: Record<string, any>) {
    return this.repo.save(this.repo.create({ level: 'INFO', message, context }));
  }

  warn(message: string, context?: Record<string, any>) {
    return this.repo.save(this.repo.create({ level: 'WARN', message, context }));
  }

  error(message: string, context?: Record<string, any>) {
    return this.repo.save(this.repo.create({ level: 'ERROR', message, context }));
  }
}
