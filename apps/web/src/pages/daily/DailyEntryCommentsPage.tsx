import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DailyComment, DailyEntry, HomePartnersResponse } from '@momoya/shared';
import { useAuth } from '@/auth/useAuth';
import SecondaryPageHeader from '@/components/ui/SecondaryPageHeader';
import SectionLabel from '@/components/ui/SectionLabel';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import { apiFetch, apiDelete, apiPatchJson, apiPostJson, resolveApiUrl } from '@/lib/api';
import { subscribeDailyEvents } from '@/lib/dailyEvents';

// ─── Time / date helpers ───────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} 小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatEntryWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const timePart = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart}  ${timePart}`;
}

// ─── Avatar component ──────────────────────────────────────────────────────────

function AvatarImg({
  username,
  avatarUrl,
  size = 'md',
}: {
  username: string;
  avatarUrl?: string;
  size?: 'sm' | 'md';
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const char = username.charAt(0).toUpperCase();
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-sm';

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={resolveApiUrl(avatarUrl)}
        alt={username}
        className={`${dim} shrink-0 rounded-full border border-border-sweet/20 object-cover`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-love/20 font-bold text-[#e891b0]`}
    >
      {char}
    </div>
  );
}

// ─── Entry image grid + preview ────────────────────────────────────────────────

function EntryImageGrid({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (idx: number) => void;
}) {
  if (images.length === 0) return null;
  const cols = images.length === 1 ? 1 : images.length <= 4 ? 2 : 3;
  const gridClass =
    cols === 1
      ? 'grid grid-cols-1'
      : cols === 2
        ? 'grid grid-cols-2 gap-1.5'
        : 'grid grid-cols-3 gap-1';
  return (
    <div className={`mt-3 ${gridClass}`}>
      {images.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPreview(i)}
          className={`overflow-hidden rounded-xl border border-border-sweet/20 bg-rose-50/30 ${
            cols === 1 ? 'aspect-video w-full' : 'aspect-square'
          }`}
        >
          <img
            src={resolveApiUrl(url)}
            alt=""
            className="h-full w-full object-cover transition hover:scale-105"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

function ImagePreviewDialog({
  images,
  initialIdx,
  onClose,
}: {
  images: string[];
  initialIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, onClose]);

  return (
    <dialog
      open
      className="fixed inset-0 z-[200] m-0 flex h-full w-full max-w-none items-center justify-center bg-black/85 p-0 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-screen max-w-full flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭预览"
          className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          onClick={onClose}
        >
          ×
        </button>
        <img
          src={resolveApiUrl(images[idx])}
          alt=""
          className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一张"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              onClick={(e) => { e.stopPropagation(); prev(); }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一张"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              onClick={(e) => { e.stopPropagation(); next(); }}
            >
              ›
            </button>
            <p className="mt-3 text-[12px] text-white/60">{idx + 1} / {images.length}</p>
          </>
        )}
      </div>
    </dialog>
  );
}

// ─── Comment tree helpers ──────────────────────────────────────────────────────

interface CommentNode extends DailyComment {
  replies: DailyComment[];
}

/** 严格按 createdAt 升序：先发的在最上面（同毫秒按 id 兜底，保证稳定） */
function sortByCreatedAtAsc(list: DailyComment[]): DailyComment[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

function buildTree(comments: DailyComment[]): CommentNode[] {
  const sorted = sortByCreatedAtAsc(comments);
  const topLevel = sorted.filter((c) => !c.parentId);
  const replyMap = new Map<string, DailyComment[]>();
  sorted
    .filter((c) => c.parentId)
    .forEach((c) => {
      const arr = replyMap.get(c.parentId!) ?? [];
      arr.push(c);
      replyMap.set(c.parentId!, arr);
    });
  return topLevel.map((c) => ({ ...c, replies: replyMap.get(c.id) ?? [] }));
}

// ─── Inline edit state ─────────────────────────────────────────────────────────

interface EditingState {
  commentId: string;
  draft: string;
  saving: boolean;
  error: string;
}

// ─── Compose input ─────────────────────────────────────────────────────────────

interface ComposeProps {
  entryId: string;
  replyTo: DailyComment | null;
  onCancelReply: () => void;
  onSent: (comment: DailyComment) => void;
  myAvatarUrl?: string;
  myUsername: string;
}

function CommentCompose({ entryId, replyTo, onCancelReply, onSent, myAvatarUrl, myUsername }: ComposeProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError('');
    const r = await apiPostJson<{ comment: DailyComment }>(
      `/api/daily/entries/${entryId}/comments`,
      { body: body.trim(), parentId: replyTo?.id },
    );
    setSending(false);
    if (r.ok) {
      setBody('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      onSent(r.data.comment);
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="border-t border-border-sweet/40 bg-white/95 shadow-[0_-4px_20px_rgb(249_172_201/0.18)] backdrop-blur-sm">
      {replyTo && (
        <div className="flex items-center gap-2 border-b border-border-sweet/20 bg-rose-50/60 px-4 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500">
            回复{' '}
            <span className="font-semibold text-[#e891b0]">@{replyTo.username}</span>
            ：{replyTo.body}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 text-[11px] text-neutral-400 transition hover:text-rose-400"
          >
            ✕
          </button>
        </div>
      )}
      {error ? (
        <p className="px-4 pt-1.5 text-[11px] text-rose-500">{error}</p>
      ) : null}
      <div className="flex items-center gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]">
        <AvatarImg username={myUsername} avatarUrl={myAvatarUrl} size="sm" />
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={(e) => { setBody(e.target.value); autoResize(); }}
            onInput={autoResize}
            placeholder={replyTo ? `回复 @${replyTo.username}…` : '写评论…'}
            maxLength={1000}
            style={{ minHeight: '34px', maxHeight: '96px' }}
            className="w-full resize-none overflow-hidden rounded-full border border-border-sweet/40 bg-rose-50/50 px-3.5 py-[7px] text-[13px] leading-snug text-neutral-800 outline-none transition focus:border-love/50 focus:bg-white focus:ring-2 focus:ring-love/20"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          {body.length > 0 && (
            <span className="pointer-events-none absolute bottom-1 right-3 text-[9px] text-neutral-300">
              {body.length}/1000
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={sending || !body.trim()}
          onClick={() => void handleSend()}
          aria-label="发送"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e891b0] text-white shadow-sm transition hover:bg-[#d4769a] disabled:opacity-40"
        >
          {sending ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M3.105 2.289a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.289Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DailyEntryCommentsPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const { user } = useAuth();
  const me = user?.username;
  const myAvatarUrl = user?.profile.avatarUrl || undefined;

  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [entryError, setEntryError] = useState('');
  const [comments, setComments] = useState<DailyComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  /** 待二次确认删除的评论；null 表示未触发删除 */
  const [deleteTarget, setDeleteTarget] = useState<DailyComment | null>(null);
  /** 真正调用 DELETE 时的 pending 标志 */
  const [deletePending, setDeletePending] = useState(false);
  const [replyTo, setReplyTo] = useState<DailyComment | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 进入编辑时将光标置于文末
  useEffect(() => {
    if (!editing) return;
    const el = editTextareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [editing?.commentId]);

  // Image preview
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Avatar map: username → avatarUrl
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map());

  const loadPartners = useCallback(async () => {
    const r = await apiFetch<HomePartnersResponse>('/api/home/partners');
    if (r.ok) {
      const map = new Map(
        r.data.partners
          .filter((p) => p.avatarUrl)
          .map((p) => [p.username, p.avatarUrl]),
      );
      setAvatarMap(map);
    }
  }, []);

  const loadEntry = useCallback(async () => {
    if (!entryId) return;
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${entryId}`);
    if (r.ok) setEntry(r.data.entry);
    else setEntryError(r.error);
  }, [entryId]);

  const loadComments = useCallback(async () => {
    if (!entryId) return;
    setCommentsError('');
    const r = await apiFetch<{ comments: DailyComment[] }>(
      `/api/daily/entries/${entryId}/comments`,
    );
    if (r.ok) {
      setComments(r.data.comments);
      setCommentsLoaded(true);
    } else {
      setCommentsError(r.error);
    }
  }, [entryId]);

  useEffect(() => {
    void loadEntry();
    void loadComments();
    void loadPartners();
  }, [loadEntry, loadComments, loadPartners]);

  // 实时同步：本条目相关变更时静默刷新
  useEffect(() => {
    return subscribeDailyEvents((event) => {
      if (!entryId) return;
      if (event.type === 'entry.updated' && event.entryId === entryId) {
        void loadEntry();
      } else if (
        (event.type === 'comment.created' ||
          event.type === 'comment.deleted' ||
          event.type === 'comment.updated') &&
        event.entryId === entryId
      ) {
        void loadComments();
      }
    });
  }, [entryId, loadEntry, loadComments]);

  const getAvatar = (username: string) =>
    username === me ? myAvatarUrl : (avatarMap.get(username) || undefined);

  const handleSent = (comment: DailyComment) => {
    setComments((prev) => [...prev, comment]);
    setReplyTo(null);
  };

  const requestDelete = (comment: DailyComment) => setDeleteTarget(comment);

  const cancelDelete = () => {
    if (!deletePending) setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    const targetId = deleteTarget.id;
    const r = await apiDelete(`/api/daily/entries/${entryId}/comments/${targetId}`);
    setDeletePending(false);
    setDeleteTarget(null);
    if (r.ok) {
      setComments((prev) =>
        prev.filter((c) => c.id !== targetId && c.parentId !== targetId),
      );
    } else {
      window.alert((r as { ok: false; error: string }).error);
    }
  };

  const startEdit = (comment: DailyComment) => {
    setEditing({ commentId: comment.id, draft: comment.body, saving: false, error: '' });
  };

  const cancelEdit = () => setEditing(null);

  const submitEdit = async () => {
    if (!editing || !editing.draft.trim()) return;
    setEditing((e) => e && { ...e, saving: true, error: '' });
    const r = await apiPatchJson<{ comment: DailyComment }>(
      `/api/daily/entries/${entryId}/comments/${editing.commentId}`,
      { body: editing.draft.trim() },
    );
    if (r.ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === r.data.comment.id ? r.data.comment : c)),
      );
      setEditing(null);
    } else {
      setEditing((e) => e && { ...e, saving: false, error: r.error });
    }
  };

  const tree = buildTree(comments);
  const images = entry?.images ?? [];

  // Owner info
  const owner = entry?.createdByUsername?.trim() || entry?.updatedByUsername?.trim();
  const ownerCaption = owner === 'system' ? '共读纪念' : owner ? `由 @${owner} 记录` : null;

  return (
    <div className="home-romance-bg flex h-full flex-col">
      <SecondaryPageHeader title="日常" sticky={false} />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-[92%] max-w-md py-4">

          {/* ── Entry post ── */}
          {entryError ? (
            <p className="mb-4 text-sm text-rose-500">{entryError}</p>
          ) : entry ? (
            <article className="relative mb-5">
              {/* 时间章 + 作者：作为帖子的「邮戳」头部 */}
              <header className="flex items-center gap-2.5">
                <time className="font-display text-[13px] font-semibold tabular-nums text-brown-title/75 sm:text-[14px]">
                  {formatEntryWhen(entry.at)}
                </time>
                {ownerCaption && (
                  <>
                    <span aria-hidden className="h-3 w-px bg-border-sweet/60" />
                    <span className="text-[11px] text-neutral-400">{ownerCaption}</span>
                  </>
                )}
              </header>

              {/* 标签条 */}
              {entry.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-full border border-love/20 bg-love/10 px-2.5 py-0.5 text-[11px] font-medium text-brown-title/80"
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              )}

              {/* 正文 */}
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.85] text-neutral-700 sm:text-[15.5px]">
                {entry.body}
              </p>

              {/* 图片 */}
              {images.length > 0 && (
                <EntryImageGrid
                  images={images}
                  onPreview={(idx) => {
                    setPreviewIdx(idx);
                    setPreviewOpen(true);
                  }}
                />
              )}
            </article>
          ) : (
            <div className="mb-5 h-24 animate-pulse rounded-2xl bg-rose-50/40" />
          )}

          {/* ── Comment section ── */}
          <SectionLabel
            title={
              commentsLoaded
                ? `${comments.filter((c) => !c.parentId).length} 条评论`
                : '评论'
            }
            className="mb-3"
          />

          {commentsError ? (
            <p className="text-sm text-rose-500">{commentsError}</p>
          ) : !commentsLoaded ? (
            <p className="py-8 text-center text-sm text-neutral-400">加载中…</p>
          ) : tree.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">
              还没有评论，来说点什么吧～
            </p>
          ) : (
            <ul className="divide-y divide-border-sweet/30">
              {tree.map((comment) => {
                const isEditingThis = editing?.commentId === comment.id;
                const hasReplies = comment.replies.length > 0;
                return (
                  <li key={comment.id} className="py-4 first:pt-0 last:pb-0">
                    {/* Top-level comment */}
                    <div className="flex items-start gap-3">
                      <AvatarImg username={comment.username} avatarUrl={getAvatar(comment.username)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-brown-title/80">
                            @{comment.username}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {formatTime(comment.createdAt)}
                          </span>
                        </div>

                        {/* Inline edit or body */}
                        {isEditingThis ? (
                          <div className="mt-1.5">
                            <textarea
                              ref={editTextareaRef}
                              rows={3}
                              value={editing.draft}
                              onChange={(e) =>
                                setEditing((s) => s && { ...s, draft: e.target.value })
                              }
                              maxLength={1000}
                              className="w-full resize-none rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 text-[13px] leading-snug text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25"
                            />
                            {editing.error ? (
                              <p className="mt-1 text-[11px] text-rose-500">{editing.error}</p>
                            ) : null}
                            <div className="mt-1.5 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-[12px] text-neutral-400 transition hover:text-neutral-600"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                disabled={editing.saving || !editing.draft.trim()}
                                onClick={() => void submitEdit()}
                                className="rounded-lg bg-[#e891b0] px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-[#d4769a] disabled:opacity-50"
                              >
                                {editing.saving ? '保存中…' : '确认'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-[14px] leading-snug text-neutral-700 break-words">
                            {comment.body}
                          </p>
                        )}

                        {/* Action row */}
                        {!isEditingThis && (
                          <div className="mt-1.5 flex items-center gap-3">
                            {me && (
                              <button
                                type="button"
                                className="text-[11px] text-neutral-400 transition hover:text-[#e891b0]"
                                onClick={() => setReplyTo(comment)}
                              >
                                回复
                              </button>
                            )}
                            {me === comment.username && !hasReplies && (
                              <button
                                type="button"
                                className="text-[11px] text-neutral-400 transition hover:text-[#e891b0]"
                                onClick={() => startEdit(comment)}
                              >
                                编辑
                              </button>
                            )}
                            {me === comment.username && !hasReplies && (
                              <button
                                type="button"
                                className="text-[11px] text-neutral-300 transition hover:text-rose-400"
                                onClick={() => requestDelete(comment)}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <ul className="ml-11 mt-3 space-y-3 border-l-2 border-border-sweet/25 pl-3">
                        {comment.replies.map((reply) => {
                          const isEditingReply = editing?.commentId === reply.id;
                          return (
                            <li key={reply.id} className="flex items-start gap-2">
                              <AvatarImg
                                username={reply.username}
                                avatarUrl={getAvatar(reply.username)}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[12px] font-semibold text-brown-title/80">
                                    @{reply.username}
                                  </span>
                                  <span className="text-[11px] text-neutral-400">
                                    {formatTime(reply.createdAt)}
                                  </span>
                                </div>

                                {isEditingReply ? (
                                  <div className="mt-1.5">
                                    <textarea
                                      ref={editTextareaRef}
                                      rows={2}
                                      value={editing.draft}
                                      onChange={(e) =>
                                        setEditing((s) => s && { ...s, draft: e.target.value })
                                      }
                                      maxLength={1000}
                                      className="w-full resize-none rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 text-[13px] leading-snug text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25"
                                    />
                                    {editing.error ? (
                                      <p className="mt-1 text-[11px] text-rose-500">{editing.error}</p>
                                    ) : null}
                                    <div className="mt-1.5 flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="text-[12px] text-neutral-400 transition hover:text-neutral-600"
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        disabled={editing.saving || !editing.draft.trim()}
                                        onClick={() => void submitEdit()}
                                        className="rounded-lg bg-[#e891b0] px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-[#d4769a] disabled:opacity-50"
                                      >
                                        {editing.saving ? '保存中…' : '确认'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-[13px] leading-snug text-neutral-600 break-words">
                                    {reply.body}
                                  </p>
                                )}

                                {!isEditingReply && (
                                  <div className="mt-1 flex items-center gap-3">
                                    {me && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-neutral-400 transition hover:text-[#e891b0]"
                                        onClick={() => setReplyTo(comment)}
                                      >
                                        回复
                                      </button>
                                    )}
                                    {me === reply.username && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-neutral-400 transition hover:text-[#e891b0]"
                                        onClick={() => startEdit(reply)}
                                      >
                                        编辑
                                      </button>
                                    )}
                                    {me === reply.username && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-neutral-300 transition hover:text-rose-400"
                                        onClick={() => requestDelete(reply)}
                                      >
                                        删除
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Bottom spacing so last comment isn't hidden under compose bar */}
          <div className="h-4" />
        </div>
      </div>

      {/* Image preview */}
      {previewOpen && images.length > 0 && (
        <ImagePreviewDialog
          images={images}
          initialIdx={previewIdx}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Fixed compose at bottom */}
      {me ? (
        <CommentCompose
          entryId={entryId!}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={handleSent}
          myAvatarUrl={myAvatarUrl}
          myUsername={me}
        />
      ) : (
        <div className="border-t border-border-sweet/20 bg-white px-4 py-3 text-center text-[13px] text-neutral-400">
          登录后才能发评论哦～
        </div>
      )}

      <DangerConfirmModal
        open={deleteTarget !== null}
        onClose={cancelDelete}
        title={deleteTarget?.parentId ? '删除这条回复？' : '删除这条评论？'}
        description="删除后将无法恢复，确定要删掉吗？"
        confirmLabel="删除"
        pending={deletePending}
        pendingConfirmLabel="删除中…"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
