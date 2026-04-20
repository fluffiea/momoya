import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { DailyEntry, DailyAck, ReportReview } from '@momoya/shared';
import { UserAvatar } from '@/components/user';
import { apiFetch, apiPostJson } from '@/lib/api';
import { lockOverlayScroll } from '@/lib/overlayScrollLock';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function findMyAck(acks: DailyAck[] | undefined, me: string | undefined): DailyAck | null {
  if (!me || !acks) return null;
  return acks.find((a) => a.username === me) ?? null;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface ReportReviewSheetProps {
  open: boolean;
  /** 打开时该 entry 最新数据（至少包含 id/kind/acks） */
  entry: DailyEntry;
  me: string | undefined;
  /** 与日常评论一致：username → 头像 URL */
  resolveAvatar: (username: string) => string | undefined;
  onClose: () => void;
  /** 已阅/评价变化后回传最新 entry（由父组件并到列表状态里） */
  onEntryChange?: (next: DailyEntry) => void;
}

// ─── Sheet inner ───────────────────────────────────────────────────────────────

function SheetInner({
  entry,
  me,
  resolveAvatar,
  onClose,
  onEntryChange,
}: Omit<ReportReviewSheetProps, 'open'>) {
  const [review, setReview] = useState<ReportReview | null>(entry.review ?? null);
  const [loaded, setLoaded] = useState(entry.review !== undefined);
  const [editBody, setEditBody] = useState<string>(entry.review?.body ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acking, setAcking] = useState(false);
  const [errText, setErrText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const owner = entry.createdByUsername ?? entry.updatedByUsername;
  const isReceiver = Boolean(me && owner && me !== owner);
  const myAck = findMyAck(entry.acks, me);
  const canWriteReview = isReceiver && Boolean(myAck);

  useEffect(() => {
    return lockOverlayScroll();
  }, []);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 详情接口已在 entry 打开时返回 review，这里兜底再拉一次确保最新
  const loadReview = useCallback(async () => {
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${entry.id}`);
    if (r.ok) {
      const fresh = r.data.entry;
      setReview(fresh.review ?? null);
      setEditBody(fresh.review?.body ?? '');
      setLoaded(true);
      onEntryChange?.(fresh);
    } else {
      setLoaded(true);
    }
  }, [entry.id, onEntryChange]);

  useEffect(() => {
    if (!loaded) void loadReview();
  }, [loaded, loadReview]);

  const handleAck = async () => {
    setAcking(true);
    setErrText('');
    const r = await apiPostJson<{ entry: DailyEntry }>(
      `/api/daily/entries/${entry.id}/ack`,
      {},
    );
    setAcking(false);
    if (r.ok) {
      onEntryChange?.(r.data.entry);
    } else {
      setErrText(r.error);
    }
  };

  const handleSaveReview = async () => {
    const body = editBody.trim();
    if (!body) return;
    setSaving(true);
    setErrText('');
    const r = await apiFetch<{ review: ReportReview }>(
      `/api/daily/entries/${entry.id}/review`,
      {
        method: 'PUT',
        body: JSON.stringify({ body }),
      },
    );
    setSaving(false);
    if (r.ok) {
      setReview(r.data.review);
      setEditBody(r.data.review.body);
      setEditing(false);
      // 父层会通过 SSE review.upserted 自拉更新；这里同步一份好让当前卡片先行更新
      onEntryChange?.({ ...entry, review: r.data.review });
    } else {
      setErrText(r.error);
    }
  };

  const receiverName = isReceiver ? me! : '对方';

  return (
    <>
      <div
        className="fixed inset-0 z-[200] touch-none bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        className="fixed inset-x-0 bottom-0 z-[201] flex touch-auto flex-col rounded-t-3xl shadow-[0_-4px_32px_rgb(120_80_40/0.22)]"
        style={{
          maxHeight: '85vh',
          backgroundColor: '#fbf1dc',
          backgroundImage:
            'radial-gradient(1000px 400px at 50% -120px, rgba(255,255,255,0.9) 0%, transparent 60%),repeating-linear-gradient(0deg, rgba(120,80,40,0.04) 0px, rgba(120,80,40,0.04) 1px, transparent 1px, transparent 28px)',
          borderTop: '1px solid rgba(180,140,80,0.3)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_e, info) => {
          if (info.offset.y > 80) onClose();
        }}
      >
        {/* 顶部撕纸装饰 */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-3 right-3 top-0 h-2"
          style={{
            background:
              'radial-gradient(circle at 5px 100%, #fbf1dc 3.5px, transparent 4px) 0 0/10px 8px repeat-x',
            filter: 'drop-shadow(0 1px 0 rgba(120,80,40,0.18))',
          }}
        />
        <div className="flex justify-center pb-1 pt-3" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-[#c8a878]/50" />
        </div>

        <div className="flex items-center justify-between border-b border-[#c8a878]/35 px-5 pb-3 pt-1">
          <div>
            <h2 className="font-display text-[15px] font-bold text-[#5c3d16]">便签回执</h2>
            <p className="mt-0.5 text-[11px] text-[#9c7a4a]">
              {owner ? `由 @${owner} 贴给 ta` : '报备'}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9c7a4a] transition hover:bg-[#f2e2bf] hover:text-[#5c3d16]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* ── 已阅区 ───────────────────────────────────────────── */}
          <section className="mb-5 rounded-2xl border border-[#c8a878]/40 bg-[#fff8e7]/75 px-4 py-4">
            <header className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c47e5a] text-white shadow-sm"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M16.704 5.296a1 1 0 0 1 0 1.414l-7.5 7.5a1 1 0 0 1-1.414 0l-3.5-3.5a1 1 0 1 1 1.414-1.414L8.5 12.09l6.793-6.793a1 1 0 0 1 1.411 0Z" clipRule="evenodd" />
                </svg>
              </span>
              <h3 className="font-display text-[14px] font-semibold text-[#5c3d16]">已阅状态</h3>
            </header>
            {myAck ? (
              <p className="mt-2 text-[13px] text-[#5c3d16]/85">
                你已于 <span className="font-semibold tabular-nums">{formatTime(myAck.at)}</span> 点击「已阅」
              </p>
            ) : entry.acks && entry.acks.length > 0 ? (
              <p className="mt-2 text-[13px] text-[#5c3d16]/80">
                @{entry.acks[0].username} 已于 {formatTime(entry.acks[0].at)} 查阅
              </p>
            ) : isReceiver ? (
              <div className="mt-3 flex flex-col items-stretch gap-2">
                <p className="text-[13px] text-[#5c3d16]/75">让对方安心一下吧～一旦点击就无法撤销</p>
                <button
                  type="button"
                  disabled={acking}
                  onClick={() => void handleAck()}
                  className="mt-1 rounded-2xl bg-[#c47e5a] py-3 font-display text-[15px] font-bold text-white shadow-[0_6px_18px_rgb(196_126_90_0.32)] transition hover:bg-[#a9623f] disabled:opacity-60"
                >
                  {acking ? '提交中…' : '✓ 我已经看到啦'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-[#9c7a4a]">对方尚未查阅</p>
            )}
          </section>

          {/* ── 评价区 ───────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[#c8a878]/40 bg-white/80 px-4 py-4">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f2d4a3] text-[#7a5224]"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M9.653 2.165a.75.75 0 0 1 .695 0l1.995 1.07 2.262-.25a.75.75 0 0 1 .793.42l1.015 2.03 1.76 1.442a.75.75 0 0 1 .272.745l-.47 2.213.788 2.122a.75.75 0 0 1-.272.86l-1.864 1.322-.895 2.087a.75.75 0 0 1-.773.45l-2.27-.197-2.034.933a.75.75 0 0 1-.625 0l-2.034-.933-2.27.197a.75.75 0 0 1-.773-.45l-.895-2.087L.33 12.857a.75.75 0 0 1-.272-.86l.788-2.122-.47-2.213a.75.75 0 0 1 .272-.745L2.408 5.475l1.015-2.03a.75.75 0 0 1 .793-.42l2.262.25 1.995-1.07Z" />
                  </svg>
                </span>
                <h3 className="font-display text-[14px] font-semibold text-[#5c3d16]">
                  {receiverName} 的回信
                </h3>
              </div>
              {canWriteReview && review && !editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditBody(review.body);
                    setEditing(true);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  className="text-[12px] text-[#c47e5a] transition hover:text-[#a9623f]"
                >
                  编辑
                </button>
              ) : null}
            </header>

            {/* Read-only view */}
            {review && !editing && (
              <div className="mt-3 flex items-start gap-2.5">
                <UserAvatar
                  username={review.username}
                  avatarUrl={resolveAvatar(review.username)}
                />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-neutral-700">
                    {review.body}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400 tabular-nums">
                    {formatTime(review.updatedAt)}
                  </p>
                </div>
              </div>
            )}

            {/* Editable (receiver only, after ack) */}
            {canWriteReview && editing && (
              <div className="mt-3">
                <textarea
                  ref={textareaRef}
                  rows={3}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder={myAck ? '说点什么鼓励一下吧～' : '建议先点击「已阅」再写评价哦'}
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-[#c8a878]/55 bg-[#fffaf0] px-3 py-2 text-[14px] leading-snug text-[#3f2b14] outline-none transition focus:border-[#c47e5a] focus:ring-2 focus:ring-[#c47e5a]/30"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-300 tabular-nums">
                    {editBody.length}/1000
                  </span>
                  <div className="flex items-center gap-2">
                    {review ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditBody(review.body);
                          setEditing(false);
                        }}
                        className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-[13px] text-neutral-600 transition hover:bg-neutral-50"
                      >
                        取消
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={saving || !editBody.trim()}
                      onClick={() => void handleSaveReview()}
                      className="rounded-xl bg-[#c47e5a] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#a9623f] disabled:opacity-50"
                    >
                      {saving ? '保存中…' : '保存回信'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Creator view：对方还没评 */}
            {!review && !editing && !isReceiver && (
              <p className="mt-2 text-[13px] text-neutral-400">对方还没有写评价</p>
            )}

            {/* Receiver but not yet acked：先已阅再评价 */}
            {isReceiver && !myAck && !review && !editing && (
              <p className="mt-2 text-[13px] text-neutral-400">先点击「已阅」再写评价哦</p>
            )}

            {/* Receiver first-time prompt（已阅之后，尚无评价） */}
            {canWriteReview && !review && !editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                className="mt-3 rounded-xl border border-dashed border-[#c8a878] bg-[#fff8e7]/80 px-3 py-2 text-[13px] text-[#7a5224] transition hover:bg-[#fff4d8]"
              >
                写一句回信～
              </button>
            )}

            {errText ? (
              <p className="mt-2 text-[12px] text-rose-500" role="alert">
                {errText}
              </p>
            ) : null}
          </section>
        </div>
      </motion.div>
    </>
  );
}

// ─── Exported component (portal wrapper) ──────────────────────────────────────

export default function ReportReviewSheet(props: ReportReviewSheetProps) {
  return createPortal(
    <AnimatePresence>
      {props.open && <SheetInner key={props.entry.id} {...props} />}
    </AnimatePresence>,
    document.body,
  );
}
