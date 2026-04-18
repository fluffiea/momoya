import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserPublic } from '@momoya/shared';
import { apiFetch, apiPostJson } from '@/lib/api';
import { AuthContext } from './authContext';

async function fetchMe(): Promise<UserPublic | null> {
  const r = await apiFetch<{ user: UserPublic }>('/api/auth/me');
  if (r.ok) return r.data.user;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await apiPostJson<{ user: UserPublic }>('/api/auth/login', {
        username,
        password,
      });
      if (r.ok) {
        setUser(r.data.user);
        return { ok: true as const };
      }
      return { ok: false as const, message: r.error };
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, logout }),
    [user, loading, refresh, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
