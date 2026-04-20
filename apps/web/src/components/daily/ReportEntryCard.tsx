import type { DailyEntry } from '@momoya/shared';
import { UserAvatar } from '@/components/user';
import { resolveApiUrl } from '@/lib/api';
import { reportTagStickerClass } from '@/lib/reportTagSticker';

type Props = {
  entry: DailyEntry;
  me: string | undefined;
  /** username → 头像 URL，与日常评论一致 */
  resolveAvatar: (username: string) => string | undefined;
  tilt?: 'left' | 'right' | 'none';
  onPreview: (idx: number) => void;
  onOpenReview: () => void;
};

function recordOwner(entry: DailyEntry): string | undefined {
  const a = entry.createdByUsername?.trim();
  const b = entry.updatedByUsername?.trim();
  return a || b || undefined;
}

function formatDateStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { md: '--/--', time: '--:--' };
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}`;
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return { md, time };
}

function formatAckShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 报备的"便签/手账"卡片——视觉上与日常时间线明显区分：
 *   - 米色纸质卡片 + 噪点 + 柔和阴影 + 轻微倾斜
 *   - 左上角是"日期印章"；右上角是彩色"tag 贴纸"
 *   - 图片用 Polaroid 白边风
 *   - 已阅用斜盖的小红印章；评价以撕开的回执条呈现
 */
export default function ReportEntryCard({
  entry,
  me,
  resolveAvatar,
  tilt = 'none',
  onPreview,
  onOpenReview,
}: Props) {
  const images = entry.images ?? [];
  const owner = recordOwner(entry);
  const isOwner = Boolean(me) && owner === me;
  const stamp = formatDateStamp(entry.at);

  const acks = entry.acks ?? [];
  const acked = acks.length > 0;
  const review = entry.review ?? null;

  const tiltClass =
    tilt === 'left' ? '-rotate-[0.45deg]' : tilt === 'right' ? 'rotate-[0.4deg]' : '';

  /*
   * 无图 + 无 tag 时让印章进一步"收细"，避免整张便签视觉上向左上偏；
   * 有图/多 tag 时恢复正常但整体仍比老版本轻。
   */
  const lightStamp = images.length === 0 && entry.tags.length === 0;
  const hasBody = entry.body.trim().length > 0;

  return (
    <article className={`report-note relative overflow-visible ${tiltClass}`}>
      {/* 顶行：日期印章 + tag 贴纸 */}
      <header className="flex items-start justify-between gap-2.5">
        <DateStamp md={stamp.md} time={stamp.time} compact={lightStamp} />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {entry.tags.slice(0, 3).map((tag, i) => (
            <span
              key={tag.id}
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-display text-[10.5px] font-bold shadow-[0_1px_0_rgba(255,255,255,0.55)_inset,0_3px_6px_-3px_rgba(120,80,40,0.3)] ${reportTagStickerClass(tag)}`}
              style={{
                transform: `rotate(${i === 0 ? -2 : i === 1 ? 1.5 : -0.5}deg)`,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </header>

      {/* 身份小字 */}
      {owner && (
        <p className="mt-1 font-display text-[10.5px] text-[#9c7a4a]">
          {owner === 'system' ? '共读纪念' : `@${owner} 的报备`}
          {entry.updatedByUsername && entry.updatedByUsername !== owner ? (
            <> · 最后由 @{entry.updatedByUsername} 更新</>
          ) : null}
        </p>
      )}

      {/* 正文：仅在有内容时占用一行空间（避免纯图报备下出现空白段） */}
      {hasBody && (
        <p className="mt-2 whitespace-pre-wrap font-display text-[14px] leading-[1.65] tracking-[0.01em] text-[#3f2b14] sm:text-[14.5px]">
          {entry.body}
        </p>
      )}

      {/* 图片：单张 Polaroid，多张九宫格白描边 */}
      {images.length > 0 && (
        <ImagesBlock images={images} onPreview={onPreview} />
      )}

      {/* 回执：已阅印章 / 评价回执条 / 操作按钮 */}
      <div className="relative mt-3">
        {acked && (
          <span
            aria-hidden
            className="craft-stamp-slash pointer-events-none absolute right-2 -top-10 z-[1] select-none font-display text-[12px] font-black tracking-[0.25em] text-[#c84a3a]"
          >
            已 阅
          </span>
        )}

        {review ? (
          <button
            type="button"
            onClick={onOpenReview}
            className="block w-full overflow-hidden rounded-[14px] border border-[#d7b684]/55 bg-white/70 p-0 text-left shadow-[0_2px_6px_-2px_rgba(120,80,40,0.2)] transition hover:bg-white"
          >
            <span
              aria-hidden
              className="block h-1.5 w-full"
              style={{
                background:
                  'radial-gradient(circle at 5px 100%, transparent 3px, #fff 3.5px) 0 0/10px 6px repeat-x',
              }}
            />
            <span className="flex items-start gap-2.5 px-3 py-2.5">
              <UserAvatar
                username={review.username}
                avatarUrl={resolveAvatar(review.username)}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[11px] text-[#9c7a4a]">
                  @{review.username} 的回信
                </span>
                <span className="mt-0.5 block whitespace-pre-wrap text-[13.5px] leading-[1.55] text-[#3f2b14]">
                  {review.body}
                </span>
              </span>
            </span>
          </button>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          {acked ? (
            <span className="inline-flex items-center rounded-full bg-[#eadfc3] px-2 py-0.5 font-display text-[10.5px] font-semibold text-[#7a5224]">
              {acks[0] ? `${formatAckShort(acks[0].at)} 已阅` : '已阅'}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[#f5e3c4] px-2 py-0.5 font-display text-[10.5px] font-semibold text-[#8a5a1b]">
              等 ta 签收
            </span>
          )}
          <button
            type="button"
            onClick={onOpenReview}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#c47e5a] px-3 py-1 font-display text-[11.5px] font-bold text-white shadow-[0_3px_8px_-3px_rgba(196,126,90,0.6)] transition hover:bg-[#a9623f]"
          >
            {isOwner
              ? review
                ? '查看回信'
                : '等一条回信'
              : review
                ? '修改评价'
                : acked
                  ? '补一条评价'
                  : '已阅 / 评价'}
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * 横排小印章：REPORT · MM/DD · HH:mm。
 * 色度压低、字重略减，避免抢「已阅 / 签收」状态区的第一注意力。
 */
function DateStamp({ md, time, compact = false }: { md: string; time: string; compact?: boolean }) {
  const color = compact ? '#a8a09a' : '#9a928c';
  return (
    <div
      className="flex shrink-0 select-none items-center justify-center font-display"
      style={{ transform: compact ? 'rotate(-0.8deg)' : 'rotate(-1.2deg)' }}
    >
      <div
        className="craft-stamp-rect flex-row items-center gap-1.5"
        style={{ color, opacity: compact ? 0.72 : 0.78, flexDirection: 'row' }}
      >
        <span className="font-semibold tracking-[0.18em] text-[8px] opacity-75">REPORT</span>
        <span className={`font-semibold leading-none tabular-nums ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
          {md}
        </span>
        <span className="text-[8px] tabular-nums opacity-65">{time}</span>
      </div>
    </div>
  );
}

function ImagesBlock({ images, onPreview }: { images: string[]; onPreview: (idx: number) => void }) {
  if (images.length === 1) {
    const url = images[0];
    return (
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => onPreview(0)}
          className="craft-polaroid block -rotate-[1.6deg] transition hover:-rotate-0"
        >
          <img
            src={resolveApiUrl(url)}
            alt=""
            loading="lazy"
            className="block aspect-[4/3] w-[min(18rem,100%)]"
          />
        </button>
      </div>
    );
  }

  const cols = images.length <= 4 ? 2 : 3;
  const grid = cols === 2 ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-1.5';
  return (
    <div className={`mt-3 grid ${grid}`}>
      {images.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPreview(i)}
          className="craft-polaroid-mini overflow-hidden"
        >
          <img
            src={resolveApiUrl(url)}
            alt=""
            loading="lazy"
            className="aspect-square w-full transition hover:scale-105"
          />
        </button>
      ))}
    </div>
  );
}
