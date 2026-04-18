import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DailyEntry, DailyTag } from '@momoya/shared';
import DailyDateTimePickModal from '@/components/daily/DailyDateTimePickModal';
import { apiFetch, apiPatchJson, apiPostJson } from '@/lib/api';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 text-sm leading-snug text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25';

const dailyBodyTextareaClass =
  'w-full min-h-[7.5rem] resize-none rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 pb-12 pr-12 text-sm leading-relaxed text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25';

/** 原生 resize 不可控；自绘手柄 + Pointer 捕获，样式与恋区卡片一致。 */
function DailyComposeBodyTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const minH = 120;
  const [height, setHeight] = useState(168);

  const clampHeight = useCallback((px: number) => {
    const cap =
      typeof window !== 'undefined' ? Math.min(720, Math.floor(window.innerHeight * 0.72)) : 720;
    return Math.min(cap, Math.max(minH, Math.round(px)));
  }, []);

  const onGripPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const grip = e.currentTarget;
    const pid = e.pointerId;
    const startY = e.clientY;
    const startH = height;
    grip.setPointerCapture(pid);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const dy = ev.clientY - startY;
      setHeight(clampHeight(startH + dy));
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      try {
        grip.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onEnd);
      grip.removeEventListener('pointercancel', onEnd);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onEnd);
    grip.addEventListener('pointercancel', onEnd);
  };

  return (
    <div className="relative isolate mt-1.5">
      <textarea
        id="daily-compose-body"
        className={dailyBodyTextareaClass}
        style={{ height, minHeight: minH }}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
      />
      {/* 右下角：与 px-3 对齐用 bottom-3 right-3；略小于 44px 仍保留 padding 扩大点按区 */}
      <button
        type="button"
        aria-label="拖动调整高度"
        className="group absolute bottom-3 right-3 z-[1] flex h-9 w-9 touch-none cursor-ns-resize items-center justify-center rounded-xl border border-border-sweet/45 bg-white/90 p-1.5 text-love shadow-[0_2px_12px_rgb(249_172_201/0.18),inset_0_1px_0_rgb(255_255_255/0.7)] backdrop-blur-[4px] outline-none [-webkit-tap-highlight-color:transparent] transition select-none hover:border-love/35 hover:bg-white/95 hover:text-[#e891b0] hover:shadow-[0_3px_16px_rgb(249_172_201/0.24)] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-love/30"
        onPointerDown={onGripPointerDown}
      >
        <span
          className="relative grid grid-cols-2 gap-1 text-current opacity-[0.7] transition-opacity group-hover:opacity-100"
          aria-hidden
        >
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-current shadow-[0_0_0_1px_rgb(255_255_255/0.4)_inset]"
            />
          ))}
        </span>
      </button>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatMomentLabel(atDate: string, atTime: string) {
  if (!atDate || !atTime) return '点击选择日期与时间';
  const parts = atDate.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return '点击选择日期与时间';
  return `${y}年${mo}月${da}日  ${atTime}`;
}

const momentTriggerClass =
  'mt-1.5 flex w-full items-center rounded-xl border border-border-sweet/60 bg-white/95 px-3 py-2 text-left text-sm font-medium tabular-nums text-brown-title/90 outline-none transition hover:border-love/35 focus-visible:border-love/50 focus-visible:ring-2 focus-visible:ring-love/25';

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function tagsFromCsv(s: string): DailyTag[] {
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((label) => ({
      id: `${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
      label,
    }));
}

function csvFromTags(tags: DailyTag[]) {
  return tags.map((t) => t.label).join('，');
}

function nowDateTimeParts() {
  const d = new Date();
  return {
    atDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    atTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

type FormState = {
  atDate: string;
  atTime: string;
  body: string;
  tagsCsv: string;
};

function serializeForm(f: FormState) {
  return JSON.stringify(f);
}

export default function DailyComposePage() {
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId: string }>();
  const isEdit = Boolean(entryId);

  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState<FormState>({
    atDate: '',
    atTime: '',
    body: '',
    tagsCsv: '',
  });
  const [baseline, setBaseline] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dirty = useMemo(() => baseline && serializeForm(form) !== baseline, [baseline, form]);
  const momentLabel = useMemo(
    () => formatMomentLabel(form.atDate, form.atTime),
    [form.atDate, form.atTime],
  );

  const loadEntry = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setLoadError('');
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${entryId}`);
    setLoading(false);
    if (!r.ok) {
      setLoadError(r.error);
      return;
    }
    const e = r.data.entry;
    const next: FormState = {
      atDate: toDateInputValue(e.at),
      atTime: toTimeInputValue(e.at),
      body: e.body,
      tagsCsv: csvFromTags(e.tags),
    };
    setForm(next);
    setBaseline(serializeForm(next));
  }, [entryId]);

  useEffect(() => {
    if (isEdit) {
      void loadEntry();
    } else {
      const { atDate, atTime } = nowDateTimeParts();
      const next: FormState = { atDate, atTime, body: '', tagsCsv: '' };
      setForm(next);
      setBaseline(serializeForm(next));
      setLoading(false);
    }
  }, [isEdit, loadEntry]);

  const leaveToDaily = () => {
    navigate(
      '/daily',
      isEdit && entryId
        ? { replace: true, state: { focusEntryId: entryId } }
        : { replace: true },
    );
  };

  const goBack = () => {
    if (dirty && !window.confirm('放弃未保存的修改？')) return;
    leaveToDaily();
  };

  const handleSave = async () => {
    const combined = new Date(`${form.atDate}T${form.atTime}`);
    if (Number.isNaN(combined.getTime())) {
      setSaveError('请选择有效日期与时间');
      return;
    }
    if (!form.body.trim()) {
      setSaveError('正文不能为空');
      return;
    }
    const atIso = combined.toISOString();
    const tags = tagsFromCsv(form.tagsCsv);
    setSaving(true);
    setSaveError('');
    if (isEdit && entryId) {
      const r = await apiPatchJson<{ entry: DailyEntry }>(`/api/daily/entries/${entryId}`, {
        at: atIso,
        body: form.body.trim(),
        tags,
      });
      setSaving(false);
      if (r.ok) {
        navigate('/daily', { replace: true, state: { focusEntryId: entryId } });
      } else {
        setSaveError(r.error);
      }
    } else {
      const r = await apiPostJson<{ entry: DailyEntry }>('/api/daily/entries', {
        at: atIso,
        body: form.body.trim(),
        tags,
      });
      setSaving(false);
      if (r.ok) {
        navigate('/daily', { replace: true });
      } else {
        setSaveError(r.error);
      }
    }
  };

  return (
    <div className="home-romance-bg">
      <div className="mx-auto flex w-[92%] max-w-md flex-col px-0 pb-safe-page pt-4 sm:pt-6">
        <header className="mb-4 flex items-center gap-2 border-b border-border-sweet/30 pb-3">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800"
            aria-label="返回"
          >
            ‹
          </button>
          <h1 className="font-display text-lg font-bold text-brown-title sm:text-xl">
            {isEdit ? '编辑日常' : '记一条日常'}
          </h1>
        </header>

        {loading ? <p className="text-center text-sm text-neutral-500">加载中…</p> : null}
        {loadError ? <p className="text-center text-sm text-rose-600">{loadError}</p> : null}

        {!loading && !loadError ? (
          <div className="love-note-card flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
            <div className="block text-xs font-medium text-neutral-600">
              <span className="text-brown-title/80">记录时刻</span>
              <button type="button" className={momentTriggerClass} onClick={() => setPickerOpen(true)}>
                {momentLabel}
              </button>
            </div>
            <DailyDateTimePickModal
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              atDate={form.atDate}
              atTime={form.atTime}
              onConfirm={(next) => setForm((f) => ({ ...f, ...next }))}
            />

            <div className="block text-xs font-medium text-neutral-600">
              <label htmlFor="daily-compose-body">正文</label>
              <DailyComposeBodyTextarea
                value={form.body}
                onChange={(body) => setForm((f) => ({ ...f, body }))}
              />
            </div>
            <label className="block text-xs font-medium text-neutral-600">
              标签（中文或英文逗号分隔）
              <input
                className={inputClass}
                value={form.tagsCsv}
                onChange={(e) => setForm((f) => ({ ...f, tagsCsv: e.target.value }))}
                placeholder="例如：周末，散步，小确幸"
              />
            </label>

            <div className="rounded-lg border border-dashed border-border-sweet/45 bg-rose-50/30 px-3 py-2 text-center text-[11px] leading-snug text-neutral-400">
              图片附件（即将支持）
            </div>

            {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-border-sweet/50 px-4 py-2.5 text-sm sm:py-2"
                onClick={goBack}
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-xl bg-[#e891b0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 sm:min-w-[7rem] sm:py-2"
                onClick={() => void handleSave()}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
