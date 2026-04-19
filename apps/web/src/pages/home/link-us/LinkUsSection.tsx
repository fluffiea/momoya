import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import type { HomePartnersResponse } from '@momoya/shared';
import yayaAvatar from './assets/yaya.jpg';
import momoAvatar from './assets/momo.jpg';
import PartnersStrip, { type PartnersTriple } from './PartnersStrip';
import CountdownPanel from './CountdownPanel';
import AnniversaryStory from './AnniversaryStory';
import { useAnniversaryClock } from './hooks/useAnniversaryClock';
import { resolveApiUrl } from '@/lib/api';

function defaultPartnersTriple(): PartnersTriple {
  return [
    {
      name: '江江',
      avatar: yayaAvatar,
      defaultAvatar: yayaAvatar,
      showAvatar: true,
    },
    { name: 'heart' },
    {
      name: '萌萌',
      avatar: momoAvatar,
      defaultAvatar: momoAvatar,
      showAvatar: true,
    },
  ];
}

function partnersFromResponse(data: HomePartnersResponse): PartnersTriple {
  const [j, m] = data.partners;
  const leftAvatar = j.avatarUrl.trim() ? resolveApiUrl(j.avatarUrl) : yayaAvatar;
  const rightAvatar = m.avatarUrl.trim() ? resolveApiUrl(m.avatarUrl) : momoAvatar;
  return [
    {
      name: j.displayName,
      avatar: leftAvatar,
      defaultAvatar: yayaAvatar,
      showAvatar: true,
    },
    { name: 'heart' },
    {
      name: m.displayName,
      avatar: rightAvatar,
      defaultAvatar: momoAvatar,
      showAvatar: true,
    },
  ];
}

export default function LinkUsSection() {
  const { pathname } = useLocation();
  const anniversary = useAnniversaryClock();
  const [showAnniversary, setShowAnniversary] = useState(false);
  const [partners, setPartners] = useState<PartnersTriple>(defaultPartnersTriple);

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/home/partners'));
      if (!res.ok) return;
      const data = (await res.json()) as HomePartnersResponse;
      if (!Array.isArray(data.partners) || data.partners.length !== 2) return;
      setPartners(partnersFromResponse(data));
    } catch {
      /* 保持默认 yaya / momo */
    }
  }, []);

  useEffect(() => {
    if (pathname !== '/') return;
    void loadPartners();
  }, [pathname, loadPartners]);

  const switchAvatarShow = (index: number) => {
    setPartners((prev) => {
      if (index !== 0 && index !== 2) return prev;
      const p = prev[index];
      if (!('avatar' in p)) return prev;
      const updated: (typeof prev)[0] = { ...p, showAvatar: !p.showAvatar };
      return index === 0
        ? ([updated, prev[1], prev[2]] as const satisfies PartnersTriple)
        : ([prev[0], prev[1], updated] as const satisfies PartnersTriple);
    });
  };

  const toggleAnniversary = () => setShowAnniversary((prev) => !prev);

  return (
    <section className="link-us-shell" aria-labelledby="link-us-heading">
      <h2 id="link-us-heading" className="sr-only">
        我们俩
      </h2>
      <div className="mx-auto w-[92%] max-w-md">
        <Motion.div
          className="link-us-stage px-4 py-4 sm:px-6 sm:py-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <p className="mb-2.5 text-center font-display text-sm font-bold text-brown-title/90 sm:text-base">
            点滴时光，连成我们的故事
          </p>

          <PartnersStrip
            partners={partners}
            onAvatarClick={switchAvatarShow}
            onHeartToggle={toggleAnniversary}
            heartPressed={showAnniversary}
          />

          <div className="mt-4 w-full">
            <AnimatePresence mode="wait" initial={false}>
              {showAnniversary ? (
                <Motion.div
                  key="anniversary"
                  role="region"
                  aria-label="纪念日回忆"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
                  className="flex w-full flex-col"
                >
                  <AnniversaryStory />
                </Motion.div>
              ) : (
                <Motion.div
                  key="countdown"
                  role="region"
                  aria-label="在一起的天数与时分秒"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
                  className="flex w-full flex-col items-stretch"
                >
                  <CountdownPanel anniversary={anniversary} />
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </Motion.div>
      </div>
    </section>
  );
}
