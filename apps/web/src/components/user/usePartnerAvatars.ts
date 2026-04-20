import { useCallback, useEffect, useState } from 'react';
import type { HomePartnersResponse } from '@momoya/shared';
import { apiFetch } from '@/lib/api';

/**
 * 拉取恋区两位伴侣的头像 URL，并与当前登录用户头像合并成 username → avatarUrl。
 * 与 {@link UserAvatar} 同属 `components/user`，由 barrel `index.ts` 统一对外导出。
 */
export function usePartnerAvatars(me: string | undefined, myAvatarUrl: string | undefined) {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await apiFetch<HomePartnersResponse>('/api/home/partners');
      if (cancelled || !r.ok) return;
      const m = new Map(
        r.data.partners.filter((p) => p.avatarUrl).map((p) => [p.username, p.avatarUrl]),
      );
      setMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useCallback(
    (username: string) => (username === me ? myAvatarUrl : map.get(username)) || undefined,
    [me, myAvatarUrl, map],
  );
}
