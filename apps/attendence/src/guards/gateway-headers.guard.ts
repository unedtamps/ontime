import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@repo/types';

export const ROLES_KEY = 'required_roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class GatewayHeadersGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];
    const role = request.headers['x-user-role'];
    if (!userId || !role) {
      throw new UnauthorizedException('Request did not come through the gateway');
    }
    const required = this.reflector.get<UserRole[] | undefined>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (required && !required.includes(role as UserRole)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
