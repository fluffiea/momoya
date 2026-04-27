import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorKey } from '../../../common/constants/error-keys';

/**
 * 基于 access token 的登录态守卫。
 * 认证失败时统一抛带 errorKey 的 401，前端据 errorKey 决定是自动 refresh 还是踢回 login。
 */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (err) throw err;
    if (user) return user;

    const infoName =
      info && typeof info === 'object' && 'name' in info
        ? String((info as { name?: unknown }).name)
        : '';
    if (infoName === 'TokenExpiredError') {
      throw new UnauthorizedException({
        message: 'access token 已过期',
        errorKey: ErrorKey.E_AUTH_EXPIRED,
      });
    }
    throw new UnauthorizedException({
      message: '未登录或 token 无效',
      errorKey: ErrorKey.E_AUTH_REQUIRED,
    });
  }
}
