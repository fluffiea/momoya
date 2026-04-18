import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HITOKOTO_API,
  HITOKOTO_CATEGORIES,
  HITOKOTO_STORAGE_KEY,
} from './constants';

export function getLocalDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type HitokotoCache = {
  date: string;
  hitokoto: string;
  uuid?: string;
  from?: string;
  from_who?: string;
};

function readCache(): HitokotoCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HITOKOTO_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === 'object' &&
      data !== null &&
      'date' in data &&
      'hitokoto' in data
    ) {
      const o = data as Record<string, unknown>;
      if (
        typeof o.date === 'string' &&
        typeof o.hitokoto === 'string' &&
        o.hitokoto.length > 0
      ) {
        return {
          date: o.date,
          hitokoto: o.hitokoto,
          uuid: typeof o.uuid === 'string' ? o.uuid : undefined,
          from: typeof o.from === 'string' ? o.from : undefined,
          from_who:
            o.from_who != null && String(o.from_who).trim()
              ? String(o.from_who).trim()
              : undefined,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(payload: HitokotoCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HITOKOTO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function buildHitokotoUrl(): string {
  const u = new URL(HITOKOTO_API);
  u.searchParams.set('encode', 'json');
  for (const c of HITOKOTO_CATEGORIES) {
    u.searchParams.append('c', c);
  }
  return u.toString();
}

export async function fetchHitokotoSentence() {
  const res = await fetch(buildHitokotoUrl());
  if (!res.ok) {
    throw new Error(`一言请求失败 (${res.status})`);
  }
  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null) {
    throw new Error('一言返回数据无效');
  }
  const o = data as Record<string, unknown>;
  const text = o.hitokoto;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('一言返回数据无效');
  }
  return {
    hitokoto: text.trim(),
    uuid: typeof o.uuid === 'string' ? o.uuid : undefined,
    from: typeof o.from === 'string' && o.from ? o.from : undefined,
    from_who:
      o.from_who != null && String(o.from_who).trim()
        ? String(o.from_who).trim()
        : undefined,
  };
}

type LoadOptions = {
  force?: boolean;
};

/**
 * 同一天仅使用一次成功结果（localStorage）；失败不写入，可重试。
 */
export function useDailyHitokoto() {
  const [hitokoto, setHitokoto] = useState('');
  const [uuid, setUuid] = useState<string | undefined>(undefined);
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [fromWho, setFromWho] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const load = useCallback(async (options: LoadOptions = {}) => {
    const { force = false } = options;
    const today = getLocalDateKey();
    const cached = readCache();
    if (!force && cached && cached.date === today) {
      setHitokoto(cached.hitokoto);
      setUuid(cached.uuid);
      setFrom(cached.from);
      setFromWho(cached.from_who);
      setError(null);
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHitokotoSentence();
      const payload: HitokotoCache = {
        date: today,
        hitokoto: result.hitokoto,
        uuid: result.uuid,
        from: result.from,
        from_who: result.from_who,
      };
      writeCache(payload);
      setHitokoto(result.hitokoto);
      setUuid(result.uuid);
      setFrom(result.from);
      setFromWho(result.from_who);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setHitokoto('');
      setUuid(undefined);
      setFrom(undefined);
      setFromWho(undefined);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = useCallback(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load({ force: true });
  }, [load]);

  return {
    hitokoto,
    uuid,
    from,
    fromWho,
    loading,
    error,
    retry,
    refresh,
  };
}
