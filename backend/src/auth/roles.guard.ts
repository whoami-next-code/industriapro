import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role) {
      return false;
    }
    const email = String(user.email || '').toLowerCase().trim();
    if (email) {
      const adminEmails = new Set(
        [
          process.env.ADMIN_EMAIL,
          process.env.ADMIN_EMAILS,
        ]
          .filter(Boolean)
          .flatMap((value) =>
            String(value)
              .split(',')
              .map((e) => e.toLowerCase().trim())
              .filter(Boolean),
          ),
      );
      if (adminEmails.has(email)) {
        return true;
      }
    }
    return this.matchRoles(roles, String(user.role));
  }

  private matchRoles(roles: string[], userRole: string): boolean {
    return roles.some((role) => role === userRole);
  }
}
