import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { BCRYPT_ROUNDS } from '../../common/constants/crypto';
import { ErrorKey } from '../../common/constants/error-keys';
import { parseDurationToSeconds } from '../../common/utils/duration';
import type { AppConfig } from '../../config/configuration';
import { UserService } from '../user/user.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type {
  ChangePasswordResultDto,
  LoginResultDto,
  MeDto,
  TokenPairDto,
} from './dto/token-pair.dto';
import type { JwtPayload, JwtTokenType } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResultDto> {
    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException({
        message: '账号或密码错误',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        message: '账号或密码错误',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const sessionId = uuidv4();
    await this.userService.updateSession(user._id, sessionId);

    const tokens = await this.issueTokenPair(String(user._id), sessionId);
    return {
      ...tokens,
      user: this.userService.toMe(user),
    };
  }

  /** refresh guard 已校验好 token 与 sessionId，直接再签一对 token 即可（session 不变）。 */
  async refresh(userId: string, sessionId: string): Promise<TokenPairDto> {
    return this.issueTokenPair(userId, sessionId);
  }

  async changePassword(
    userId: string,
    _currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResultDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException({
        message: '旧密码不正确',
        errorKey: ErrorKey.E_AUTH_WRONG_OLD_PASSWORD,
      });
    }
    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userService.updatePassword(userId, newHash);

    const newSessionId = uuidv4();
    await this.userService.updateSession(userId, newSessionId);

    const tokens = await this.issueTokenPair(userId, newSessionId);
    return { ok: true, ...tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.userService.updateSession(userId, null);
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        message: '用户不存在',
        errorKey: ErrorKey.E_AUTH_INVALID,
      });
    }
    await this.userService.touchOnline(userId);
    return this.userService.toMe(user);
  }

  private async issueTokenPair(
    userId: string,
    sessionId: string,
  ): Promise<TokenPairDto> {
    const jwtCfg = this.configService.get<AppConfig['jwt']>('jwt');
    if (!jwtCfg) throw new Error('jwt config missing');

    const accessExpiresIn = parseDurationToSeconds(jwtCfg.accessTtl);
    const refreshExpiresIn = parseDurationToSeconds(jwtCfg.refreshTtl);

    const accessToken = await this.signToken(
      { sub: userId, sid: sessionId, typ: 'access' },
      jwtCfg.accessSecret,
      accessExpiresIn,
    );
    const refreshToken = await this.signToken(
      { sub: userId, sid: sessionId, typ: 'refresh' },
      jwtCfg.refreshSecret,
      refreshExpiresIn,
    );
    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  private signToken(
    payload: { sub: string; sid: string; typ: JwtTokenType },
    secret: string,
    expiresIn: number,
  ): Promise<string> {
    return this.jwtService.signAsync(payload satisfies JwtPayload, {
      secret,
      expiresIn,
    });
  }
}
