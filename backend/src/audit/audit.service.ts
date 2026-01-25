import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async log(action: string, userId?: number, meta?: Record<string, any>) {
    const entity = this.repo.create({ action, userId, meta });
    await this.repo.save(entity);
  }

  list(params: { take: number }) {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: params.take });
  }
}
