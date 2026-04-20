/**
 * 手作工艺语言的小标签。与 SectionLabel 同语义，但视觉上是"撕出来的便签标签"：
 * 一个微倾斜的色块 + 手写字体的文字。
 *
 * 用在报备 / 日常 / 我的 等"便签纸"容器里做分节标签。
 *
 * tone:
 *   - 'amber' 米黄棕色（报备默认）
 *   - 'rose'  粉玫色（粉色页面默认）
 */
type Tone = 'amber' | 'rose';

type Props = {
  title: string;
  tone?: Tone;
  className?: string;
};

const TONE_STYLES: Record<
  Tone,
  { chipBg: string; chipShadow: string; textColor: string }
> = {
  amber: {
    chipBg: '#c47e5a',
    chipShadow: '2px 2px 0 rgba(120,80,40,0.18)',
    textColor: '#7a5224',
  },
  rose: {
    chipBg: '#e891b0',
    chipShadow: '2px 2px 0 rgba(199,117,154,0.22)',
    textColor: '#a74c72',
  },
};

export default function NoteLabel({ title, tone = 'rose', className = '' }: Props) {
  const t = TONE_STYLES[tone];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="inline-block h-[10px] w-[10px] rounded-sm"
        style={{
          background: t.chipBg,
          transform: 'rotate(15deg)',
          boxShadow: t.chipShadow,
        }}
      />
      <span
        className="font-display text-[13px] font-bold tracking-[0.12em]"
        style={{ color: t.textColor }}
      >
        {title}
      </span>
    </div>
  );
}
