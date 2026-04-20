import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailyTag } from '@momoya/shared';
import { reportTagStickerClass } from '@/lib/reportTagSticker';

/**
 * 报备 tag 选择器（用户级持久化版）：
 *
 * - 内置「干饭」「没干饭」（不入库、不可删除）
 * - 首次进入且 tags 为空时，默认只勾选「干饭」
 * - 其余 chips 来自 customTags；展示顺序：内置 → 用户库 → 当前 entry 历史未入库项
 */

const BUILTIN_TAGS: DailyTag[] = [
  { id: 'preset-rice', label: '干饭' },
  { id: 'preset-no-rice', label: '没干饭' },
];

const DEFAULT_SELECTED: DailyTag[] = [BUILTIN_TAGS[0]];

const CUSTOM_LABEL_MAX = 16;

type Props = {
  tags: DailyTag[];
  onChange: (next: DailyTag[]) => void;
  customTags: DailyTag[];
  onAddCustom: (tag: DailyTag) => Promise<void> | void;
  onRemoveCustom: (tag: DailyTag) => Promise<void> | void;
  disabled?: boolean;
  initialized?: boolean;
  onInitialized?: () => void;
};

function labelKey(label: string): string {
  return label.trim().toLowerCase();
}

function isBuiltinLabel(label: string): boolean {
  return BUILTIN_TAGS.some((t) => labelKey(t.label) === labelKey(label));
}

export default function ReportTagPicker({
  tags,
  onChange,
  customTags,
  onAddCustom,
  onRemoveCustom,
  disabled = false,
  initialized = false,
  onInitialized,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialized) return;
    if (tags.length === 0) {
      onChange(DEFAULT_SELECTED);
    }
    onInitialized?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const selectedByLabel = useMemo(() => {
    const m = new Map<string, DailyTag>();
    tags.forEach((t) => m.set(labelKey(t.label), t));
    return m;
  }, [tags]);

  const allChips: DailyTag[] = useMemo(() => {
    const seen = new Set<string>();
    const out: DailyTag[] = [];
    for (const t of BUILTIN_TAGS) {
      const k = labelKey(t.label);
      seen.add(k);
      out.push(t);
    }
    for (const t of customTags) {
      const k = labelKey(t.label);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    for (const t of tags) {
      const k = labelKey(t.label);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }, [customTags, tags]);

  const isCustomLibTag = (label: string): boolean => {
    if (isBuiltinLabel(label)) return false;
    return customTags.some((t) => labelKey(t.label) === labelKey(label));
  };

  const toggle = (chip: DailyTag) => {
    if (disabled || busy) return;
    const key = labelKey(chip.label);
    if (selectedByLabel.has(key)) {
      onChange(tags.filter((t) => labelKey(t.label) !== key));
    } else {
      onChange([...tags, chip]);
    }
  };

  const startAdding = () => {
    if (disabled || busy) return;
    setAdding(true);
    setDraft('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitDraft = async () => {
    const label = draft.trim();
    if (!label) {
      setAdding(false);
      setDraft('');
      return;
    }
    const trimmed = label.slice(0, CUSTOM_LABEL_MAX);
    const key = labelKey(trimmed);
    const builtin = BUILTIN_TAGS.find((t) => labelKey(t.label) === key);
    if (builtin) {
      if (!selectedByLabel.has(key)) onChange([...tags, builtin]);
      setAdding(false);
      setDraft('');
      return;
    }
    const existed = customTags.find((t) => labelKey(t.label) === key);
    if (existed) {
      if (!selectedByLabel.has(key)) onChange([...tags, existed]);
      setAdding(false);
      setDraft('');
      return;
    }
    const newTag: DailyTag = {
      id: `custom-${key.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
      label: trimmed,
    };
    setBusy(true);
    try {
      await onAddCustom(newTag);
      onChange([...tags, newTag]);
    } finally {
      setBusy(false);
      setAdding(false);
      setDraft('');
    }
  };

  const removeCustom = async (chip: DailyTag) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await onRemoveCustom(chip);
      const key = labelKey(chip.label);
      if (selectedByLabel.has(key)) {
        onChange(tags.filter((t) => labelKey(t.label) !== key));
      }
    } finally {
      setBusy(false);
    }
  };

  const chipBase =
    'inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[12px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allChips.map((chip) => {
        const key = labelKey(chip.label);
        const active = selectedByLabel.has(key);
        const sticker = reportTagStickerClass(chip);
        const showDeleteBtn = isCustomLibTag(chip.label);
        return (
          <span key={chip.id} className="relative inline-flex">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => toggle(chip)}
              className={`${chipBase} ${sticker} ${
                active
                  ? 'ring-2 ring-white/95 shadow-[0_4px_14px_rgb(0_0_0/0.12)]'
                  : 'border border-white/50 opacity-[0.88] hover:opacity-100'
              } ${showDeleteBtn ? 'pr-6' : ''}`}
            >
              {chip.label}
            </button>
            {showDeleteBtn && (
              <button
                type="button"
                aria-label={`删除自定义标签 ${chip.label}`}
                disabled={disabled || busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void removeCustom(chip);
                }}
                className={`absolute right-1 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition ${
                  active
                    ? 'bg-black/15 text-current hover:bg-black/25'
                    : 'bg-black/10 text-current hover:bg-black/18'
                }`}
              >
                ×
              </button>
            )}
          </span>
        );
      })}

      {adding ? (
        <input
          ref={inputRef}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value.slice(0, CUSTOM_LABEL_MAX))}
          onBlur={() => void commitDraft()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commitDraft();
            } else if (e.key === 'Escape') {
              setAdding(false);
              setDraft('');
            }
          }}
          placeholder="自定义…"
          className="min-w-[6rem] max-w-[9rem] rounded-full border border-amber-300/60 bg-white px-3 py-1 text-[12px] text-brown-title outline-none placeholder:text-brown-title/35 focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40 disabled:opacity-60"
        />
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={startAdding}
          className={`${chipBase} border border-dashed border-amber-300/60 bg-white text-amber-600 hover:border-amber-400 hover:bg-amber-50`}
        >
          + 自定义
        </button>
      )}
    </div>
  );
}
