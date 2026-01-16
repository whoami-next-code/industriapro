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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'roles.guard.ts:canActivate',
        message: 'RolesGuard check',
        data: {
          hasUser: !!user,
          role: user?.role,
          rolesRequired: roles,
          url: request?.url,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!user || !user.role) {
      // Dejar pasar para que otros guards (auth) ejecuten y adjunten usuario
      return true;
    }
    const allowed = this.matchRoles(roles, String(user.role));
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'roles.guard.ts:canActivate',
        message: 'RolesGuard result',
        data: { allowed, role: user.role, url: request?.url },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return allowed;
  }

  private matchRoles(roles: string[], userRole: string): boolean {
    return roles.some((role) => role === userRole);
  }
}
