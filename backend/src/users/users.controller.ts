import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Logger } from '@nestjs/common';

@Controller('api/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  private readonly logger = new Logger('UsersController');

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(
    @Body()
    body: {
      email: string;
      password: string;
      role?: UserRole;
      fullName?: string;
    },
  ) {
    throw new ForbiddenException(
      'Use el endpoint /auth/admin/create-user para crear cuentas de personal.',
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll(@Query('role') role?: string, @Query('verified') verified?: string) {
    const v =
      typeof verified === 'string' ? /^(1|true)$/i.test(verified) : undefined;
    const r =
      role && role.toUpperCase() in UserRole
        ? (role.toUpperCase() as keyof typeof UserRole)
        : undefined;
    const roleEnum = r ? UserRole[r] : undefined;
    return this.service
      .findAll({ role: roleEnum, verified: v })
      .then((users) => {
        this.logger.log(
          `findAll users=${users.length} role=${roleEnum ?? 'ANY'} verified=${v ?? 'ANY'}`,
        );
        return users;
      });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }

  @Post('cleanup-unverified')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async cleanupUnverified(@Query('days') days: string) {
    const d = days
      ? Number(days)
      : Number(process.env.UNVERIFIED_USER_GRACE_DAYS || 30);
    const count = await this.service.removeUnverifiedOlderThan(d);
    this.logger.log(
      `Limpieza: eliminados ${count} usuarios no verificados más antiguos de ${d} días`,
    );
    return { deleted: count };
  }
}
