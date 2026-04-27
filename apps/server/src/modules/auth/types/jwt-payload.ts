export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  /** user id 字符串 */
  sub: string;
  /** session id，与 user.currentSessionId 比对，不一致即 E_SESSION_KICKED */
  sid: string;
  /** token 类型，防止 refresh token 被当作 access 使用 */
  typ: JwtTokenType;
  iat?: number;
  exp?: number;
}

/** Passport strategy validate 返回值，将挂到 req.user */
export interface AuthUser {
  userId: string;
  sessionId: string;
}
