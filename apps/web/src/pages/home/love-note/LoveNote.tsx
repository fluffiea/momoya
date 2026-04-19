import { useMemo, type KeyboardEvent } from 'react';
import cx from 'classnames';
import { motion as Motion } from 'framer-motion';
import SectionLabel from '@/components/ui/SectionLabel';
import starIcon from './icons/star.svg';
import { useDailyHitokoto } from './useDailyHitokoto';

const easeOut = [0.22, 1, 0.36, 1] as const;

const LoveNote = () => {
  const { hitokoto, from, fromWho, loading, error, retry, refresh } = useDailyHitokoto();
  const canRefresh = !loading && !error && Boolean(hitokoto);

  const handleSurfaceKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
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
      className="mx-auto w-[88%] max-w-md"
      aria-labelledby="love-note-heading"
    >
      <SectionLabel id="love-note-heading" iconSrc={starIcon} title="今日寄语" />

      {/* 引文主体：刻意去掉卡片，仅靠排版与装饰构成「页面的呼吸点」 */}
      <Motion.div
        className={cx(
          'mt-6 px-2 sm:mt-7',
          canRefresh && 'cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-love/35',
        )}
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-32px' }}
        transition={{ duration: 0.5, ease: easeOut }}
        aria-busy={loading}
        role={canRefresh ? 'button' : undefined}
        tabIndex={canRefresh ? 0 : undefined}
        aria-disabled={loading || error ? true : undefined}
        aria-label={canRefresh ? '点击刷新今日寄语' : undefined}
        onClick={() => {
          if (canRefresh) refresh();
        }}
        onKeyDown={handleSurfaceKeyDown}
      >
        {loading && (
          <p className="py-2 text-center text-sm text-neutral-400" aria-live="polite">
            正在加载今日寄语…
          </p>
        )}

        {!loading && error && (
          <div
            className="flex flex-col items-center gap-2.5 py-2 text-center"
            role="alert"
            aria-live="polite"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="max-w-prose text-sm leading-relaxed text-neutral-500">
              {error}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-love/30 bg-white/70 px-4 py-1.5 font-display text-xs font-bold text-brown-title/80 transition hover:border-love/50 hover:bg-white"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && hitokoto && (
          <figure className="mx-auto flex max-w-[26rem] flex-col items-center text-center">
            {/* 大引号装饰：作为视觉锚点 */}
            <span
              aria-hidden
              className="-mb-2 select-none font-display text-[42px] leading-none text-love/55 sm:-mb-3 sm:text-[50px]"
            >
              &ldquo;
            </span>

            <blockquote className="px-1 font-display text-[15px] leading-[1.95] tracking-[0.02em] text-neutral-700 sm:text-[16px] sm:leading-[2]">
              {hitokoto}
            </blockquote>

            {sourceLine && (
              <figcaption className="mt-3 text-[12px] tracking-wide text-neutral-400 sm:text-[13px]">
                —— {sourceLine}
              </figcaption>
            )}

            {/* 日期分隔：浪漫的落款 */}
            <div className="mt-5 flex items-center gap-3 sm:mt-6">
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-r from-transparent to-love/35 sm:w-10"
              />
              <time
                dateTime={dateIso}
                className="font-display text-[11px] font-medium tracking-[0.22em] tabular-nums text-brown-title/55 sm:text-[12px]"
              >
                {date}
              </time>
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-l from-transparent to-love/35 sm:w-10"
              />
            </div>
          </figure>
        )}
      </Motion.div>
    </section>
  );
};

export default LoveNote;
