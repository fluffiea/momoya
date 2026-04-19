import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { DailyComment } from '@momoya/shared';
import { apiFetch, apiDelete, apiPostJson } from '@/lib/api';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCommentTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatEntryDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function AvatarDot({ username }: { username: string }) {
  const char = username.charAt(0).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-love/20 text-sm font-bold text-[#e891b0]">
      {char}
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DailyCommentSheetProps {
  open: boolean;
  entryId: string;
  entryAt: string;
  me: string | undefined;
  onClose: () => void;
  /** 卡片侧已预加载的评论，避免重复请求 */
  initialComments?: DailyComment[];
  /** 评论数量变化时回调，用于更新卡片预览行 */
  onCountChange?: (count: number) => void;
}

// ─── Sheet inner ───────────────────────────────────────────────────────────────

function SheetInner({
  entryId,
  entryAt,
  me,
  onClose,
  initialComments,
  onCountChange,
}: Omit<DailyCommentSheetProps, 'open'>) {
  const [comments, setComments] = useState<DailyComment[]>(initialComments ?? []);
  const [loaded, setLoaded] = useState(Boolean(initialComments));
  const [loadError, setLoadError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    setLoadError('');
    const r = await apiFetch<{ comments: DailyComment[] }>(
      `/api/daily/entries/${entryId}/comments`,
    );
    if (r.ok) {
      setComments(r.data.comments);
      onCountChange?.(r.data.comments.length);
      setLoaded(true);
    } else {
      setLoadError(r.error);
    }
  }, [entryId, onCountChange]);

  useEffect(() => {
    if (!loaded) void loadComments();
  }, [loaded, loadComments]);

  // Scroll list to bottom when new comments arrive
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setSendError('');
    const r = await apiPostJson<{ comment: DailyComment }>(
      `/api/daily/entries/${entryId}/comments`,
      { body: body.trim() },
    );
    setSending(false);
    if (r.ok) {
      const next = [...comments, r.data.comment];
      setComments(next);
      onCountChange?.(next.length);
      setBody('');
    } else {
      setSendError(r.error);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    const r = await apiDelete(`/api/daily/entries/${entryId}/comments/${commentId}`);
    setDeletingId(null);
    if (r.ok) {
      const next = comments.filter((c) => c.id !== commentId);
      setComments(next);
      onCountChange?.(next.length);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <motion.div
        className="fixed inset-x-0 bottom-0 z-[201] flex flex-col rounded-t-3xl border-t border-border-sweet/30 bg-white shadow-[0_-4px_32px_rgb(249_172_201/0.18)]"
        style={{ maxHeight: '85vh' }}
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
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-sweet/20 px-5 pb-3 pt-1">
          <div>
            <h2 className="font-display text-[15px] font-bold text-brown-title">评论</h2>
            <p className="mt-0.5 text-[11px] text-neutral-400">{formatEntryDate(entryAt)}</p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-rose-50 hover:text-[#e891b0]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comment list — scrollable */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <p className="text-center text-sm text-rose-500">{loadError}</p>
          ) : !loaded ? (
            <p className="text-center text-sm text-neutral-400">加载中…</p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">还没有评论，快来说点什么吧～</p>
          ) : (
            <ul className="space-y-5">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <AvatarDot username={c.username} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-brown-title/80">
                        @{c.username}
                      </span>
                      <span className="text-[11px] text-neutral-400">
                        {formatCommentTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] leading-snug text-neutral-700 break-words">
                      {c.body}
                    </p>
                  </div>
                  {me === c.username && (
                    <button
                      type="button"
                      aria-label="删除评论"
                      disabled={deletingId === c.id}
                      className="mt-1 shrink-0 text-[11px] text-neutral-300 transition hover:text-rose-400 disabled:opacity-40"
                      onClick={() => void handleDelete(c.id)}
                    >
                      {deletingId === c.id ? '…' : '删除'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Input area — fixed at bottom */}
        <div className="border-t border-border-sweet/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          {me ? (
            <div className="flex items-end gap-2.5">
              <AvatarDot username={me} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="说点什么…"
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 text-[13px] leading-snug text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                {sendError ? (
                  <p className="text-[11px] text-rose-500">{sendError}</p>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-300">{body.length}/1000</span>
                  <button
                    type="button"
                    disabled={sending || !body.trim()}
                    onClick={() => void handleSend()}
                    className="rounded-xl bg-[#e891b0] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#d4769a] disabled:opacity-50"
                  >
                    {sending ? '发送中…' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-1 text-center text-[13px] text-neutral-400">登录后才能发评论哦～</p>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Exported component (portal wrapper) ──────────────────────────────────────

export default function DailyCommentSheet(props: DailyCommentSheetProps) {
  return createPortal(
    <AnimatePresence>
      {props.open && <SheetInner key={props.entryId} {...props} />}
    </AnimatePresence>,
    document.body,
  );
}
