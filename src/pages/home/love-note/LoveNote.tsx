import { useMemo, type KeyboardEvent } from 'react';
import cx from 'classnames';
import { motion as Motion } from 'framer-motion';
import HomeRomanceSectionHeading from '@/components/ui/HomeRomanceSectionHeading';
import starIcon from './icons/star.svg';
import { useDailyHitokoto } from './useDailyHitokoto';

const LoveNote = () => {
  const { hitokoto, from, fromWho, loading, error, retry, refresh } = useDailyHitokoto();
  const canRefresh = !loading && !error && Boolean(hitokoto);

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canRefresh) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      refresh();
    }
  };

  const { date, dateIso } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return {
      date: `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
      dateIso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }, []);

  const sourceLine = [from, fromWho].filter(Boolean).join(' · ');

  return (
    <section
      className="mx-auto w-[92%] max-w-md px-0 pt-5"
      aria-labelledby="love-note-heading"
    >
      <HomeRomanceSectionHeading
        id="love-note-heading"
        iconSrc={starIcon}
        title="今日寄语"
      />

      <Motion.div
        className={cx('love-note-card', canRefresh && 'cursor-pointer')}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-busy={loading}
        role={canRefresh ? 'button' : undefined}
        tabIndex={canRefresh ? 0 : undefined}
        aria-disabled={loading || error ? true : undefined}
        aria-label={canRefresh ? '点击刷新今日寄语' : undefined}
        onClick={() => {
          if (canRefresh) refresh();
        }}
        onKeyDown={handleCardKeyDown}
      >
        <div className="relative z-10 px-5 pb-2 pt-5 sm:px-7 sm:pt-5">
          <div
            className="mx-auto mb-3.5 h-0.5 w-11 rounded-full bg-love/22 sm:mb-4 sm:w-12"
            aria-hidden
          />

          {loading && (
            <div className="text-center" aria-live="polite">
              <p className="text-[15px] leading-[1.72] text-neutral-400 sm:text-base">
                正在加载今日寄语…
              </p>
            </div>
          )}

          {!loading && error && (
            <div
              className="flex flex-col items-center gap-3 text-center"
              role="alert"
              aria-live="polite"
            >
              <p className="max-w-prose text-[15px] font-medium leading-relaxed text-neutral-600">
                {error}
              </p>
              <button
                type="button"
                onClick={retry}
                className="rounded-xl border border-love/25 bg-love/15 px-5 py-2.5 font-display text-sm font-bold text-brown-title/90 transition hover:border-love/35 hover:bg-love/22"
              >
                重试
              </button>
            </div>
          )}

          {!loading && !error && hitokoto && (
            <div className="mx-auto flex w-full max-w-prose flex-col items-center gap-2.5 text-center">
              <p className="text-[15px] font-medium leading-[1.72] text-neutral-600 sm:text-base sm:leading-[1.78]">
                “{hitokoto}”
              </p>
              {sourceLine && (
                <p className="text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
                  <span className="text-neutral-400">—— </span>
                  {sourceLine}
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="relative z-10 mt-4 flex items-center gap-3 px-5 pb-5 sm:px-7">
          <span
            className="h-px min-w-[2rem] flex-1 bg-gradient-to-r from-transparent to-love/22"
            aria-hidden
          />
          <time
            dateTime={dateIso}
            className="shrink-0 font-display text-xs font-medium tracking-[0.12em] text-brown-title/50 tabular-nums sm:text-sm"
          >
            {date}
          </time>
          <span
            className="h-px min-w-[2rem] flex-1 bg-gradient-to-l from-transparent to-love/22"
            aria-hidden
          />
        </footer>
      </Motion.div>
    </section>
  );
};

export default LoveNote;
