import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DailyEntry } from '@momoya/shared';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import { apiDelete, apiFetch } from '@/lib/api';
import DailyEntryLongPressRow from './DailyEntryLongPressRow';

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

/** 创建者（兼容旧数据仅有 updatedByUsername） */
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

type DailyLocationState = { focusEntryId?: string };

const Daily = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const me = user?.username;
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const r = await apiFetch<{ entries: DailyEntry[] }>('/api/daily/entries');
    setLoading(false);
    if (r.ok) {
      setEntries(r.data.entries);
    } else {
      setLoadError(r.error);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const runDeleteConfirmed = useCallback(async () => {
    if (!deleteTargetId) return;
    setDeletePending(true);
    const r = await apiDelete(`/api/daily/entries/${deleteTargetId}`);
    setDeletePending(false);
    setDeleteTargetId(null);
    if (r.ok) {
      await loadEntries();
    } else {
      window.alert(r.error);
    }
  }, [deleteTargetId, loadEntries]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [entries],
  );

  const focusEntryId = (location.state as DailyLocationState | null)?.focusEntryId;

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
    <div className="home-romance-bg min-h-tab-page">
      <div className="mx-auto w-[92%] max-w-md px-0 pb-5 pt-8 sm:pt-10">
        <header className="mb-8 text-center">
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
          <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-relaxed text-neutral-500">
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
              return (
                <li id={`daily-entry-${entry.id}`} key={entry.id} className="relative flex gap-3 sm:gap-4">
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
                  </DailyEntryLongPressRow>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

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
