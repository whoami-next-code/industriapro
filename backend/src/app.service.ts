import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { UserRole } from './users/user.entity';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly users: UsersService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onApplicationBootstrap() {
    // Seed admin user if it does not exist
    const email = process.env.ADMIN_EMAIL ?? 'admin@industriasp.local';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    const forceReset =
      (process.env.ADMIN_FORCE_PASSWORD_RESET ?? '').toLowerCase() === 'true';
    const desiredRole =
      (process.env.ADMIN_ROLE ?? UserRole.ADMIN) as UserRole;
    const existing = await this.users.findByEmail(email);
    if (!existing) {
      await this.users.create({
        email,
        password,
        role: UserRole.ADMIN,
        fullName: 'Administrador',
        verified: true,
        status: 'VERIFIED' as any,
        active: true,
      });
      this.logger.log(`Usuario admin creado: ${email}`);
    } else {
      const needsVerify = !existing.verified || existing.status !== 'VERIFIED';
      const needsRole =
        existing.role !== UserRole.ADMIN && existing.role !== UserRole.SUPERADMIN;
      if (needsVerify || forceReset || needsRole) {
        await this.users.update(existing.id, {
          password: forceReset ? password : undefined,
          verified: true,
          status: 'VERIFIED' as any,
          active: true,
          role: needsRole ? desiredRole : existing.role,
        } as any);
        this.logger.log(
          `Usuario admin actualizado: ${email} (forceReset=${forceReset})`,
        );
      }
      this.logger.log(`Usuario admin existente: ${email}`);
    }
  }
}
