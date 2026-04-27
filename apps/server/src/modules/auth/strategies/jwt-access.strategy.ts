import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorKey } from '../../../common/constants/error-keys';
import type { AppConfig } from '../../../config/configuration';
import { UserService } from '../../user/user.service';
import type { AuthUser, JwtPayload } from '../types/jwt-payload';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const jwtCfg = configService.get<AppConfig['jwt']>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg?.accessSecret ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ !== 'access') {
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
