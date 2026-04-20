import { useEffect, useRef, useState } from 'react';
import { resolveApiUrl } from './api';

export type ConnectivityBannerState = 'hidden' | 'offline';

function browserOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

function abortAfter(ms: number): AbortSignal {
  const AT = AbortSignal as typeof AbortSignal & {
    timeout?: (milliseconds: number) => AbortSignal;
  };
  if (typeof AT.timeout === 'function') {
    return AT.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function probeHealth(): Promise<boolean> {
  try {
    const res = await fetch(resolveApiUrl('/api/health'), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: abortAfter(4500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 断网提示：
 * - offline 事件：立刻显示
 * - online 事件：立刻隐藏，并设宽限期（避免随后 reconcile 因 navigator 仍 false / 探活偶发失败再次拉起条栏）
 * - 轮询 reconcile：navigator 与 /api/health 兜底，解决「长期误判离线」
 */
export function useConnectivityBanner(): ConnectivityBannerState {
  const [state, setState] = useState<ConnectivityBannerState>(() =>
    browserOnline() ? 'hidden' : 'offline',
  );

  const graceAfterOnlineUntilRef = useRef(0);

  useEffect(() => {
    const reconcile = async () => {
      const now = Date.now();
      if (now < graceAfterOnlineUntilRef.current) {
        setState('hidden');
        return;
      }

      if (browserOnline()) {
        setState('hidden');
        return;
      }

      const ok = await probeHealth();
      if (ok) {
        setState('hidden');
        return;
      }

      if (now < graceAfterOnlineUntilRef.current) {
        setState('hidden');
        return;
      }

      setState('offline');
    };

    const onOnline = () => {
      graceAfterOnlineUntilRef.current = Date.now() + 8000;
      setState('hidden');
    };

    const onOffline = () => {
      graceAfterOnlineUntilRef.current = 0;
      setState('offline');
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void reconcile();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);

    void reconcile();

    const intervalMs = 7000;
    const id = window.setInterval(() => void reconcile(), intervalMs);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
    };
  }, []);

  return state;
}
