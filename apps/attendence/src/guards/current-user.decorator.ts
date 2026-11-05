import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface GatewayUser {
  userId: number;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GatewayUser => {
    const request = ctx.switchToHttp().getRequest();
    return {
      userId: Number(request.headers['x-user-id']),
      role: String(request.headers['x-user-role']),
    };
  },
);
