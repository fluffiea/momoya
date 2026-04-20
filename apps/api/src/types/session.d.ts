import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** 与 User.authSessionVersion 对齐，用于单设备登录 */
    authVersion?: number;
  }
}
