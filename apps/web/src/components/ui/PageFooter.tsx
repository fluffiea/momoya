import cx from 'classnames';

export type PageFooterTone = 'love' | 'sky';

type Props = {
  /** 主文案，默认「愿我们的故事，越写越长」 */
  text?: string;
  tone?: PageFooterTone;
  className?: string;
};

const toneLine: Record<PageFooterTone, { left: string; right: string; heart: string }> = {
  love: {
    left: 'bg-gradient-to-r from-transparent to-love/40',
    right: 'bg-gradient-to-l from-transparent to-love/40',
    heart: 'text-love/50',
  },
  sky: {
    left: 'bg-gradient-to-r from-transparent to-confess-sky-strong/35',
    right: 'bg-gradient-to-l from-transparent to-confess-sky-strong/35',
    heart: 'text-confess-sky-strong/55',
  },
};

const toneText: Record<PageFooterTone, string> = {
  love: 'text-brown-title/45',
  sky: 'text-confess-sky-strong/55',
};

/**
 * 通用页面装饰页脚：心形分隔 + 一行 slogan。
 *
 * 任意 tab 页或长内容页底部都可以放，形成「故事翻完了」的收束感。
 * tone 默认 love（粉），可切换 sky（蓝，用于 confess 等蓝调页面）。
 */
export default function PageFooter({
  text = '愿我们的故事，越写越长',
  tone = 'love',
  className,
}: Props) {
  const lines = toneLine[tone];
  return (
    <footer
      className={cx(
        'mt-10 flex flex-col items-center gap-2 pb-2 sm:mt-12',
        className,
      )}
    >
      <div className={cx('flex items-center gap-2', lines.heart)} aria-hidden>
        <span className={cx('h-px w-6', lines.left)} />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="opacity-80"
        >
          <path d="M12 21s-7-4.5-9.5-9C.5 8.5 2.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4.5 0 6.5 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z" />
        </svg>
        <span className={cx('h-px w-6', lines.right)} />
      </div>
      <p
        className={cx(
          'font-display text-[11px] tracking-[0.18em] sm:text-[12px]',
          toneText[tone],
        )}
      >
        {text}
      </p>
    </footer>
  );
}
