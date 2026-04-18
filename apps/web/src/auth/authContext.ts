import { createContext } from 'react';
import type { UserPublic } from '@momoya/shared';

export type AuthContextValue = {
  user: UserPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
