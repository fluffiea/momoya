import cx from 'classnames';
import type { ReactNode } from 'react';

export type PageHeroTone = 'love' | 'sky';

type Props = {
  /** 顶部小字（字距宽松、灰调），如「时间线」「我们的小站」 */
  eyebrow?: string;
  /** 大标题（font-display 加粗） */
  title: string;
  /** 副标题（小字、neutral） */
  subtitle?: string;
  /** 中间装饰：可放图标或心形等 */
  ornament?: ReactNode;
  tone?: PageHeroTone;
  className?: string;
};

const toneEyebrow: Record<PageHeroTone, string> = {
  love: 'text-brown-title/55',
  sky: 'text-confess-sky-strong/55',
};

const toneTitle: Record<PageHeroTone, string> = {
  love: 'text-brown-title',
  sky: 'text-confess-sky-strong',
};

const toneLine: Record<PageHeroTone, string> = {
  love: 'via-love/40',
  sky: 'via-confess-sky-strong/35',
};

/**
 * 通用页面 Hero 区：eyebrow（小字）→ 装饰横线 →（可选 ornament）→ 大标题 → 副标题。
 *
 * 用于 Daily / 我的 / 登录 等需要「页面身份感」却又不喧宾夺主的场景。
 * 与 HomeRomanceSectionHeading（互动胶囊）形成轻重对比。
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  ornament,
  tone = 'love',
  className,
}: Props) {
  return (
    <section className={cx('w-full text-center', className)}>
      {eyebrow ? (
        <p
          className={cx(
            'font-display text-[11px] font-medium tracking-[0.32em] uppercase sm:text-[12px]',
            toneEyebrow[tone],
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      {(eyebrow || ornament) && (
        <div
          className="mx-auto mt-2 flex max-w-[12rem] items-center gap-2.5"
          aria-hidden
        >
          <span className={cx('h-px flex-1 bg-gradient-to-r from-transparent', toneLine[tone])} />
          {ornament ? (
            <span className="shrink-0">{ornament}</span>
          ) : (
            <span
              className={cx(
                'inline-block h-1.5 w-1.5 rounded-full',
                tone === 'love' ? 'bg-love/50' : 'bg-confess-sky-strong/40',
              )}
            />
          )}
          <span className={cx('h-px flex-1 bg-gradient-to-l from-transparent', toneLine[tone])} />
        </div>
      )}

      <h1
        className={cx(
          'mt-3 font-display text-2xl font-bold tracking-wide sm:text-[28px]',
          toneTitle[tone],
        )}
      >
        {title}
      </h1>

      {subtitle ? (
        <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-neutral-500 sm:text-[15px]">
          {subtitle}
        </p>
      ) : null}
    </section>
  );
}
