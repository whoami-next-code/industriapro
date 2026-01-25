import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Query,
  Headers,
  Put,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { UserRole, UserStatus } from '../users/user.entity';
import { Logger } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot.dto';
import { ResetPasswordDto } from './dto/reset.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}
  private readonly logger = new Logger('AuthController');

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.auth.register({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
    });
  }

  @Post('register-custom')
  async registerCustom(@Body() body: RegisterDto) {
    return this.auth.register({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
    });
  }

  @Post('admin/create-user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  async adminCreateUser(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      fullName?: string;
      phone?: string;
      role?: UserRole;
      active?: boolean;
    },
  ) {
    const requesterRole = req.user?.role;
    const targetRole = body.role ?? UserRole.CLIENTE;
    if (
      (targetRole === UserRole.ADMIN || targetRole === UserRole.SUPERADMIN) &&
      requesterRole !== UserRole.SUPERADMIN
    ) {
      throw new ForbiddenException('Solo SUPERADMIN puede crear roles elevados');
    }
    return this.auth.createUserByAdmin(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Req() req: any) {
    return req.user;
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body()
    body: {
      fullName?: string;
      phone?: string;
      preferences?: Record<string, any>;
    },
  ) {
    const email = req.user?.email;
    if (!email) throw new BadRequestException('Usuario inválido');
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.users.update(user.id, {
      fullName: body.fullName ?? user.fullName,
      phone: body.phone ?? user.phone,
    });
  }

  // Recuperación de contraseña
  @Post('forgot-password')
  async forgot(@Body() body: ForgotPasswordDto, @Req() req: any) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('reset-password')
  async reset(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post('change-password-first')
  @UseGuards(JwtAuthGuard)
  async changePasswordFirst(
    @Req() req: any,
    @Body() body: { newPassword: string },
  ) {
    return this.auth.changePasswordFirst(
      req.user?.userId,
      body.newPassword,
    );
  }

  /*
  // Verificación de email - DEPRECATED: Supabase maneja esto
  @Post('send-verification')
  @UseGuards(SupabaseAuthGuard)
  async sendVerification(@Req() req: any) {
    // return this.auth.sendVerification(req.user.userId);
    return { message: 'Use Supabase Auth flow' };
  }
  */

  @Post('verify')
  async verifyPost(@Body('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.auth.resendVerificationByEmail(email);
  }

  @Get('verify')
  async verify(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('check-email')
  async checkEmail(@Body() body: CheckEmailDto) {
    const email = body?.email?.toLowerCase?.().trim?.();
    if (!email) {
      throw new BadRequestException('Email inválido');
    }

    const existing = await this.users.findByEmail(email);
    if (!existing) {
      return { exists: false, verified: false, status: 'PENDING' };
    }
    return {
      exists: existing.verified && existing.status === 'VERIFIED',
      verified: existing.verified,
      status: existing.status,
    };
  }

  @Get('fix-emails')
  async fixEmails() {
    return this.users.fixEmails();
  }

  @Post('register-external')
  async registerExternal(
    @Headers('x-external-secret') secret: string,
    @Body() body: { email: string; fullName?: string },
  ) {
    const expected = process.env.EXTERNAL_REG_SECRET || '';
    if (!expected || secret !== expected) {
      this.logger.warn(
        `register-external unauthorized for email=${body?.email}`,
      );
      return { ok: false, error: 'unauthorized' };
    }

    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      await this.users.update(existing.id, {
        fullName: body.fullName ?? existing.fullName,
      } as any);
      return { ok: true, created: false, id: existing.id };
    }

    const created = await this.users.create({
      email: body.email,
      fullName: body.fullName,
      role: UserRole.CLIENTE,
      verified: false,
      status: UserStatus.PENDING,
      active: true,
    });

    await this.auth.resendVerificationByEmail(created.email);

    return {
      ok: true,
      created: true,
      id: created.id,
      emailSent: true,
    };
  }

  // Desarrollo: endpoint para forzar la creación del usuario admin si no existe
  @Post('dev-seed-admin')
  async devSeedAdmin() {
    // ESTE MÉTODO SOLO DEBE USARSE SI EL USUARIO YA EXISTE EN SUPABASE
    // O SI TENEMOS LA SERVICE ROLE KEY (que no tenemos configurada).
    // Por ahora, solo devolverá instrucciones.
    return {
      message:
        'Cree el usuario admin desde el panel o con la API admin/create-user.',
      action: 'POST /auth/admin/create-user',
    };
  }

  // Desarrollo: restablecer contraseña del admin según ADMIN_PASSWORD
  @Post('dev-reset-admin')
  async devResetAdmin(@Headers('x-admin-reset-secret') secret?: string) {
    const isProd = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    const expected = process.env.ADMIN_RESET_SECRET ?? '';
    if (isProd) {
      if (!expected || secret !== expected) {
        throw new ForbiddenException('No autorizado');
      }
    }

    const email = process.env.ADMIN_EMAIL ?? 'admin@industriasp.local';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    const existing = await this.users.findByEmail(email);
    if (!existing) return { reset: false, error: 'admin_not_found', email };

    await this.users.update(existing.id, {
      password,
      verified: true,
      status: UserStatus.VERIFIED,
      active: true,
      mustChangePassword: false,
    } as any);
    return { reset: true, email };
  }
}
