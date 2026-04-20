/**
 * 便签纸容器顶部：斜章 + 标题（无撕口装饰）。
 */
type Tone = 'amber' | 'rose';

type Props = {
  title: string;
  stampLabel?: string;
  tone?: Tone;
};

const TONE = {
  amber: {
    stampColor: '#b45438',
    stampBorder: 'rgba(180,84,56,0.7)',
    titleColor: '#5c3d16',
  },
  rose: {
    stampColor: '#b54a72',
    stampBorder: 'rgba(180,74,114,0.7)',
    titleColor: '#7a3f58',
  },
} as const satisfies Record<Tone, Record<string, string>>;

export default function SheetHeader({ title, stampLabel = 'NOTE', tone = 'rose' }: Props) {
  const t = TONE[tone];
  return (
    <div className="relative -mt-2 mb-1 flex items-center justify-between">
      <span
        className="craft-stamp-rect font-display text-[10px] font-black tracking-[0.32em]"
        style={{
          color: t.stampColor,
          borderColor: t.stampBorder,
          transform: 'rotate(-3deg)',
        }}
      >
        {stampLabel}
      </span>
      <h2
        className="font-display text-[15px] font-bold"
        style={{ color: t.titleColor }}
      >
        {title}
      </h2>
    </div>
  );
}
