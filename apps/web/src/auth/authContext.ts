import { createContext } from 'react';
import type { UserPublic } from '@momoya/shared';

export type AuthContextValue = {
  user: UserPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /**
   * 直接用给定 user 覆盖当前 auth 状态；用于已从某个 PATCH 接口拿到最新 user 的场景，
   * 避免再发一次 GET /auth/me 的往返。
   */
  applyUser: (user: UserPublic) => void;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
