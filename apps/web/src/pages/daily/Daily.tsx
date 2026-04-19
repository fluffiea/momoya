import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DailyEntriesPage, DailyEntry } from '@momoya/shared';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import PageFooter from '@/components/ui/PageFooter';
import DailyCommentSection from '@/components/daily/DailyCommentSection';
import { apiDelete, apiFetch } from '@/lib/api';
import { resolveApiUrl } from '@/lib/api';
import { subscribeDailyEvents } from '@/lib/dailyEvents';
import DailyEntryLongPressRow from './DailyEntryLongPressRow';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatEntryWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timePart = d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

function recordOwner(entry: DailyEntry): string | undefined {
  const a = entry.createdByUsername?.trim();
  const b = entry.updatedByUsername?.trim();
  return a || b || undefined;
}

function canManageEntry(entry: DailyEntry, me: string | undefined): boolean {
  if (!me) return false;
  return recordOwner(entry) === me;
}

function ownerCaption(entry: DailyEntry): string | null {
  const owner = recordOwner(entry);
  if (!owner) return null;
  if (owner === 'system') return '共读纪念';
  return `由 @${owner} 记录`;
}

// ─── Image grid ────────────────────────────────────────────────────────────────

function EntryImageGrid({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (idx: number) => void;
}) {
  if (!images || images.length === 0) return null;

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

// ─── Full-screen image preview ─────────────────────────────────────────────────

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

  // 锁定 body 滚动，防止预览背后页面跟着滚
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // 用 portal 挂到 body：跳出 TabPane(z-1) 的 stacking context，
  // 否则无论 dialog 自身 z-index 多高，外部看到的整个 TabPane 仍是 z-1，
  // 始终被 portal 到 body 的 BottomTabBar(z-100) 压在下面。
  return createPortal(
    <dialog
      open
      className="fixed inset-0 z-[1500] m-0 flex h-full w-full max-w-none items-center justify-center bg-black/90 p-0 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-screen max-w-full flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          aria-label="关闭预览"
          className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          onClick={onClose}
        >
          ×
        </button>

        {/* Image */}
        <img
          src={resolveApiUrl(images[idx])}
          alt=""
          className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
        />

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="上一张"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="下一张"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              ›
            </button>
            <p className="mt-3 text-[12px] text-white/60">
              {idx + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type DailyLocationState = { focusEntryId?: string; scrollToTop?: boolean };

// ─── Main component ────────────────────────────────────────────────────────────

const PAGE_LIMIT = 10;

const Daily = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const me = user?.username;
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  // Image preview state
  const [previewEntry, setPreviewEntry] = useState<DailyEntry | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  /** 第一页：替换 entries；游标重置 */
  const loadFirstPage = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    const r = await apiFetch<DailyEntriesPage>(`/api/daily/entries?limit=${PAGE_LIMIT}`);
    if (!silent) setLoading(false);
    if (r.ok) {
      setEntries(r.data.entries);
      setNextCursor(r.data.nextCursor);
    } else if (!silent) {
      setLoadError(r.error);
    }
  }, []);

  /** 后续页：追加，去重（按 id） */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    if (!nextCursor) return;
    setLoadingMore(true);
    const r = await apiFetch<DailyEntriesPage>(
      `/api/daily/entries?limit=${PAGE_LIMIT}&cursor=${encodeURIComponent(nextCursor)}`,
    );
    setLoadingMore(false);
    if (r.ok) {
      setEntries((prev) => {
        const ids = new Set(prev.map((e) => e.id));
        const fresh = r.data.entries.filter((e) => !ids.has(e.id));
        return [...prev, ...fresh];
      });
      setNextCursor(r.data.nextCursor);
    }
  }, [loadingMore, nextCursor]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  // 持久化 Tab 下，组件不会卸载。从二级页返回时不再做整页 refresh，
  // 而是依赖 SSE entry.* 事件做增量同步，从而保留分页与滚动位置。

  /** 增量获取单个 entry 详情，用于 SSE 增量合并 */
  const fetchEntry = useCallback(async (id: string): Promise<DailyEntry | null> => {
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${id}`);
    return r.ok ? r.data.entry : null;
  }, []);

  /** 把单条 entry 按 at desc 顺序合并进当前列表（已存在则替换） */
  const upsertEntryByDate = useCallback((entry: DailyEntry) => {
    setEntries((prev) => {
      const without = prev.filter((e) => e.id !== entry.id);
      const ts = new Date(entry.at).getTime();
      const idx = without.findIndex((e) => new Date(e.at).getTime() < ts);
      if (idx === -1) {
        // 比所有都旧：只在已经加载到底（无 nextCursor）时才追加，否则它属于尚未加载的尾部
        return without;
      }
      const next = [...without];
      next.splice(idx, 0, entry);
      return next;
    });
  }, []);

  // 实时同步：增量处理 entry 事件，避免破坏分页/滚动位置
  useEffect(() => {
    return subscribeDailyEvents((event) => {
      if (event.type === 'entry.deleted') {
        setEntries((prev) => prev.filter((e) => e.id !== event.entryId));
      } else if (event.type === 'entry.created') {
        // 新建一定是最新的（at 最大），插到最前
        void fetchEntry(event.entryId).then((entry) => {
          if (!entry) return;
          setEntries((prev) => {
            if (prev.some((e) => e.id === entry.id)) return prev;
            return [entry, ...prev];
          });
        });
      } else if (event.type === 'entry.updated') {
        void fetchEntry(event.entryId).then((entry) => {
          if (!entry) return;
          // 仅更新已经在列表里的条目；不在列表中的（属于未加载的旧页）忽略
          setEntries((prev) => {
            if (!prev.some((e) => e.id === entry.id)) return prev;
            return prev.map((e) => (e.id === entry.id ? entry : e));
          });
          // 编辑时间可能变化，用 upsert 保持顺序
          upsertEntryByDate(entry);
        });
      }
    });
  }, [fetchEntry, upsertEntryByDate]);

  const runDeleteConfirmed = useCallback(async () => {
    if (!deleteTargetId) return;
    setDeletePending(true);
    const r = await apiDelete(`/api/daily/entries/${deleteTargetId}`);
    setDeletePending(false);
    setDeleteTargetId(null);
    if (r.ok) {
      // 删除自己的条目：本地直接移除，无需整页 refetch
      setEntries((prev) => prev.filter((e) => e.id !== deleteTargetId));
    } else {
      window.alert((r as { ok: false; error: string }).error);
    }
  }, [deleteTargetId]);

  // 后端已按 at desc 返回；这里仅做兜底排序，避免 SSE 合并出现轻微乱序
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [entries],
  );

  // 触底加载：用 IntersectionObserver 监听 sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!nextCursor) return;
    // 找到该 Tab 的滚动容器作为 root；找不到则退化为 viewport
    const root =
      (node.closest('[data-tab-pane]') as HTMLElement | null) ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (ent?.isIntersecting) {
          void loadMore();
        }
      },
      { root, rootMargin: '300px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loadMore, sortedEntries.length]);

  const locationState = location.state as DailyLocationState | null;
  const focusEntryId = locationState?.focusEntryId;
  const wantScrollTop = locationState?.scrollToTop;

  // 处理「新建后回到日常顶部」：找到 daily Tab 的滚动容器并将 scrollTop 置 0
  useEffect(() => {
    if (!wantScrollTop) return;
    const container = document.querySelector<HTMLElement>('[data-tab-pane="daily"]');
    if (container) container.scrollTo({ top: 0, behavior: 'auto' });
    navigate('/daily', { replace: true, state: {} });
  }, [wantScrollTop, navigate]);

  useEffect(() => {
    if (!focusEntryId || loading) return;
    if (!sortedEntries.some((e) => e.id === focusEntryId)) {
      navigate('/daily', { replace: true, state: {} });
      return;
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`daily-entry-${focusEntryId}`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      navigate('/daily', { replace: true, state: {} });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusEntryId, loading, sortedEntries, navigate]);

  return (
    <div className="home-romance-bg min-h-full">
      <div className="mx-auto w-[92%] max-w-md px-0 pt-7 sm:pt-9">
        <header className="mb-6 text-center sm:mb-7">
          <div className="mx-auto inline-flex flex-col items-center">
            <span className="font-display text-[11px] font-semibold tracking-[0.22em] text-love/75">
              时间线
            </span>
            <div
              className="mt-2 h-px w-12 bg-gradient-to-r from-transparent via-love/45 to-transparent sm:w-14"
              aria-hidden
            />
            <h1 className="mt-3 font-display text-2xl font-bold tracking-wide text-brown-title sm:text-[1.7rem]">
              小日常
            </h1>
          </div>
          <p className="mx-auto mt-2.5 max-w-[19rem] text-sm leading-relaxed text-neutral-500">
            把心动与琐碎，按日子排成一条线。
          </p>
        </header>

        {loadError ? (
          <p className="mb-4 text-center text-sm text-rose-600">{loadError}</p>
        ) : null}
        {loading ? (
          <p className="text-center text-sm text-neutral-500">加载中…</p>
        ) : null}

        <div className="relative">
          <div
            className="daily-timeline-line pointer-events-none absolute left-5 top-7 bottom-6 w-[3px] -translate-x-1/2 rounded-full sm:left-5"
            aria-hidden
          />

          <ol className="relative space-y-8 sm:space-y-9">
            {sortedEntries.map((entry) => {
              const owner = recordOwner(entry);
              const mine = canManageEntry(entry, me);
              const caption = ownerCaption(entry);
              const images = entry.images ?? [];
              return (
                <li
                  id={`daily-entry-${entry.id}`}
                  key={entry.id}
                  className="relative flex gap-3 sm:gap-4"
                >
                  <div className="relative z-[1] flex w-10 shrink-0 flex-col items-center pt-1.5 sm:w-11">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full border-[2.5px] border-white bg-gradient-to-br from-love to-[#f080a8] shadow-[0_2px_8px_rgb(249_172_201/0.45)] ring-2 ring-love/20 sm:h-[18px] sm:w-[18px]"
                      aria-hidden
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 opacity-90" />
                    </span>
                  </div>

                  <DailyEntryLongPressRow
                    mine={mine}
                    onEdit={() => navigate(`/daily/${entry.id}/edit`)}
                    onDelete={() => setDeleteTargetId(entry.id)}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
                      <time
                        className="inline-block font-display text-[13px] font-semibold tabular-nums tracking-wide text-brown-title/70 sm:text-sm"
                        dateTime={entry.at}
                      >
                        {formatEntryWhen(entry.at)}
                      </time>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full border border-love/20 bg-love/12 px-2.5 py-0.5 text-[11px] font-medium text-brown-title/85 sm:text-xs"
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {caption ? (
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {caption}
                        {entry.updatedByUsername && entry.updatedByUsername !== owner ? (
                          <> · 最后由 @{entry.updatedByUsername} 更新</>
                        ) : null}
                      </p>
                    ) : entry.updatedByUsername ? (
                      <p className="mt-1 text-[11px] text-neutral-400">
                        最后由 @{entry.updatedByUsername} 更新
                      </p>
                    ) : null}

                    <p className="mt-3 text-[15px] leading-[1.75] text-neutral-600 sm:text-base sm:leading-relaxed">
                      {entry.body}
                    </p>

                    {/* Image grid */}
                    {images.length > 0 && (
                      <EntryImageGrid
                        images={images}
                        onPreview={(idx) => {
                          setPreviewEntry(entry);
                          setPreviewIdx(idx);
                        }}
                      />
                    )}

                    {/* Comment preview row */}
                    <DailyCommentSection entryId={entry.id} />
                  </DailyEntryLongPressRow>
                </li>
              );
            })}
          </ol>

          {/* 触底加载哨兵：进入视口时拉下一页 */}
          {nextCursor ? (
            <div ref={sentinelRef} className="pt-6 pb-2 text-center text-[12px] text-neutral-400">
              {loadingMore ? '加载中…' : '下拉加载更多'}
            </div>
          ) : sortedEntries.length > PAGE_LIMIT ? (
            <p className="pt-6 text-center text-[12px] text-neutral-300">— 到底啦 —</p>
          ) : null}
        </div>

        {sortedEntries.length > 0 ? (
          <PageFooter text="每一笔，都是我们之间的痕迹" />
        ) : !loading && !loadError ? (
          <PageFooter text="去写下第一条吧" />
        ) : null}
      </div>

      {/* Full-screen image preview */}
      {previewEntry && (
        <ImagePreviewDialog
          images={previewEntry.images ?? []}
          initialIdx={previewIdx}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      <DangerConfirmModal
        open={deleteTargetId !== null}
        onClose={() => {
          if (!deletePending) setDeleteTargetId(null);
        }}
        title="删除这条日常？"
        description="删除后将无法恢复，确定要删掉吗？"
        confirmLabel="删除"
        pending={deletePending}
        pendingConfirmLabel="删除中…"
        onConfirm={() => void runDeleteConfirmed()}
      />
    </div>
  );
};

export default Daily;
