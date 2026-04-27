import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/jwt-payload';

/**
 * 在 @UseGuards(JwtAccessGuard / JwtRefreshGuard) 保护的路由里，
 * 用 @CurrentUser() user: AuthUser 直接拿到登录态。
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return req.user;
  },
);
