import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LONG_MS = 520;
const MOVE_CANCEL = 14;

type Props = {
  mine: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  children: React.ReactNode;
};

/** 本人条目：长按弹出底部操作层（无横向拖拽，减少与系统手势冲突）。 */
export default function DailyEntryLongPressRow({ mine, onEdit, onDelete, children }: Props) {
  const sheetId = useId().replace(/:/g, '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const pressGen = useRef(0);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen, closeSheet]);

  const onPointerDownCard = (e: React.PointerEvent) => {
    if (!mine || e.button !== 0) return;
    const myGen = ++pressGen.current;
    const startX = e.clientX;
    const startY = e.clientY;
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      if (pressGen.current !== myGen) return;
      setSheetOpen(true);
    }, LONG_MS);

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) cleanup();
    };

    const onUp = () => cleanup();

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
  };

  if (!mine) {
    return (
      <article className="daily-entry-card relative min-w-0 flex-1 px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
        {children}
      </article>
    );
  }

  const sheet = sheetOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[2000] flex flex-col justify-end bg-black/20 backdrop-blur-[1px] transition-opacity duration-200"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeSheet();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${sheetId}-title`}
            className="mx-auto w-full max-w-md translate-y-0 opacity-100 transition-[transform,opacity] duration-200 ease-out"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="rounded-t-[26px] border border-b-0 border-border-sweet/40 bg-gradient-to-b from-white via-white to-rose-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_40px_rgb(249_172_201/0.18)]">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200/90" aria-hidden />
              <p id={`${sheetId}-title`} className="text-center font-display text-sm font-semibold text-brown-title">
                这条日常
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  className="w-full rounded-xl border border-border-sweet/65 bg-white/95 py-3.5 text-sm font-semibold text-love shadow-sm transition hover:border-love/45 hover:bg-rose-50/50 hover:shadow-[0_2px_12px_rgb(249_172_201/0.2)]"
                  onClick={() => {
                    closeSheet();
                    onEdit();
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border-sweet/65 bg-white/95 py-3.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:border-rose-300/55 hover:bg-rose-50/70 hover:shadow-[0_2px_12px_rgb(251_113_133/0.12)]"
                  onClick={() => {
                    closeSheet();
                    void onDelete();
                  }}
                >
                  删除
                </button>
                <button
                  type="button"
                  className="w-full py-2.5 text-sm text-neutral-500 transition hover:text-neutral-800"
                  onClick={closeSheet}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <article
        className="daily-entry-card relative min-w-0 flex-1 select-none touch-manipulation px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4"
        onPointerDown={onPointerDownCard}
      >
        {children}
      </article>
      {sheet}
    </>
  );
}
