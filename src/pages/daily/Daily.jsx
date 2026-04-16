import { useMemo } from 'react';
import { dailyEntriesMock, sortDailyEntriesDesc } from './dailyFeed';

function formatEntryWhen(iso) {
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

const Daily = () => {
  const entries = useMemo(
    () => sortDailyEntriesDesc(dailyEntriesMock),
    [],
  );

  return (
    <div className="home-romance-bg min-h-tab-page">
      <div className="mx-auto w-[92%] max-w-md px-0 pb-10 pt-8 sm:pt-10">
        <header className="mb-8 text-center">
          <div className="mx-auto inline-flex flex-col items-center">
            <span className="font-display text-[11px] font-semibold tracking-[0.22em] text-love/75">
              时间线
            </span>
            <div className="mt-2 h-px w-12 bg-gradient-to-r from-transparent via-love/45 to-transparent sm:w-14" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-bold tracking-wide text-brown-title sm:text-[1.7rem]">
              小日常
            </h1>
          </div>
          <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-relaxed text-neutral-500">
            把心动与琐碎，按日子排成一条线。
          </p>
        </header>

        <div className="relative">
          {/* 中轴渐变线：与圆点对齐 */}
          <div
            className="daily-timeline-line pointer-events-none absolute left-5 top-7 bottom-6 w-[3px] -translate-x-1/2 rounded-full sm:left-5"
            aria-hidden
          />

          <ol className="relative space-y-8 sm:space-y-9">
            {entries.map((entry) => (
              <li key={entry.id} className="relative flex gap-3 sm:gap-4">
                <div className="relative z-[1] flex w-10 shrink-0 flex-col items-center pt-1.5 sm:w-11">
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full border-[2.5px] border-white bg-gradient-to-br from-love to-[#f080a8] shadow-[0_2px_8px_rgb(249_172_201/0.45)] ring-2 ring-love/20 sm:h-[18px] sm:w-[18px]"
                    aria-hidden
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90 opacity-90" />
                  </span>
                </div>

                <article className="daily-entry-card min-w-0 flex-1 px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
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
                  <p className="mt-3 text-[15px] leading-[1.75] text-neutral-600 sm:text-base sm:leading-relaxed">
                    {entry.body}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Daily;
