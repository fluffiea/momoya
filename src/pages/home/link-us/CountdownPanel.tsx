import { Fragment } from 'react';
import cherryIcon from './assets/cherry.svg';
import type { AnniversaryClock } from './hooks/useAnniversaryClock';

export default function CountdownPanel({ anniversary }: { anniversary: AnniversaryClock }) {
  return (
    <Fragment>
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <p className="text-[11px] font-medium tracking-[0.28em] text-love/75">
          每一秒都算数
        </p>
        <h2 className="text-center font-display text-xl font-bold leading-snug text-brown-title sm:text-2xl">
          这是我们一起走过的
        </h2>
      </div>

      <div className="link-us-countdown-surface link-us-countdown-inner">
        <div className="relative flex w-full items-start justify-center px-4 pt-7">
          <div
            className="pointer-events-none absolute right-3 top-3 h-12 w-12 bg-contain bg-center bg-no-repeat opacity-90 sm:right-5 sm:top-4 sm:h-14 sm:w-14"
            style={{ backgroundImage: `url(${cherryIcon})` }}
            aria-hidden
          />
          <div className="flex items-baseline justify-center tabular-nums">
            <span
              className="text-[44px] font-bold leading-none tracking-tight text-love sm:text-[52px]"
              aria-live="polite"
            >
              {anniversary.days}
            </span>
            <span className="ml-1.5 text-xl font-bold text-love/85 sm:text-2xl">天</span>
          </div>
        </div>
        <div className="min-h-0" aria-hidden="true" />
        <div
          className="mb-4 grid w-[92%] grid-cols-3 gap-2 justify-self-center sm:mb-5 sm:gap-3"
          aria-label="在一起以来的时分秒"
        >
          <div className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-white/60 bg-countdown-hour/90 px-1.5 py-2 text-center shadow-inner">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              时
            </span>
            <span className="tabular-nums text-base font-semibold text-neutral-700 sm:text-lg">
              {anniversary.hours}
              <span className="text-[11px] font-medium text-neutral-500">小时</span>
            </span>
          </div>
          <div className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-white/60 bg-countdown-minute/90 px-1.5 py-2 text-center shadow-inner">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              分
            </span>
            <span className="tabular-nums text-base font-semibold text-neutral-700 sm:text-lg">
              {anniversary.minutes}
              <span className="text-[11px] font-medium text-neutral-500">分钟</span>
            </span>
          </div>
          <div className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border border-white/60 bg-countdown-second/90 px-1.5 py-2 text-center shadow-inner">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              秒
            </span>
            <span className="tabular-nums text-base font-semibold text-neutral-700 sm:text-lg">
              {anniversary.seconds}
              <span className="text-[11px] font-medium text-neutral-500">秒钟</span>
            </span>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
