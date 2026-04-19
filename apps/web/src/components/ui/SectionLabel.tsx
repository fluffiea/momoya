import cx from 'classnames';

export type SectionLabelTone = 'love' | 'sky';

type Props = {
  id?: string;
  /** 可选小图标，留空则只显示文字 + 横线 */
  iconSrc?: string;
  title: string;
  /** 默认粉色（love）；蓝调用 sky（如 confess 页） */
  tone?: SectionLabelTone;
  className?: string;
};

const toneLineClass: Record<SectionLabelTone, { left: string; right: string }> = {
  love: {
    left: 'bg-gradient-to-r from-transparent to-love/35',
    right: 'bg-gradient-to-l from-transparent to-love/35',
  },
  sky: {
    left: 'bg-gradient-to-r from-transparent to-confess-sky-strong/30',
    right: 'bg-gradient-to-l from-transparent to-confess-sky-strong/30',
  },
};

const toneTextClass: Record<SectionLabelTone, string> = {
  love: 'text-brown-title/75',
  sky: 'text-confess-sky-strong/70',
};

/**
 * 通用「章节小标签」：两侧渐变线 + 可选图标 + 字距宽松的小标题。
 *
 * 设计目标：作为页面内安静段落的章节分隔符，与「互动胶囊按钮 HomeRomanceSectionHeading」
 * 形成轻重对比，是全站呼吸节奏的关键元素。
 *
 * 用法示例：
 *   <SectionLabel iconSrc={star} title="今日寄语" />
 *   <SectionLabel title="基本资料" />            // 不带图标
 *   <SectionLabel title="寄出日期" tone="sky" />  // 蓝调（confess）
 */
export default function SectionLabel({
  id,
  iconSrc,
  title,
  tone = 'love',
  className,
}: Props) {
  const lines = toneLineClass[tone];
  const text = toneTextClass[tone];
  return (
    <div
      id={id}
      role="heading"
      aria-level={2}
      className={cx('flex w-full items-center justify-center gap-3', className)}
    >
      <span aria-hidden className={cx('h-px max-w-[3.5rem] flex-1', lines.left)} />
      <span className="inline-flex shrink-0 items-center gap-1.5">
        {iconSrc && (
          <img
            src={iconSrc}
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 opacity-75 sm:h-4 sm:w-4"
          />
        )}
        <span
          className={cx(
            'font-display text-[12px] font-bold tracking-[0.22em] sm:text-[13px]',
            text,
          )}
        >
          {title}
        </span>
      </span>
      <span aria-hidden className={cx('h-px max-w-[3.5rem] flex-1', lines.right)} />
    </div>
  );
}
