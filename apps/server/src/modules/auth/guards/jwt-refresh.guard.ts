import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorKey } from '../../../common/constants/error-keys';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
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
        message: 'refresh token 已过期，请重新登录',
        errorKey: ErrorKey.E_AUTH_EXPIRED,
      });
    }
    throw new UnauthorizedException({
      message: 'refresh token 无效',
      errorKey: ErrorKey.E_AUTH_INVALID,
    });
  }
}
