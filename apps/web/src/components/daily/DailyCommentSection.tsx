import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyComment } from '@momoya/shared';
import { apiFetch } from '@/lib/api';
import { subscribeDailyEvents } from '@/lib/dailyEvents';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  entryId: string;
  /** Sheet 或页面关闭后可由外部回传最新数量（可选） */
  countOverride?: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DailyCommentSection({ entryId, countOverride }: Props) {
  const navigate = useNavigate();
  const [comments, setComments] = useState<DailyComment[]>([]);
  const [localCount, setLocalCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadComments = useCallback(async () => {
    const r = await apiFetch<{ comments: DailyComment[] }>(
      `/api/daily/entries/${entryId}/comments`,
    );
    if (r.ok) {
      setComments(r.data.comments);
      setLocalCount(r.data.comments.length);
      setLoaded(true);
    }
  }, [entryId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  // 实时同步：本条目下的评论增/删/改时静默刷新预览
  useEffect(() => {
    return subscribeDailyEvents((event) => {
      if (
        (event.type === 'comment.created' ||
          event.type === 'comment.deleted' ||
          event.type === 'comment.updated') &&
        event.entryId === entryId
      ) {
        void loadComments();
      }
    });
  }, [entryId, loadComments]);

  const count = countOverride ?? localCount;
  const countLabel =
    count === null ? '评论' : count === 0 ? '写评论' : `${count} 条评论`;

  // Latest 2 top-level comments as preview
  const preview = loaded ? comments.filter((c) => !c.parentId).slice(-2) : [];

  const goToComments = () => navigate(`/daily/${entryId}/comments`);

  return (
    <div className="mt-3 border-t border-border-sweet/20 pt-2.5">
      {/* Trigger row */}
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left text-[12px] font-medium text-neutral-400 transition hover:text-[#e891b0]"
        onClick={goToComments}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-[14px] w-[14px] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="flex-1">{countLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Preview rows — latest 2 top-level comments, single-line truncated */}
      {preview.length > 0 && (
        <ul className="mt-2 space-y-1">
          {preview.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-1.5 text-left"
                onClick={goToComments}
              >
                <span className="shrink-0 text-[11px] font-semibold text-[#e891b0]">
                  @{c.username}
                </span>
                <span className="truncate text-[12px] text-neutral-500">{c.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
