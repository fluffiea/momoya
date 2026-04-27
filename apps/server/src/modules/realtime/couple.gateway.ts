import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { makeCoupleKey } from '../../common/couple-key';
import type { AppConfig } from '../../config/configuration';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { UserService } from '../user/user.service';
import { CoupleRealtimeService } from './couple-realtime.service';

/**
 * 情侣实时网关。
 * 客户端必须先用合法 access token 完成 handshake（通过 `auth.token` 传，禁用 query），
 * 校验通过后双方都被放进同一个 `couple:<coupleKey>` 房间，
 * 业务侧通过 CoupleRealtimeService 向房间广播事件。
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  // 小程序 WebSocket 对压缩帧兼容性不稳定，实时通道 payload 小，直接禁用更省心。
  perMessageDeflate: false,
})
export class CoupleGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(CoupleGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly coupleRealtime: CoupleRealtimeService,
  ) {}

  afterInit(): void {
    this.coupleRealtime.attachServer(this.server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = extractAccessToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    const secret = this.config.get<AppConfig['jwt']>('jwt')!.accessSecret;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      if (payload.typ !== 'access') {
        client.disconnect(true);
        return;
      }
      const user = await this.userService.findById(payload.sub);
      if (!user?.currentSessionId || user.currentSessionId !== payload.sid) {
        client.disconnect(true);
        return;
      }
      if (!user.partnerId) {
        client.disconnect(true);
        return;
      }
      const coupleKey = makeCoupleKey(String(user._id), String(user.partnerId));
      await client.join(`couple:${coupleKey}`);
    } catch {
      // 不向日志写入 err 全文，避免依赖库在异常中带敏感片段；亦不记录 token。
      this.logger.verbose(
        'WS handshake rejected (JWT / session / partner check)',
      );
      client.disconnect(true);
    }
  }
}

/**
 * 仅允许 Engine.IO handshake 的 `auth.token`，禁止 query 传 token：
 * query 会进代理/网关访问日志与浏览器 Referer，易造成 access token 泄露。
 */
function extractAccessToken(client: Socket): string | null {
  const fromAuth = client.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
  return null;
}
