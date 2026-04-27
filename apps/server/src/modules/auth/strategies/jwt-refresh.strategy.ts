import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorKey } from '../../../common/constants/error-keys';
import type { AppConfig } from '../../../config/configuration';
import { UserService } from '../../user/user.service';
import type { AuthUser, JwtPayload } from '../types/jwt-payload';

const extractRefreshToken = (req: Request | undefined): string | null => {
  const body = req?.body as { refreshToken?: unknown } | undefined;
  if (body && typeof body.refreshToken === 'string') return body.refreshToken;
  return null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const jwtCfg = configService.get<AppConfig['jwt']>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      ignoreExpiration: false,
      secretOrKey: jwtCfg?.refreshSecret ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException({
        message: 'token 类型不匹配',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    if (!user.currentSessionId || user.currentSessionId !== payload.sid) {
      throw new UnauthorizedException({
        message: '会话已在其他设备登录',
        errorKey: ErrorKey.E_SESSION_KICKED,
      });
    }
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
