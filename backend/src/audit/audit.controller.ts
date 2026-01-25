import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@Query('limit') limit = '100') {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.audit.list({ take });
  }
}
