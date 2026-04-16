import { useId } from 'react';
import cx from 'classnames';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion';

const AVATAR_SIZE = 'h-[68px] w-[68px] sm:h-[72px] sm:w-[72px]';

const flipSpring = { type: 'spring', stiffness: 320, damping: 28, mass: 0.72 };

function PartnerAvatar({ partner, partnerIndex, onAvatarClick }) {
  const reducedMotion = useReducedMotion();

  const shellClass = cx(
    `relative flex shrink-0 ${AVATAR_SIZE} cursor-pointer items-center justify-center overflow-hidden rounded-full`,
    'bg-white shadow-[0_2px_10px_rgb(0_0_0/0.06)] ring-[2.5px] ring-white',
    'outline outline-1 -outline-offset-1 outline-love/18',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-love/50',
  );

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAvatarClick(partnerIndex);
    }
  };

  if (reducedMotion) {
    return (
      <div
        className={shellClass}
        onClick={() => onAvatarClick(partnerIndex)}
        role="button"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label={`${partner.name}，点击切换头像与昵称`}
      >
        <div
          className={cx(
            'relative flex h-full w-full items-center justify-center overflow-hidden rounded-full',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {partner.showAvatar ? (
              <Motion.img
                key="photo"
                src={partner.avatar}
                alt={partner.name}
                className="absolute inset-0 h-full w-full rounded-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            ) : (
              <Motion.span
                key="name"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-rose-50 to-white font-display text-base font-bold text-love/90 sm:text-lg"
              >
                {partner.name}
              </Motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div
      className={shellClass}
      onClick={() => onAvatarClick(partnerIndex)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label={`${partner.name}，点击切换头像与昵称`}
      style={{ perspective: '920px' }}
    >
      <Motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: partner.showAvatar ? 0 : 180 }}
        transition={flipSpring}
        whileTap={{ scale: 0.94 }}
      >
        {/* 正面：照片 */}
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(0.5px) rotateY(0deg)',
          }}
        >
          <img
            src={partner.avatar}
            alt={partner.name}
            className="h-full w-full rounded-full object-cover"
            draggable={false}
          />
        </div>
        {/* 背面：昵称 */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full bg-gradient-to-b from-rose-50 via-white to-rose-50/80"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(0.5px) rotateY(180deg)',
          }}
        >
          <span className="font-display text-base font-bold text-love sm:text-lg">{partner.name}</span>
        </div>
      </Motion.div>
    </div>
  );
}

function HeartToggleButton({ pressed, onToggle, onKeyDown }) {
  const rawId = useId().replace(/:/g, '');
  const gradId = `${rawId}-grad`;
  const gradPressedId = `${rawId}-grad-pressed`;

  return (
    <button
      type="button"
      className={cx(
        'group relative z-10 flex h-12 w-12 shrink-0 cursor-pointer select-none items-center justify-center rounded-full transition-all duration-300 sm:h-[52px] sm:w-[52px]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-love/50',
        pressed
          ? 'scale-[0.98] bg-gradient-to-b from-rose-50 to-white shadow-inner ring-1 ring-love/45'
          : 'bg-white/95 shadow-[0_2px_12px_rgb(249_172_201/0.35),0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-white/90 hover:shadow-[0_4px_18px_rgb(249_172_201/0.42)] hover:ring-love/25',
      )}
      onClick={onToggle}
      aria-pressed={pressed}
      aria-label="切换查看在一起的天数或纪念日回忆"
      onKeyDown={onKeyDown}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-love/12 via-transparent to-love/5 opacity-80" />
      <svg className="relative h-7 w-7 sm:h-[30px] sm:w-[30px]" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="12" y1="4" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="45%" stopColor="#f9acc9" />
            <stop offset="100%" stopColor="#e891ad" />
          </linearGradient>
          <linearGradient id={gradPressedId} x1="12" y1="4" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f9a8c9" />
            <stop offset="100%" stopColor="#d9779a" />
          </linearGradient>
        </defs>
        <path
          fill={pressed ? `url(#${gradPressedId})` : `url(#${gradId})`}
          className="transition-[filter] duration-300"
          style={{
            filter: pressed
              ? 'drop-shadow(0 1px 2px rgb(232 145 173 / 0.45))'
              : 'drop-shadow(0 1px 1px rgb(249 172 201 / 0.35))',
          }}
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </button>
  );
}

export default function PartnersStrip({
  partners,
  onAvatarClick,
  onHeartToggle,
  heartPressed,
}) {
  const left = partners[0];
  const right = partners[2];

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onHeartToggle();
    }
  };

  return (
    <div className="px-1 pt-1">
      <div className="flex items-center justify-center gap-0">
        <PartnerAvatar partner={left} partnerIndex={0} onAvatarClick={onAvatarClick} />

        <div className="mx-1 flex min-h-[2px] min-w-0 flex-1 items-center sm:mx-2">
          <div
            className="h-[2px] w-full rounded-full bg-gradient-to-r from-love/50 via-love/22 to-transparent"
            aria-hidden
          />
        </div>

        <HeartToggleButton pressed={heartPressed} onToggle={onHeartToggle} onKeyDown={handleKey} />

        <div className="mx-1 flex min-h-[2px] min-w-0 flex-1 items-center sm:mx-2">
          <div
            className="h-[2px] w-full rounded-full bg-gradient-to-l from-love/50 via-love/22 to-transparent"
            aria-hidden
          />
        </div>

        <PartnerAvatar partner={right} partnerIndex={2} onAvatarClick={onAvatarClick} />
      </div>
    </div>
  );
}
