import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserPublic } from '@momoya/shared';
import Modal from '@/components/ui/Modal';
import { apiFetch, apiPostJson } from '@/lib/api';
import {
  markSessionReplacedHandled,
  resetSessionReplacedGate,
  SESSION_REPLACED_EVENT,
  subscribeSessionReplacedBroadcast,
} from './sessionReplaced';
import { AuthContext } from './authContext';

const sessionReplacedBackdropClassName =
  'z-[2100] bg-black/30 backdrop-blur-[2px]';

const sessionReplacedContentClassName =
  'rounded-[22px] border border-border-sweet/45 bg-gradient-to-b from-white via-white to-rose-50/80 p-5 shadow-[0_8px_40px_rgb(249_172_201/0.22)] ring-1 ring-love/10';

const sessionReplacedPrimaryBtnClass =
  'w-full rounded-xl border border-rose-200/90 bg-white py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50';

async function fetchMe(): Promise<UserPublic | null> {
  const r = await apiFetch<{ user: UserPublic }>('/api/auth/me');
  if (r.ok) return r.data.user;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const sessionReplacedTitleId = useId();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReplacedOpen, setSessionReplacedOpen] = useState(false);
  const [sessionReplacedMessage, setSessionReplacedMessage] = useState('');

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applySessionReplaced = useCallback((msg: string) => {
    markSessionReplacedHandled();
    setSessionReplacedMessage(msg);
    setSessionReplacedOpen(true);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const onSessionReplaced = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message ?? '';
      applySessionReplaced(msg);
    };
    window.addEventListener(SESSION_REPLACED_EVENT, onSessionReplaced);
    const unsubBroadcast = subscribeSessionReplacedBroadcast((msg) => {
      applySessionReplaced(msg);
    });
    return () => {
      window.removeEventListener(SESSION_REPLACED_EVENT, onSessionReplaced);
      unsubBroadcast();
    };
  }, [applySessionReplaced]);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await apiPostJson<{ user: UserPublic }>('/api/auth/login', {
        username,
        password,
      });
      if (r.ok) {
        resetSessionReplacedGate();
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

  const applyUser = useCallback((next: UserPublic) => {
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, applyUser, login, logout }),
    [user, loading, refresh, applyUser, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      <Modal
        visible={sessionReplacedOpen}
        onClose={() => {}}
        width="min(92%, 20rem)"
        panelScrollable={false}
        closeOnBackdropClick={false}
        ariaLabelledBy={sessionReplacedTitleId}
        backdropClassName={sessionReplacedBackdropClassName}
        contentClassName={sessionReplacedContentClassName}
      >
        <div
          className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50/90 text-lg shadow-inner ring-1 ring-rose-100/80"
          aria-hidden
        >
          💔
        </div>
        <h2
          id={sessionReplacedTitleId}
          className="font-display text-center text-lg font-bold text-brown-title"
        >
          登录已失效
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-neutral-600">
          {sessionReplacedMessage || '账号已在其他设备登录，当前设备已退出。'}
        </p>
        <div className="mt-6">
          <button
            type="button"
            className={sessionReplacedPrimaryBtnClass}
            onClick={() => {
              setSessionReplacedOpen(false);
              navigate('/login', { replace: true });
            }}
          >
            重新登录
          </button>
        </div>
      </Modal>
      {children}
    </AuthContext.Provider>
  );
}
