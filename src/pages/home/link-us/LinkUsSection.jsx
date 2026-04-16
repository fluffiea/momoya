import { useState, useRef } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import yayaAvatar from './assets/yaya.jpg';
import momoAvatar from './assets/momo.jpg';
import PartnersStrip from './PartnersStrip';
import CountdownPanel from './CountdownPanel';
import AnniversaryStory from './AnniversaryStory';
import { useAnniversaryClock } from './hooks/useAnniversaryClock';

export default function LinkUsSection() {
  const timers = useRef({});
  const anniversary = useAnniversaryClock();
  const [showAnniversary, setShowAnniversary] = useState(false);
  const [partners, setPartners] = useState([
    {
      name: '江江',
      avatar: yayaAvatar,
      showAvatar: true,
    },
    {
      name: 'heart',
    },
    {
      name: '萌萌',
      avatar: momoAvatar,
      showAvatar: true,
    },
  ]);

  const switchAvatarShow = (index) => {
    setPartners((prev) =>
      prev.map((p, i) => {
        if (index === i) {
          return { ...p, showAvatar: !p.showAvatar };
        }
        return p;
      }),
    );
  };

  const handleAvatarClick = (index) => {
    switchAvatarShow(index);
    clearTimeout(timers.current[index]);
    timers.current[index] = setTimeout(() => {
      switchAvatarShow(index);
      clearTimeout(timers.current[index]);
    }, 1000);
  };

  const toggleAnniversary = () => setShowAnniversary((prev) => !prev);

  return (
    <section className="link-us-shell" aria-labelledby="link-us-heading">
      <h2 id="link-us-heading" className="sr-only">
        我们俩
      </h2>
      <div className="mx-auto w-[92%] max-w-md">
        <Motion.div
          className="link-us-stage px-4 py-6 sm:px-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-4 text-center font-display text-sm font-bold text-brown-title/90 sm:text-base">
            点滴时光，连成我们的故事
          </p>

          <PartnersStrip
            partners={partners}
            onAvatarClick={handleAvatarClick}
            onHeartToggle={toggleAnniversary}
            heartPressed={showAnniversary}
          />

          <div className="mt-6 w-full">
            <AnimatePresence mode="wait" initial={false}>
              {showAnniversary ? (
                <Motion.div
                  key="anniversary"
                  role="region"
                  aria-label="纪念日回忆"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
