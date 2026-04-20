import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { DailyEntriesPage, DailyEntry, DailyEntryKind } from '@momoya/shared';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import PageFooter from '@/components/ui/PageFooter';
import DailyCommentSection from '@/components/daily/DailyCommentSection';
import ReportEntryCard from '@/components/daily/ReportEntryCard';
import ReportReviewSheet from '@/components/daily/ReportReviewSheet';
import { apiDelete, apiFetch } from '@/lib/api';
import { resolveApiUrl } from '@/lib/api';
import { subscribeDailyEvents } from '@/lib/dailyEvents';
import { usePartnerAvatars } from '@/components/user';
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
  return entry.kind === 'report' ? `@${owner} 的报备` : `由 @${owner} 记录`;
}

function normalizeView(v: string | null): DailyEntryKind {
  return v === 'report' ? 'report' : 'daily';
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

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

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

// ─── Segmented control ─────────────────────────────────────────────────────────

/**
 * 「日常 / 报备」分段切换。
 *
 * 关键点：
 *   - active 背景丸子用 framer-motion 的 layoutId（spring 过渡），
 *     视觉上是一个小丸子在两个选项之间平滑滑动，而不是原来的"整块跳变"。
 *   - 容器背景色（粉 / 琥珀）也用一个绝对定位、跟随 value 淡出淡入的 Motion 层，
 *     避免整个 pill 颜色发生硬切导致的闪动。
 */
function ViewSegmented({
  value,
  onChange,
}: {
  value: DailyEntryKind;
  onChange: (next: DailyEntryKind) => void;
}) {
  const items: Array<{ key: DailyEntryKind; label: string }> = [
    { key: 'daily', label: '日常' },
    { key: 'report', label: '报备' },
  ];

  return (
    <div
      role="tablist"
      aria-label="切换日常与报备"
      className="relative mx-auto flex w-full max-w-[280px] items-center gap-1 overflow-hidden rounded-full p-1"
    >
      {/* 背景层：粉 ↔ 琥珀柔和过渡，避免硬切 */}
      <Motion.div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full"
        initial={false}
        animate={{
          backgroundColor:
            value === 'daily' ? 'rgba(253, 224, 235, 0.65)' : 'rgba(254, 235, 200, 0.65)',
        }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      />
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className="relative flex-1 rounded-full px-4 py-1.5 font-display text-[13px] font-semibold transition-colors"
          >
            {/* 滑动丸子：用 layoutId 让两个选项共享同一个丸子，formed → smooth slide */}
            {active && (
              <Motion.span
                layoutId="daily-view-seg-pill"
                aria-hidden
                className={`absolute inset-0 rounded-full bg-white ${
                  value === 'daily'
                    ? 'shadow-[0_4px_14px_rgb(249_172_201/0.42)]'
                    : 'shadow-[0_4px_14px_rgb(251_191_36/0.42)]'
                }`}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span
              className={`relative z-10 ${
                active
                  ? value === 'daily'
                    ? 'text-love'
                    : 'text-amber-600'
                  : 'text-brown-title/55'
              }`}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type DailyLocationState = { focusEntryId?: string; scrollToTop?: boolean };

type KindState = {
  entries: DailyEntry[];
  nextCursor: string | null;
  loaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  loadError: string;
};

function initialKindState(): KindState {
  return {
    entries: [],
    nextCursor: null,
    loaded: false,
    loading: false,
    loadingMore: false,
    loadError: '',
  };
}

// ─── Main component ────────────────────────────────────────────────────────────

const PAGE_LIMIT = 10;

const Daily = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const me = user?.username;
  const myAvatarUrl = user?.profile.avatarUrl || undefined;
  const resolveAvatar = usePartnerAvatars(me, myAvatarUrl);

  // 两份列表缓存：daily / report，各自独立分页与游标
  const [states, setStates] = useState<Record<DailyEntryKind, KindState>>(() => ({
    daily: initialKindState(),
    report: initialKindState(),
  }));
  // 用 ref 镜像一份，供 loadMore / SSE handler 等回调读取最新值时使用，
  // 避免把 states 放进 useCallback deps 造成频繁重建（IntersectionObserver 抖动）
  const statesRef = useRef(states);
  useEffect(() => {
    statesRef.current = states;
  }, [states]);

  // 视图来源：URL ?view= 为唯一真实数据源；没有 query 时兜底到用户偏好 / 'daily'。
  // 这里**不再维护 useState**——避免"URL 与状态双份同步"引入的切换闪烁和 "需要点两次" 问题。
  const queryView = normalizeView(searchParams.get('view'));
  const hasQuery = searchParams.get('view') !== null;
  const userDefaultView = user?.profile.dailyDefaultView;
  const view: DailyEntryKind = hasQuery ? queryView : (userDefaultView ?? 'daily');

  const currentState = states[view];
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [previewEntry, setPreviewEntry] = useState<DailyEntry | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);

  const [reviewSheetEntry, setReviewSheetEntry] = useState<DailyEntry | null>(null);

  const setKindState = useCallback(
    (kind: DailyEntryKind, update: (prev: KindState) => KindState) => {
      setStates((prev) => ({ ...prev, [kind]: update(prev[kind]) }));
    },
    [],
  );

  /** 第一页：替换 entries；游标重置 */
  const loadFirstPage = useCallback(
    async (kind: DailyEntryKind, silent = false) => {
      if (!silent) {
        setKindState(kind, (s) => ({ ...s, loading: true, loadError: '' }));
      } else {
        setKindState(kind, (s) => ({ ...s, loadError: '' }));
      }
      const r = await apiFetch<DailyEntriesPage>(
        `/api/daily/entries?kind=${kind}&limit=${PAGE_LIMIT}`,
      );
      setKindState(kind, (s) => {
        if (!r.ok) {
          return { ...s, loading: false, loadError: silent ? s.loadError : r.error };
        }
        return {
          ...s,
          entries: r.data.entries,
          nextCursor: r.data.nextCursor,
          loaded: true,
          loading: false,
          loadError: '',
        };
      });
    },
    [setKindState],
  );

  /** 后续页：追加，去重（按 id）。通过 statesRef 读取最新游标，避免把 states 放进 deps */
  const loadMore = useCallback(
    async (kind: DailyEntryKind) => {
      const s = statesRef.current[kind];
      if (s.loadingMore || !s.nextCursor) return;
      setKindState(kind, (x) => ({ ...x, loadingMore: true }));
      const r = await apiFetch<DailyEntriesPage>(
        `/api/daily/entries?kind=${kind}&limit=${PAGE_LIMIT}&cursor=${encodeURIComponent(s.nextCursor)}`,
      );
      setKindState(kind, (x) => {
        if (!r.ok) return { ...x, loadingMore: false };
        const ids = new Set(x.entries.map((e) => e.id));
        const fresh = r.data.entries.filter((e) => !ids.has(e.id));
        return {
          ...x,
          entries: [...x.entries, ...fresh],
          nextCursor: r.data.nextCursor,
          loadingMore: false,
        };
      });
    },
    [setKindState],
  );

  // 首次进入每个 kind 时加载第一页。loadFirstPage 内部会同步置 loading=true，
  // 结合下面对空态条件的 `loaded` 判断，可彻底消除切换视图时的三段抖动
  useEffect(() => {
    if (!currentState.loaded && !currentState.loading) {
      void loadFirstPage(view);
    }
  }, [view, currentState.loaded, currentState.loading, loadFirstPage]);

  /** 切换视图：直接写 URL。view 由 URL 派生，无需再 setState。 */
  const handleChangeView = useCallback(
    (next: DailyEntryKind) => {
      const nextParams = new URLSearchParams(searchParams);
      // **始终** 显式写入 view，避免"删除 query → 回落到默认偏好"被理解成"回到 report"的歧义
      nextParams.set('view', next);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /** 增量获取单个 entry 详情，用于 SSE 增量合并 */
  const fetchEntry = useCallback(async (id: string): Promise<DailyEntry | null> => {
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${id}`);
    return r.ok ? r.data.entry : null;
  }, []);

  /**
   * 按 at desc 把一条 entry upsert 到指定 kind 的列表：
   * - 先按 id 去重
   * - 再找到第一个 at 严格更早的位置插入；若没有（即新条目是"最老"或列表为空），
   *   追加到末尾。**不能直接丢弃**，否则新建/更新的条目会"消失"。
   */
  const upsertEntryByDate = useCallback(
    (kind: DailyEntryKind, entry: DailyEntry) => {
      setKindState(kind, (s) => {
        const without = s.entries.filter((e) => e.id !== entry.id);
        const ts = new Date(entry.at).getTime();
        const idx = without.findIndex((e) => new Date(e.at).getTime() < ts);
        const nextList =
          idx === -1 ? [...without, entry] : [...without.slice(0, idx), entry, ...without.slice(idx)];
        return { ...s, entries: nextList };
      });
    },
    [setKindState],
  );

  // SSE 增量同步
  useEffect(() => {
    return subscribeDailyEvents((event) => {
      if (event.type === 'entry.deleted') {
        (['daily', 'report'] as const).forEach((k) =>
          setKindState(k, (s) => ({ ...s, entries: s.entries.filter((e) => e.id !== event.entryId) })),
        );
        return;
      }
      if (
        event.type === 'entry.created' ||
        event.type === 'entry.updated' ||
        event.type === 'entry.acked' ||
        event.type === 'review.upserted' ||
        event.type === 'review.deleted'
      ) {
        void fetchEntry(event.entryId).then((entry) => {
          if (!entry) return;
          const kind: DailyEntryKind = entry.kind === 'report' ? 'report' : 'daily';
          // 若该 kind 的列表尚未加载过，不主动"先塞数据"——用户切过去时会 loadFirstPage 获取最新。
          // 已加载过的列表，统一走按 at desc upsert（同时覆盖创建/更新/已阅/评价变动）。
          const alreadyLoaded = statesRef.current[kind].loaded;
          if (!alreadyLoaded) return;
          upsertEntryByDate(kind, entry);
        });
      }
    });
  }, [fetchEntry, setKindState, upsertEntryByDate]);

  const runDeleteConfirmed = useCallback(async () => {
    if (!deleteTargetId) return;
    setDeletePending(true);
    const r = await apiDelete(`/api/daily/entries/${deleteTargetId}`);
    setDeletePending(false);
    setDeleteTargetId(null);
    if (r.ok) {
      (['daily', 'report'] as const).forEach((k) =>
        setKindState(k, (s) => ({ ...s, entries: s.entries.filter((e) => e.id !== deleteTargetId) })),
      );
    } else {
      window.alert((r as { ok: false; error: string }).error);
    }
  }, [deleteTargetId, setKindState]);

  const sortedEntries = useMemo(
    () =>
      [...currentState.entries].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      ),
    [currentState.entries],
  );

  // 触底加载
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!currentState.nextCursor) return;
    const root =
      (node.closest('[data-tab-pane]') as HTMLElement | null) ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (ent?.isIntersecting) {
          void loadMore(view);
        }
      },
      { root, rootMargin: '300px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentState.nextCursor, loadMore, view, sortedEntries.length]);

  const locationState = location.state as DailyLocationState | null;
  const focusEntryId = locationState?.focusEntryId;
  const wantScrollTop = locationState?.scrollToTop;

  // 清理 history state 时要保留当前 ?view= ，否则"空 query + 默认偏好" 可能把视图拉回去
  const cleanedDailyUrl = `/daily?view=${view}`;

  useEffect(() => {
    if (!wantScrollTop) return;
    const container = document.querySelector<HTMLElement>('[data-tab-pane="daily"]');
    if (container) container.scrollTo({ top: 0, behavior: 'auto' });
    navigate(cleanedDailyUrl, { replace: true, state: {} });
  }, [wantScrollTop, navigate, cleanedDailyUrl]);

  useEffect(() => {
    if (!focusEntryId || currentState.loading) return;
    if (!sortedEntries.some((e) => e.id === focusEntryId)) {
      navigate(cleanedDailyUrl, { replace: true, state: {} });
      return;
    }
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`daily-entry-${focusEntryId}`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      navigate(cleanedDailyUrl, { replace: true, state: {} });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusEntryId, currentState.loading, sortedEntries, navigate, cleanedDailyUrl]);

  const handleEditEntry = (entry: DailyEntry) => {
    const path =
      entry.kind === 'report'
        ? `/daily/${entry.id}/report/edit`
        : `/daily/${entry.id}/edit`;
    navigate(path);
  };

  const isReport = view === 'report';
  const title = isReport ? '小报备' : '小日常';
  const subtitle = isReport
    ? '贴一张小条子给 ta，让 ta 安心'
    : '把心动与琐碎，按日子排成一条线。';
  const emptyTip = isReport ? '去给 ta 贴一张小条子吧' : '去写下第一条吧';
  const footerHasItems = isReport ? '每一张便签，都是一次小小的拥抱' : '每一笔，都是我们之间的痕迹';

  const labelClass = isReport ? 'text-[#b45438]' : 'text-love/75';
  const dividerGradient = isReport
    ? 'bg-gradient-to-r from-transparent via-[#b45438]/45 to-transparent'
    : 'bg-gradient-to-r from-transparent via-love/45 to-transparent';
  const bulletClass = 'from-love to-[#f080a8] shadow-[0_2px_8px_rgb(249_172_201/0.45)] ring-2 ring-love/20';
  const tagChipClass = 'border-love/20 bg-love/12';

  return (
    <div className="relative min-h-full">
      {/*
        背景层用 fixed 固定在视口：这样无论列表多长、滚动到哪里，
        甚至 TabPane 底部的 pb-app-bottom-tab 空白区，都能被当前视图的背景完整覆盖。
        放在 Daily 内，才能随 isReport 切换；用 -z-10 保证不遮挡任何交互元素。
      */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 -z-10 ${
          isReport ? 'report-desk-bg' : 'home-romance-bg'
        }`}
      />
      <div className="mx-auto w-[92%] max-w-md px-0 pt-7 sm:pt-9">
        <header className="mb-5 text-center sm:mb-6">
          <div className="mx-auto inline-flex flex-col items-center">
            <span className={`font-display text-[11px] font-semibold tracking-[0.22em] ${labelClass}`}>
              {isReport ? '便签墙' : '时间线'}
            </span>
            <div className={`mt-2 h-px w-12 sm:w-14 ${dividerGradient}`} aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-bold tracking-wide text-brown-title sm:text-[1.7rem]">
              {title}
            </h1>
          </div>
          <p className="mx-auto mt-2.5 max-w-[19rem] text-sm leading-relaxed text-neutral-500">
            {subtitle}
          </p>
        </header>

        <div className="mb-6 sm:mb-7">
          <ViewSegmented value={view} onChange={handleChangeView} />
        </div>

        {currentState.loadError ? (
          <p className="mb-4 text-center text-sm text-rose-600">{currentState.loadError}</p>
        ) : null}
        {/* "!loaded" 也视作加载中，覆盖切换视图瞬间 effect 还未跑完的那一帧 */}
        {(currentState.loading || (!currentState.loaded && !currentState.loadError)) ? (
          <p className="text-center text-sm text-neutral-500">加载中…</p>
        ) : null}

        <div className="relative min-h-[40vh]">
          {!isReport && (
            <div
              className="daily-timeline-line pointer-events-none absolute left-5 top-7 bottom-6 w-[3px] -translate-x-1/2 rounded-full sm:left-5"
              aria-hidden
            />
          )}

          <ol className={`relative ${isReport ? 'space-y-5' : 'space-y-8 sm:space-y-9'}`}>
            {sortedEntries.map((entry, entryIdx) => {
              const owner = recordOwner(entry);
              const mine = canManageEntry(entry, me);
              const caption = ownerCaption(entry);
              const images = entry.images ?? [];
              const reportKind = entry.kind === 'report';

              if (reportKind) {
                const tilt: 'left' | 'right' | 'none' = entryIdx % 3 === 0 ? 'left' : entryIdx % 3 === 1 ? 'right' : 'none';
                return (
                  <li id={`daily-entry-${entry.id}`} key={entry.id} className="relative">
                    <DailyEntryLongPressRow
                      mine={mine}
                      onEdit={() => handleEditEntry(entry)}
                      onDelete={() => setDeleteTargetId(entry.id)}
                    >
                      <ReportEntryCard
                        entry={entry}
                        me={me}
                        resolveAvatar={resolveAvatar}
                        tilt={tilt}
                        onPreview={(idx) => {
                          setPreviewEntry(entry);
                          setPreviewIdx(idx);
                        }}
                        onOpenReview={() => setReviewSheetEntry(entry)}
                      />
                    </DailyEntryLongPressRow>
                  </li>
                );
              }

              return (
                <li
                  id={`daily-entry-${entry.id}`}
                  key={entry.id}
                  className="relative flex gap-3 sm:gap-4"
                >
                  <div className="relative z-[1] flex w-10 shrink-0 flex-col items-center pt-1.5 sm:w-11">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-[2.5px] border-white bg-gradient-to-br sm:h-[18px] sm:w-[18px] ${bulletClass}`}
                      aria-hidden
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 opacity-90" />
                    </span>
                  </div>

                  <DailyEntryLongPressRow
                    mine={mine}
                    onEdit={() => handleEditEntry(entry)}
                    onDelete={() => setDeleteTargetId(entry.id)}
                  >
                    <EntryHeader entry={entry} owner={owner} caption={caption} tagChipClass={tagChipClass} />
                    <p className="mt-3 text-[15px] leading-[1.75] text-neutral-600 sm:text-base sm:leading-relaxed">
                      {entry.body}
                    </p>
                    {images.length > 0 && (
                      <EntryImageGrid
                        images={images}
                        onPreview={(idx) => {
                          setPreviewEntry(entry);
                          setPreviewIdx(idx);
                        }}
                      />
                    )}
                    <DailyCommentSection entryId={entry.id} resolveAvatar={resolveAvatar} />
                  </DailyEntryLongPressRow>
                </li>
              );
            })}
          </ol>

          {currentState.nextCursor ? (
            <div ref={sentinelRef} className="pt-6 pb-2 text-center text-[12px] text-neutral-400">
              {currentState.loadingMore ? '加载中…' : '下拉加载更多'}
            </div>
          ) : sortedEntries.length > PAGE_LIMIT ? (
            <p className="pt-6 text-center text-[12px] text-neutral-300">— 到底啦 —</p>
          ) : null}
        </div>

        {sortedEntries.length > 0 ? (
          <PageFooter text={footerHasItems} />
        ) : currentState.loaded && !currentState.loading && !currentState.loadError ? (
          <PageFooter text={emptyTip} />
        ) : null}
      </div>

      {previewEntry && (
        <ImagePreviewDialog
          images={previewEntry.images ?? []}
          initialIdx={previewIdx}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      {reviewSheetEntry && (
        <ReportReviewSheet
          open
          entry={reviewSheetEntry}
          me={me}
          resolveAvatar={resolveAvatar}
          onClose={() => setReviewSheetEntry(null)}
          onEntryChange={(next) => {
            setReviewSheetEntry(next);
            setKindState('report', (s) => ({
              ...s,
              entries: s.entries.map((e) => (e.id === next.id ? next : e)),
            }));
          }}
        />
      )}

      {/* 新建 FAB：根据当前视图跳到对应 compose 页 */}
      <button
        type="button"
        aria-label={isReport ? '写一条报备' : '记一条日常'}
        onClick={() => navigate(isReport ? '/daily/report/new' : '/daily/new')}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full text-white transition active:scale-95 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] ${
          isReport
            ? 'bg-amber-500 shadow-[0_10px_28px_rgb(245_158_11/0.42)] hover:bg-amber-600'
            : 'bg-[#e891b0] shadow-[0_10px_28px_rgb(232_145_176/0.42)] hover:bg-[#d4769a]'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
        </svg>
      </button>

      <DangerConfirmModal
        open={deleteTargetId !== null}
        onClose={() => {
          if (!deletePending) setDeleteTargetId(null);
        }}
        title="删除这条记录？"
        description="删除后将无法恢复，确定要删掉吗？"
        confirmLabel="删除"
        pending={deletePending}
        pendingConfirmLabel="删除中…"
        onConfirm={() => void runDeleteConfirmed()}
      />
    </div>
  );
};

function EntryHeader({
  entry,
  owner,
  caption,
  tagChipClass,
}: {
  entry: DailyEntry;
  owner: string | undefined;
  caption: string | null;
  tagChipClass: string;
}) {
  return (
    <>
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
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-brown-title/85 sm:text-xs ${tagChipClass}`}
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
        <p className="mt-1 text-[11px] text-neutral-400">最后由 @{entry.updatedByUsername} 更新</p>
      ) : null}
    </>
  );
}

export default Daily;
