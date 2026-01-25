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
    const primaryEmail = process.env.ADMIN_EMAIL ?? 'admin@industriasp.local';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';
    const forceReset =
      (process.env.ADMIN_FORCE_PASSWORD_RESET ?? '').toLowerCase() === 'true';
    const desiredRole =
      (process.env.ADMIN_ROLE ?? UserRole.ADMIN) as UserRole;
    const adminEmails = Array.from(
      new Set(
        [primaryEmail, process.env.ADMIN_EMAILS]
          .filter(Boolean)
          .flatMap((value) =>
            String(value)
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean),
          ),
      ),
    );

    const existingPrimary = await this.users.findByEmail(primaryEmail);
    if (!existingPrimary) {
      await this.users.create({
        email: primaryEmail,
        password,
        role: UserRole.ADMIN,
        fullName: 'Administrador',
        verified: true,
        status: 'VERIFIED' as any,
        active: true,
      });
      this.logger.log(`Usuario admin creado: ${primaryEmail}`);
    } else {
      const needsVerify =
        !existingPrimary.verified || existingPrimary.status !== 'VERIFIED';
      const needsRole =
        existingPrimary.role !== UserRole.ADMIN &&
        existingPrimary.role !== UserRole.SUPERADMIN;
      if (needsVerify || forceReset || needsRole) {
        await this.users.update(existingPrimary.id, {
          password: forceReset ? password : undefined,
          verified: true,
          status: 'VERIFIED' as any,
          active: true,
          role: needsRole ? desiredRole : existingPrimary.role,
        } as any);
        this.logger.log(
          `Usuario admin actualizado: ${primaryEmail} (forceReset=${forceReset})`,
        );
      }
      this.logger.log(`Usuario admin existente: ${primaryEmail}`);
    }

    // Promover emails adicionales a admin/superadmin si existen
    for (const email of adminEmails) {
      if (email === primaryEmail) continue;
      const user = await this.users.findByEmail(email);
      if (!user) {
        this.logger.warn(`ADMIN_EMAILS no existe en DB: ${email}`);
        continue;
      }
      const needsRole =
        user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN;
      const needsVerify = !user.verified || user.status !== 'VERIFIED';
      if (needsRole || needsVerify) {
        await this.users.update(user.id, {
          verified: true,
          status: 'VERIFIED' as any,
          active: true,
          role: desiredRole,
        } as any);
        this.logger.log(`Usuario admin promovido: ${email}`);
      }
    }
  }
}
