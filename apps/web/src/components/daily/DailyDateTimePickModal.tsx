import { useEffect, useId, useLayoutEffect, useState, type CSSProperties } from 'react';
import * as Select from '@radix-ui/react-select';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import Modal from '@/components/ui/Modal';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function parseYMDToDate(s: string): Date {
  const parts = s.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 本地日历日的 0 点 */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** a 的日历日是否严格晚于 b 的日历日 */
function isLocalDayAfter(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() > startOfLocalDay(b).getTime();
}

/** 当所选日为「今天」时，将时分钳到不晚于 now */
function clampTimeToNow(forDay: Date, h: number, m: number, now = new Date()): { h: number; m: number } {
  if (!isSameLocalDay(forDay, now)) return { h, m };
  const ch = now.getHours();
  const cm = now.getMinutes();
  if (h < ch) return { h, m };
  if (h > ch) return { h: ch, m: cm };
  if (m > cm) return { h: ch, m: cm };
  return { h, m };
}

function parseTimeParts(t: string): { h: number; m: number } {
  const [a, b] = t.split(':').map((x) => parseInt(x, 10));
  return {
    h: Number.isFinite(a) ? Math.min(23, Math.max(0, a)) : 12,
    m: Number.isFinite(b) ? Math.min(59, Math.max(0, b)) : 0,
  };
}

/** 与登录页 Radix Select 同系，保证弹层风格一致 */
const timeTriggerClass =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border-sweet/60 bg-white/95 px-3 text-left text-sm font-medium tabular-nums text-brown-title/90 outline-none transition data-[placeholder]:text-neutral-400 focus:border-love/50 focus:ring-2 focus:ring-love/25';

const timeContentClass =
  'z-[1150] overflow-hidden rounded-xl border border-border-sweet/45 bg-white/98 shadow-[0_8px_32px_rgb(249_172_201/0.22)] ring-1 ring-love/10';

const timeItemClass =
  'relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-[13px] tabular-nums text-brown-title/90 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-rose-50/90 data-[state=checked]:bg-love/12 data-[state=checked]:font-semibold data-[state=checked]:text-love';

function ChevronDown() {
  return (
    <Select.Icon className="shrink-0 text-love/55" aria-hidden>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </Select.Icon>
  );
}

function TimeUnitSelect({
  label,
  value,
  onValueChange,
  options,
  formatOption,
}: {
  label: string;
  value: number;
  onValueChange: (n: number) => void;
  options: number[];
  formatOption: (n: number) => string;
}) {
  return (
    <div>
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-brown-title/55">{label}</span>
      <Select.Root value={String(value)} onValueChange={(v) => onValueChange(parseInt(v, 10))}>
        <Select.Trigger className={timeTriggerClass} aria-label={label}>
          <Select.Value>{formatOption(value)}</Select.Value>
          <ChevronDown />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className={`${timeContentClass} min-w-[var(--radix-select-trigger-width)]`}
            position="popper"
            sideOffset={6}
            align="start"
          >
            <Select.Viewport className="max-h-56 overflow-y-auto p-1">
              {options.map((n) => (
                <Select.Item key={n} value={String(n)} className={timeItemClass}>
                  <Select.ItemText>{formatOption(n)}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  atDate: string;
  atTime: string;
  onConfirm: (next: { atDate: string; atTime: string }) => void;
};

export default function DailyDateTimePickModal({ open, onClose, atDate, atTime, onConfirm }: Props) {
  const titleId = useId();
  const [draftDate, setDraftDate] = useState<Date>(() => new Date());
  const [draftHour, setDraftHour] = useState(12);
  const [draftMinute, setDraftMinute] = useState(0);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    let d = atDate ? parseYMDToDate(atDate) : now;
    if (isLocalDayAfter(d, now)) d = startOfLocalDay(now);
    let { h, m } = parseTimeParts(atTime || '12:00');
    ({ h, m } = clampTimeToNow(d, h, m, now));
    setDraftDate(d);
    setDraftHour(h);
    setDraftMinute(m);
  }, [open, atDate, atTime]);

  useLayoutEffect(() => {
    if (!open) return;
    const now = new Date();
    const { h, m } = clampTimeToNow(draftDate, draftHour, draftMinute, now);
    if (h !== draftHour || m !== draftMinute) {
      setDraftHour(h);
      setDraftMinute(m);
    }
  }, [open, draftDate, draftHour, draftMinute]);

  const handleConfirm = () => {
    const now = new Date();
    let d = draftDate;
    if (isLocalDayAfter(d, now)) d = startOfLocalDay(now);
    const { h, m } = clampTimeToNow(d, draftHour, draftMinute, now);
    onConfirm({
      atDate: dateToYMD(d),
      atTime: `${pad2(h)}:${pad2(m)}`,
    });
    onClose();
  };

  const now = new Date();
  const clockH = now.getHours();
  const clockM = now.getMinutes();
  const todayMax = isSameLocalDay(draftDate, now);
  const maxHour = todayMax ? clockH : 23;
  const maxMinute = todayMax && draftHour === clockH ? clockM : 59;

  const hourOptions = Array.from({ length: maxHour + 1 }, (_, i) => i);
  let minuteOptions: number[];
  if (!todayMax) minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  else if (draftHour < clockH) minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  else if (draftHour > clockH) minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  else minuteOptions = Array.from({ length: maxMinute + 1 }, (_, i) => i);

  return (
    <Modal
      visible={open}
      onClose={onClose}
      width="min(92%, 22rem)"
      panelScrollable={false}
      closeOnBackdropClick
      ariaLabelledBy={titleId}
      backdropClassName="fixed inset-0 z-[1100] flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      contentClassName="rounded-[22px] border border-border-sweet/45 bg-gradient-to-b from-white via-white to-rose-50/70 p-4 pb-4 shadow-[0_8px_40px_rgb(249_172_201/0.2)] ring-1 ring-love/10"
    >
      <h2 id={titleId} className="font-display text-center text-[16px] font-bold leading-tight text-brown-title">
        选择日期与时间
      </h2>
      <p className="mt-1 text-center text-[11px] leading-snug text-brown-title/45">选好后点确定写回表单</p>

      <div
        className="mt-3 [&_.rdp-month]:!p-0 [&_.rdp-nav]:!h-10 [&_.rdp-root]:mx-auto [&_.rdp-root]:font-display [&_.rdp-weekday]:text-[11px] [&_.rdp-weekday]:font-medium [&_.rdp-weekday]:text-brown-title/55 [&_.rdp-caption_label]:text-[14px] [&_.rdp-caption_label]:font-semibold [&_.rdp-caption_label]:text-brown-title/90 [&_.rdp-day_button]:text-[13px]"
        style={
          {
            '--rdp-accent-color': '#e891b0',
            '--rdp-accent-background-color': 'rgb(255 245 248)',
            '--rdp-day_button-border-radius': '0.6rem',
            '--rdp-day-height': '2.35rem',
            '--rdp-day-width': '2.35rem',
            '--rdp-day_button-height': '2.25rem',
            '--rdp-day_button-width': '2.25rem',
            '--rdp-nav-height': '2.5rem',
          } as CSSProperties
        }
      >
        <DayPicker
          mode="single"
          selected={draftDate}
          onSelect={(d) => {
            if (d) setDraftDate(d);
          }}
          disabled={{ after: startOfLocalDay(now) }}
          showOutsideDays
        />
      </div>

      {/* 时分分隔线，让上面的日历与下面的时间选择有清晰节奏 */}
      <div className="mt-3 border-t border-border-sweet/35 pt-3">
        <div className="grid grid-cols-2 gap-2.5">
          <TimeUnitSelect
            label="时"
            value={draftHour}
            onValueChange={setDraftHour}
            options={hourOptions}
            formatOption={(n) => `${pad2(n)} 时`}
          />
          <TimeUnitSelect
            label="分"
            value={draftMinute}
            onValueChange={setDraftMinute}
            options={minuteOptions}
            formatOption={(n) => `${pad2(n)} 分`}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          className="flex-1 rounded-xl border border-border-sweet/55 py-2.5 text-[13px] font-medium text-neutral-600 transition hover:bg-white/90"
          onClick={onClose}
        >
          取消
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-[#e891b0] py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgb(232_145_176/0.32)] transition hover:bg-[#d4769a]"
          onClick={handleConfirm}
        >
          确定
        </button>
      </div>
    </Modal>
  );
}
