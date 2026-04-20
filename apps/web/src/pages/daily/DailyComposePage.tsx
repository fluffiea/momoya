import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import cx from 'classnames';
import type { DailyEntry, DailyEntryKind, DailyTag, UserPublic } from '@momoya/shared';
import DailyDateTimePickModal from '@/components/daily/DailyDateTimePickModal';
import ReportTagPicker from '@/components/daily/ReportTagPicker';
import SecondaryPageHeader from '@/components/ui/SecondaryPageHeader';
import SectionLabel from '@/components/ui/SectionLabel';
import { NoteLabel, SheetHeader } from '@/components/ui/craft';
import { useAuth } from '@/auth/useAuth';
import { apiFetch, apiDelete, apiPatchJson, apiPostJson, resolveApiUrl } from '@/lib/api';
import { compressForDaily } from '@/lib/imageCompression';

// ─── Shared form-field surface ─────────────────────────────────────────────────
// 与"记录时刻"按钮节奏对齐：rounded-2xl + 阴影 + 暖色 focus 环
const fieldSurfaceClass =
  'w-full rounded-2xl border border-border-sweet/45 bg-white/85 shadow-[0_4px_18px_rgb(249_172_201/0.10)] outline-none transition focus-within:border-love/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-love/20 hover:border-love/30';

// 单行输入框：内部 input 用这个类
const inputBareClass =
  'w-full bg-transparent text-[14px] leading-snug text-neutral-800 outline-none placeholder:text-neutral-400/85';

const BODY_MAX_LEN = 20000;

// ─── Auto-grow textarea ────────────────────────────────────────────────────────

function DailyComposeBodyTextarea({
  value,
  onChange,
  placeholder = '写下今天发生的小事…',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // 3 行起步，足以承载几句话；超过 MAX_HEIGHT 由内部滚动接管，避免把整页撑得过长
  const MIN_ROWS = 3;
  const MAX_HEIGHT = 360;

  // 重新测量并应用高度：先清零让浏览器重算 scrollHeight
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(MAX_HEIGHT, el.scrollHeight);
    el.style.height = `${next}px`;
  }, []);

  // 内容变化、字体加载、窗口宽度变化都需要重新测量
  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const handler = () => resize();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [resize]);

  return (
    <div className={`${fieldSurfaceClass} relative isolate px-4 pt-3 pb-8`}>
      <textarea
        id="daily-compose-body"
        ref={ref}
        rows={MIN_ROWS}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onInput={resize}
        maxLength={BODY_MAX_LEN}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent text-[15px] leading-[1.75] text-neutral-800 outline-none placeholder:text-neutral-400/80"
        style={{ overflow: 'hidden' }}
      />
      {/* 右下角字数提示：只在用户开始输入后出现，避免初始空状态显得"零零碎碎" */}
      {value.length > 0 ? (
        <span className="pointer-events-none absolute bottom-2 right-3 select-none font-display text-[11px] tabular-nums text-brown-title/35">
          {value.length} / {BODY_MAX_LEN}
        </span>
      ) : null}
    </div>
  );
}

// ─── Image upload zone ─────────────────────────────────────────────────────────

/**
 * 统一的图片项：
 * - saved：已保存到 entry 的图片，url 是后端返回的相对路径
 * - pending：本地待上传的图片，objectUrl 用于预览，file 用于真正上传
 *
 * id 在前端必须稳定（用于 React key 与 Reorder 比较）。saved 用 url 作为 id，
 * pending 用一次性 random id。
 */
type SavedImageItem = { kind: 'saved'; id: string; url: string };
type PendingImageItem = { kind: 'pending'; id: string; objectUrl: string; file: File };
type ImageItem = SavedImageItem | PendingImageItem;

function imageItemSrc(item: ImageItem) {
  return item.kind === 'pending' ? item.objectUrl : resolveApiUrl(item.url);
}

const CELL_SIZE_CLASS = 'h-20 w-20'; // 80×80，避开"图片占满一行导致页面无法下滑"的问题

/**
 * 纯展示的图片单元，不接触 dnd-kit。
 * - 用在两处：① SortableImageCell 内部（正常列表项）② DragOverlay 内部（跟手指浮层）
 * - 之所以拆出来：useSortable 不能在同一帧里对同一个 id 调用两次，否则 dnd-kit 内部状态错乱。
 */
const ImageCellView = ({
  item,
  uploading,
  onRemove,
  isOverlay = false,
  isPlaceholder = false,
  setNodeRef,
  handleProps,
  style,
}: {
  item: ImageItem;
  uploading: boolean;
  onRemove?: () => void;
  isOverlay?: boolean;
  /** 当前项正在被拖拽时的"原位置占位"样式 */
  isPlaceholder?: boolean;
  /** 由 useSortable 提供，仅 SortableImageCell 传入 */
  setNodeRef?: (el: HTMLDivElement | null) => void;
  /** {...attributes, ...listeners}，用作拖拽手柄事件 */
  handleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}) => {
  const isPending = item.kind === 'pending';
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(handleProps ?? {})}
      className={cx(
        'relative shrink-0 select-none',
        CELL_SIZE_CLASS,
        isPlaceholder && 'opacity-30',
        isOverlay && 'cursor-grabbing',
      )}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={imageItemSrc(item)}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          // 让长按 / 拖动事件直接到外层容器，避免 <img> 触发系统"保存图片"等手势
          pointerEvents: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        className={cx(
          'h-full w-full rounded-xl border border-border-sweet/30 object-cover',
          isOverlay && 'scale-[1.06] shadow-[0_14px_30px_rgba(232,145,176,0.45)] ring-2 ring-love/35 transition-transform',
          isPending && !isOverlay && 'opacity-80',
        )}
      />
      {!isOverlay && onRemove && (
        <button
          type="button"
          aria-label="删除图片"
          disabled={uploading}
          className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#e891b0] text-[9px] font-bold text-white shadow-sm transition hover:bg-[#d4769a] disabled:opacity-50"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
      {isPending && uploading && !isOverlay && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-love border-t-transparent" />
        </div>
      )}
    </div>
  );
};

/** 列表里的可排序单元；只在 SortableContext 内被渲染，独占一个 useSortable 实例。 */
function SortableImageCell({
  item,
  uploading,
  onRemove,
}: {
  item: ImageItem;
  uploading: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: uploading,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ImageCellView
      item={item}
      uploading={uploading}
      onRemove={onRemove}
      setNodeRef={setNodeRef}
      handleProps={{ ...attributes, ...listeners }}
      style={style}
      isPlaceholder={isDragging}
    />
  );
}

/**
 * 图片上传 + 拖拽排序区。
 *
 * 设计要点：
 * - 用 dnd-kit：Pointer/Touch sensor 都设置 activationConstraint，长按 320ms 才进入拖拽，
 *   未激活前不接管手势 → 用户在图片上的普通滚动手势完全正常。
 * - 80×80 固定尺寸 + flex-wrap，单行可摆 4–5 张，避免一张图占满一整行带来的滑动盲区。
 * - 拖拽视觉用 DragOverlay，跟随手指，由 dnd-kit 自己处理 portal/层级，无抖动。
 * - 所有顺序变更只走 onReorder（前端状态），父组件保存时一次性 PATCH。
 */
function ImageUploadZone({
  items,
  onAddFiles,
  onRemoveSaved,
  onRemovePending,
  onReorder,
  uploading,
  /** report kind 下展示一个独立的"拍一张"按钮，直接调起系统相机 */
  showCameraButton = false,
}: {
  items: ImageItem[];
  onAddFiles: (files: File[]) => void | Promise<void>;
  onRemoveSaved: (id: string) => void;
  onRemovePending: (id: string) => void;
  onReorder: (next: ImageItem[]) => void;
  uploading: boolean;
  showCameraButton?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 桌面用鼠标距离激活（按下移动 ≥6px 即拖），移动端用长按激活（避免与滚动冲突）
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const sortableIds = useMemo(() => items.map((i) => i.id), [items]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(20); } catch { /* noop */ }
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = items.findIndex((i) => i.id === active.id);
    const toIdx = items.findIndex((i) => i.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;
    onReorder(arrayMove(items, fromIdx, toIdx));
  };

  const handleDragCancel = () => setActiveId(null);

  const total = items.length;
  const canAdd = total < 9;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    void onAddFiles(arr.slice(0, 9 - total));
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <SortableImageCell
                key={item.id}
                item={item}
                uploading={uploading}
                onRemove={() =>
                  item.kind === 'saved' ? onRemoveSaved(item.id) : onRemovePending(item.id)
                }
              />
            ))}

            {canAdd && (
              <button
                type="button"
                disabled={uploading}
                className={cx(
                  'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border-sweet/60 bg-white/70 text-neutral-400 transition hover:border-love/50 hover:bg-rose-50/40 hover:text-love disabled:opacity-50',
                  CELL_SIZE_CLASS,
                )}
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[9px]">相册</span>
              </button>
            )}
            {canAdd && showCameraButton && (
              <button
                type="button"
                disabled={uploading}
                className={cx(
                  'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-amber-300/60 bg-amber-50/40 text-amber-600 transition hover:border-amber-400/80 hover:bg-amber-50/70 hover:text-amber-700 disabled:opacity-50',
                  CELL_SIZE_CLASS,
                )}
                onClick={() => cameraInputRef.current?.click()}
                aria-label="拍一张"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
                  <circle cx="12" cy="13" r="3.25" strokeLinecap="round" />
                </svg>
                <span className="text-[9px]">拍一张</span>
              </button>
            )}
          </div>
        </SortableContext>

        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {activeItem ? (
            <ImageCellView item={activeItem} uploading={false} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {items.length > 1 && (
        <p className="mt-2 text-[11px] text-neutral-400">长按图片可拖拽调整顺序</p>
      )}
      {!total && (
        <p className="mt-2 text-[11px] text-neutral-400">
          最多 9 张，JPEG / PNG / WebP，过大的图片会被自动压缩
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ''; }}
      />
      {showCameraButton && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ''; }}
        />
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

function formatMomentLabel(atDate: string, atTime: string) {
  if (!atDate || !atTime) return '点击选择';
  const [y, mo, da] = atDate.split('-').map(Number);
  if (!y || !mo || !da) return '点击选择';
  return `${y}年${mo}月${da}日 ${atTime}`;
}

const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** 触发按钮中显示的日期文本：今天/昨天 优先；否则 "M月D日 周X" */
function formatMomentDateText(atDate: string): string {
  if (!atDate) return '点击选择日期';
  const [y, mo, da] = atDate.split('-').map(Number);
  if (!y || !mo || !da) return '点击选择日期';
  const target = new Date(y, mo - 1, da);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOf(target).getTime() - startOf(today).getTime()) / 86400000);
  const wk = `周${WEEKDAYS_CN[target.getDay()]}`;
  if (diffDays === 0) return `今天 · ${wk}`;
  if (diffDays === -1) return `昨天 · ${wk}`;
  if (diffDays === -2) return `前天 · ${wk}`;
  // 同一年省略年份，跨年时显示年份
  if (target.getFullYear() === today.getFullYear()) {
    return `${mo}月${da}日 · ${wk}`;
  }
  return `${y}年${mo}月${da}日`;
}

function formatMomentTimeText(atTime: string): string {
  return atTime || '--:--';
}

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
  return s.split(/[,，]/).map((x) => x.trim()).filter(Boolean).map((label) => ({
    id: `${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
    label,
  }));
}

function csvFromTags(tags: DailyTag[]) { return tags.map((t) => t.label).join('，'); }

function nowDateTimeParts() {
  const d = new Date();
  return {
    atDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    atTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

// ─── Main page ─────────────────────────────────────────────────────────────────

/**
 * form.tagsCsv 用于 daily 的文本输入；form.tags 用于 report 的 chip 选择。
 * 两者 serialize 后都参与 baseline / dirty 判断，不会因为分开存储而失效。
 */
type FormState = {
  atDate: string;
  atTime: string;
  body: string;
  tagsCsv: string;
  tags: DailyTag[];
};

function serializeForm(f: FormState) { return JSON.stringify(f); }

function labelKey(label: string): string {
  return label.trim().toLowerCase();
}

export default function DailyComposePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { entryId } = useParams<{ entryId: string }>();
  const isEdit = Boolean(entryId);
  const { user, applyUser } = useAuth();

  // 路径判定：`/daily/report/new` 或 `/daily/:id/report/edit` 视为 report
  const pathIsReport = location.pathname.includes('/report/');
  const [kind, setKind] = useState<DailyEntryKind>(pathIsReport ? 'report' : 'daily');
  const isReport = kind === 'report';

  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState<FormState>({ atDate: '', atTime: '', body: '', tagsCsv: '', tags: [] });
  const [baseline, setBaseline] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportTagsInit, setReportTagsInit] = useState(false);

  /** 统一的图片项列表：保留用户拖拽后的最终顺序（含已保存 + 待上传） */
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [imageUploading, setImageUploading] = useState(false);

  const savedCount = useMemo(() => imageItems.filter((i) => i.kind === 'saved').length, [imageItems]);
  const pendingCount = useMemo(() => imageItems.filter((i) => i.kind === 'pending').length, [imageItems]);
  /** 已保存图片在加载/同步后的"基线"顺序，用于检测排序是否需要 PATCH */
  const savedBaselineRef = useRef<string[]>([]);

  const dirty = useMemo(() => Boolean(baseline && serializeForm(form) !== baseline), [baseline, form]);
  const momentLabel = useMemo(() => formatMomentLabel(form.atDate, form.atTime), [form.atDate, form.atTime]);
  const momentDateText = useMemo(() => formatMomentDateText(form.atDate), [form.atDate]);
  const momentTimeText = useMemo(() => formatMomentTimeText(form.atTime), [form.atTime]);

  const loadEntry = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setLoadError('');
    const r = await apiFetch<{ entry: DailyEntry }>(`/api/daily/entries/${entryId}`);
    setLoading(false);
    if (!r.ok) { setLoadError(r.error); return; }
    const e = r.data.entry;
    const loadedKind: DailyEntryKind = e.kind === 'report' ? 'report' : 'daily';
    setKind(loadedKind);
    // 报备：tags 存进 form.tags；日常：tags 转 CSV 文本
    const next: FormState = {
      atDate: toDateInputValue(e.at),
      atTime: toTimeInputValue(e.at),
      body: e.body,
      tagsCsv: loadedKind === 'report' ? '' : csvFromTags(e.tags),
      tags: loadedKind === 'report' ? e.tags : [],
    };
    setForm(next);
    setBaseline(serializeForm(next));
    // 编辑模式下 tags 已从 entry 载入，不再让 ReportTagPicker 做默认选中
    setReportTagsInit(true);
    const savedItems: SavedImageItem[] = (e.images ?? []).map((url) => ({
      kind: 'saved',
      id: url,
      url,
    }));
    savedBaselineRef.current = savedItems.map((s) => s.url);
    setImageItems(savedItems);
  }, [entryId]);

  useEffect(() => {
    if (isEdit) {
      void loadEntry();
    } else {
      const { atDate, atTime } = nowDateTimeParts();
      const next: FormState = { atDate, atTime, body: '', tagsCsv: '', tags: [] };
      setForm(next);
      setBaseline(serializeForm(next));
      setLoading(false);
    }
  }, [isEdit, loadEntry]);

  // 卸载时回收所有 pending 项的本地预览 URL，避免内存泄漏
  const imageItemsRef = useRef<ImageItem[]>([]);
  useEffect(() => { imageItemsRef.current = imageItems; }, [imageItems]);
  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((it) => {
        if (it.kind === 'pending') URL.revokeObjectURL(it.objectUrl);
      });
    };
  }, []);

  const handleAddFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setImageUploading(true);
    try {
      const compressed = await Promise.all(
        files.map(async (f) => {
          try {
            return await compressForDaily(f);
          } catch {
            // 压缩失败时回退到原图，由后端大小上限兜底
            return f;
          }
        }),
      );
      setImageItems((prev) => [
        ...prev,
        ...compressed.map<PendingImageItem>((file) => ({
          kind: 'pending',
          id: `pending-${Math.random().toString(36).slice(2, 10)}`,
          file,
          objectUrl: URL.createObjectURL(file),
        })),
      ]);
    } finally {
      setImageUploading(false);
    }
  };

  /** 删除一张已保存的图片：立即调后端 DELETE，按 url 在当前已保存子序列里查 idx */
  const handleRemoveSaved = async (savedId: string) => {
    if (!entryId) return;
    const savedSeq = imageItems.filter((i): i is SavedImageItem => i.kind === 'saved');
    const idx = savedSeq.findIndex((s) => s.id === savedId);
    if (idx === -1) return;
    setImageUploading(true);
    let r: Awaited<ReturnType<typeof apiDelete>>;
    try {
      r = await apiDelete(`/api/daily/entries/${entryId}/images/${idx}`);
    } finally {
      setImageUploading(false);
    }
    if (r.ok) {
      const nextSavedUrls = ((r.data as { entry: DailyEntry }).entry.images ?? []);
      savedBaselineRef.current = nextSavedUrls;
      // 用后端最新顺序重建 saved 列表，但保留 pending 项的位置（粗略做法：删除目标 saved 后，剩余 saved 顺序按后端为准）
      setImageItems((prev) => {
        const remainingSaved: SavedImageItem[] = nextSavedUrls.map((url) => ({ kind: 'saved', id: url, url }));
        const pendings = prev.filter((i): i is PendingImageItem => i.kind === 'pending');
        // 简化：被删除 saved 之前的位置上的 pending 保持原相对顺序，统一拼回到末尾
        return [...remainingSaved, ...pendings];
      });
    } else {
      setSaveError((r as { ok: false; error: string }).error);
    }
  };

  const handleRemovePending = (pendingId: string) => {
    setImageItems((prev) => {
      const target = prev.find((i) => i.kind === 'pending' && i.id === pendingId) as PendingImageItem | undefined;
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((i) => i.id !== pendingId);
    });
  };

  const handleReorder = (next: ImageItem[]) => setImageItems(next);

  /**
   * 上传 pending 图片，返回每张 pending → 真实 URL 的映射。
   * 任意一张失败就 short-circuit；已成功的会被 promote 成 saved，避免重试时重复上传。
   */
  const uploadPendingImages = async (
    id: string,
  ): Promise<{ ok: true; urlByPendingId: Map<string, string> } | { ok: false }> => {
    const snapshot = imageItemsRef.current;
    const pendings = snapshot.filter((i): i is PendingImageItem => i.kind === 'pending');
    const urlByPendingId = new Map<string, string>();

    const promoteUploaded = () => {
      if (urlByPendingId.size === 0) return;
      setImageItems((prev) =>
        prev.map((it) => {
          if (it.kind === 'pending' && urlByPendingId.has(it.id)) {
            const url = urlByPendingId.get(it.id)!;
            return { kind: 'saved', id: url, url };
          }
          return it;
        }),
      );
    };

    for (const p of pendings) {
      const fd = new FormData();
      fd.append('file', p.file);
      const resp = await fetch(resolveApiUrl(`/api/daily/entries/${id}/images`), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!resp.ok) {
        let msg = '图片上传失败';
        try {
          const data = (await resp.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch { /* ignore */ }
        setSaveError(msg);
        promoteUploaded();
        return { ok: false };
      }
      const data = (await resp.json()) as { entry: DailyEntry };
      const lastUrl = (data.entry.images ?? []).at(-1);
      if (lastUrl) urlByPendingId.set(p.id, lastUrl);
      URL.revokeObjectURL(p.objectUrl);
    }
    promoteUploaded();
    return { ok: true, urlByPendingId };
  };

  /** 计算前端 imageItems 期望的最终图片顺序（pending 用 urlByPendingId 解析为真实 URL） */
  const computeDesiredOrder = (urlByPendingId: Map<string, string>): string[] =>
    imageItemsRef.current
      .map((i) => (i.kind === 'saved' ? i.url : urlByPendingId.get(i.id) ?? ''))
      .filter(Boolean);

  const leaveToDaily = () => {
    const target = `/daily?view=${isReport ? 'report' : 'daily'}`;
    navigate(target, isEdit && entryId ? { replace: true, state: { focusEntryId: entryId } } : { replace: true });
  };

  const isImagesDirty = useMemo(() => {
    if (pendingCount > 0) return true;
    const baselineUrls = savedBaselineRef.current;
    if (baselineUrls.length !== savedCount) return true;
    const currentSavedUrls = imageItems
      .filter((i): i is SavedImageItem => i.kind === 'saved')
      .map((s) => s.url);
    return currentSavedUrls.some((u, i) => u !== baselineUrls[i]);
  }, [imageItems, pendingCount, savedCount]);

  const goBack = () => {
    if ((dirty || isImagesDirty) && !window.confirm('放弃未保存的修改？')) return;
    imageItemsRef.current.forEach((it) => {
      if (it.kind === 'pending') URL.revokeObjectURL(it.objectUrl);
    });
    leaveToDaily();
  };

  /**
   * 保存流程（拖拽顺序完全本地，只在这里一次性同步到后端）：
   *   1. 上传所有 pending 图片（追加到 entry.images 末尾）
   *   2. 计算最终期望顺序；如与基线 saved 顺序不一致或有 pending 被穿插，则把 images 一并放进
   *      PATCH /entries/:id 的 body（与 at/body/tags 一起，仅一次请求）
   * 新建模式：先 POST 创建，再走同样流程
   */
  const handleSave = async () => {
    const combined = new Date(`${form.atDate}T${form.atTime}`);
    if (Number.isNaN(combined.getTime())) { setSaveError('请选择有效日期与时间'); return; }
    const hasAnyImage = imageItemsRef.current.length > 0;
    if (isReport) {
      // 报备：标签必选；文案和图片至少保留一项
      if (form.tags.length === 0) { setSaveError('请至少选择一个标签'); return; }
      if (!form.body.trim() && !hasAnyImage) { setSaveError('文案和图片至少填一项'); return; }
    } else {
      if (!form.body.trim()) { setSaveError('正文不能为空'); return; }
    }
    const atIso = combined.toISOString();
    const tags = isReport ? form.tags : tagsFromCsv(form.tagsCsv);
    setSaving(true);
    setSaveError('');

    const finalize = async (id: string): Promise<boolean> => {
      setImageUploading(true);
      try {
        const up = await uploadPendingImages(id);
        if (!up.ok) return false;

        const desired = computeDesiredOrder(up.urlByPendingId);
        // 上传后，后端 entry.images = [...原 saved（按基线序）, ...本次新上传（按 pending 顺序）]
        const serverOrderAfterUpload = [
          ...savedBaselineRef.current,
          ...imageItemsRef.current
            .filter((i): i is SavedImageItem => i.kind === 'saved')
            .map((s) => s.url)
            .filter((u) => !savedBaselineRef.current.includes(u)),
        ];
        const orderChanged =
          desired.length !== serverOrderAfterUpload.length ||
          desired.some((u, i) => u !== serverOrderAfterUpload[i]);

        // 编辑模式下文本 / tags 永远 PATCH（用户可能改了）；新建模式下创建已带这些字段
        const needPatch = isEdit || orderChanged;
        if (!needPatch) return true;

        const body: Record<string, unknown> = isEdit
          ? { at: atIso, body: form.body.trim(), tags }
          : {};
        if (orderChanged && desired.length > 0) body.images = desired;

        const r = await apiPatchJson<{ entry: DailyEntry }>(`/api/daily/entries/${id}`, body);
        if (!r.ok) { setSaveError(r.error); return false; }
        savedBaselineRef.current = r.data.entry.images ?? [];
        return true;
      } finally {
        setImageUploading(false);
      }
    };

    try {
      if (isEdit && entryId) {
        const ok = await finalize(entryId);
        if (!ok) return;
        navigate(`/daily?view=${isReport ? 'report' : 'daily'}`, {
          replace: true,
          state: { focusEntryId: entryId },
        });
      } else {
        const r = await apiPostJson<{ entry: DailyEntry }>('/api/daily/entries', {
          at: atIso, body: form.body.trim(), tags, kind,
        });
        if (!r.ok) {
          setSaveError(r.error);
          return;
        }
        const newId = r.data.entry.id;
        const ok = await finalize(newId);
        if (!ok) return;
        navigate(`/daily?view=${isReport ? 'report' : 'daily'}`, {
          replace: true,
          state: { scrollToTop: true },
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || imageUploading;
  const hasImages = imageItems.length > 0;

  // 用户级自定义 tag 库：来自 auth profile，过滤掉可能混入的内置项，稳定顺序
  const userCustomTags: DailyTag[] = useMemo(() => {
    const raw = user?.profile.reportTags ?? [];
    const out: DailyTag[] = [];
    const seen = new Set<string>(['干饭', '没干饭']);
    for (const t of raw) {
      const key = labelKey(t.label);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }, [user?.profile.reportTags]);

  /**
   * 自定义 tag 的增删：整组覆盖地 PATCH 到 user profile；
   * 直接把响应里的最新 user 塞回 auth 上下文（applyUser），
   * 无需再走 GET /auth/me 的二次刷新——这样 UI 能在 PATCH 返回的同一 tick 里拿到新 customTags，
   * 不会出现「添加后要刷新才能看到」的错觉。
   */
  const persistCustomTags = useCallback(
    async (next: DailyTag[]) => {
      const r = await apiPatchJson<{ user: UserPublic }>('/api/profile/me', {
        reportTags: next,
      });
      if (!r.ok) {
        window.alert(r.error || '保存标签失败');
        throw new Error(r.error || '保存标签失败');
      }
      applyUser(r.data.user);
    },
    [applyUser],
  );

  const handleAddCustomTag = useCallback(
    async (tag: DailyTag) => {
      const key = labelKey(tag.label);
      if (userCustomTags.some((t) => labelKey(t.label) === key)) return;
      await persistCustomTags([...userCustomTags, tag]);
    },
    [persistCustomTags, userCustomTags],
  );

  const handleRemoveCustomTag = useCallback(
    async (tag: DailyTag) => {
      const key = labelKey(tag.label);
      const next = userCustomTags.filter((t) => labelKey(t.label) !== key);
      if (next.length === userCustomTags.length) return;
      await persistCustomTags(next);
    },
    [persistCustomTags, userCustomTags],
  );

  const pageTitle = isReport
    ? (isEdit ? '编辑报备' : '写一条报备')
    : (isEdit ? '编辑日常' : '记一条日常');
  const bodyPlaceholder = isReport
    ? '今天吃了什么、做了什么…'
    : '写下今天发生的小事…';
  const bgClass = isReport ? 'report-desk-bg' : 'home-romance-bg';
  const saveButtonColor = isReport
    ? 'bg-[#c47e5a] shadow-[0_6px_18px_rgb(196_126_90_0.32)] hover:bg-[#a9623f]'
    : 'bg-[#e891b0] shadow-[0_6px_18px_rgb(232_145_176/0.32)] hover:bg-[#d4769a]';

  return (
    <div className={`${bgClass} flex min-h-full flex-col`}>
      <SecondaryPageHeader title={pageTitle} onBack={goBack} />

      <div className="mx-auto flex w-[92%] max-w-md flex-1 flex-col pb-safe-page pt-4 sm:pt-5">

        {loading ? <p className="py-8 text-center text-sm text-neutral-500">加载中…</p> : null}
        {loadError ? <p className="text-center text-sm text-rose-600">{loadError}</p> : null}

        {!loading && !loadError ? (
          <div
            className={
              isReport
                ? 'report-note-sheet flex flex-col gap-5 sm:gap-6'
                : 'romance-note-sheet flex flex-col gap-5 sm:gap-6'
            }
          >
            <SheetHeader
              tone={isReport ? 'amber' : 'rose'}
              stampLabel={isReport ? 'REPORT' : 'DAILY'}
              title={
                isReport
                  ? isEdit
                    ? '今日报备 · 续写'
                    : '今日报备'
                  : isEdit
                    ? '今日日常 · 续写'
                    : '今日日常'
              }
            />
          

            {/* ── 记录时刻 ──────────────────────────────────── */}
            <section aria-labelledby="dc-when-heading">
              {isReport ? (
                <NoteLabel tone="amber" title="时刻" />
              ) : (
                <SectionLabel id="dc-when-heading" title="记录时刻" />
              )}
              <button
                type="button"
                className={
                  isReport
                    ? 'mt-3 flex w-full items-center gap-3 rounded-[14px] border-2 border-dashed border-[#c8a878]/60 bg-[#fff8e7]/80 px-3 py-2.5 text-left font-display text-[#5c3d16] transition hover:bg-[#fff4d8]'
                    : 'mt-3 flex w-full items-center gap-3 rounded-2xl border border-border-sweet/45 bg-white/85 px-3 py-2.5 text-left shadow-[0_4px_18px_rgb(249_172_201/0.10)] transition hover:border-love/35 hover:bg-white focus-visible:border-love/50 focus-visible:ring-2 focus-visible:ring-love/25 focus-visible:outline-none'
                }
                onClick={() => setPickerOpen(true)}
                aria-label={`选择记录时刻：当前 ${momentLabel}`}
              >
                {/* 左：暖色"软糖"日历章 */}
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/80 text-love ring-1 ring-love/15"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                  </svg>
                </span>

                {/* 中：日期 + 时间，一主一辅，信息均匀填满 */}
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                  <span className="font-display text-[14px] font-semibold tabular-nums tracking-wide text-brown-title">
                    {momentDateText}
                  </span>
                  <span className="font-display text-[15px] font-bold tabular-nums text-love/85">
                    {momentTimeText}
                  </span>
                </span>

                {/* 右：chevron-right */}
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-brown-title/30" aria-hidden>
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.08-.02Z" clipRule="evenodd" />
                </svg>
              </button>
            </section>

            <DailyDateTimePickModal
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              atDate={form.atDate}
              atTime={form.atTime}
              onConfirm={(next) => setForm((f) => ({ ...f, ...next }))}
            />

            {/* ── 正文 ─────────────────────────────────────── */}
            <section aria-labelledby="dc-body-heading">
              {isReport ? <NoteLabel tone="amber" title="写点什么" /> : <SectionLabel id="dc-body-heading" title="正文" />}
              <div className={isReport ? 'mt-3 report-note-body' : 'mt-3'}>
                <DailyComposeBodyTextarea
                  value={form.body}
                  onChange={(body) => setForm((f) => ({ ...f, body }))}
                  placeholder={bodyPlaceholder}
                />
              </div>
            </section>

            {/* ── 标签 ─────────────────────────────────────── */}
            <section aria-labelledby="dc-tags-heading">
              {isReport ? <NoteLabel tone="amber" title="贴个标签" /> : <SectionLabel id="dc-tags-heading" title="标签" />}
              {isReport ? (
                <div className="mt-3">
                  <ReportTagPicker
                    tags={form.tags}
                    onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                    customTags={userCustomTags}
                    onAddCustom={handleAddCustomTag}
                    onRemoveCustom={handleRemoveCustomTag}
                    disabled={isBusy}
                    initialized={reportTagsInit}
                    onInitialized={() => setReportTagsInit(true)}
                  />
                </div>
              ) : (
                <div className={`mt-3 ${fieldSurfaceClass} flex items-center gap-2.5 px-3 py-2.5`}>
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/80 text-love ring-1 ring-love/15"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
                    </svg>
                  </span>
                  <input
                    id="daily-compose-tags"
                    className={inputBareClass}
                    value={form.tagsCsv}
                    onChange={(e) => setForm((f) => ({ ...f, tagsCsv: e.target.value }))}
                    placeholder="用逗号分隔，例：周末，散步，小确幸"
                  />
                </div>
              )}
            </section>

            {/* ── 图片 ─────────────────────────────────────── */}
            <section aria-labelledby="dc-images-heading">
              <div className="flex items-baseline justify-between">
                {isReport ? <NoteLabel tone="amber" title="贴张照片" /> : <SectionLabel id="dc-images-heading" title="图片" />}
                {hasImages ? (
                  <span className="font-display text-[11px] tabular-nums text-brown-title/45">
                    {imageItems.length}/9
                  </span>
                ) : null}
              </div>
              <div className="mt-3">
                <ImageUploadZone
                  items={imageItems}
                  onAddFiles={(files) => void handleAddFiles(files)}
                  onRemoveSaved={(id) => void handleRemoveSaved(id)}
                  onRemovePending={handleRemovePending}
                  onReorder={handleReorder}
                  uploading={imageUploading}
                  showCameraButton={isReport}
                />
              </div>
            </section>

          </div>
        ) : null}

        {/* ── Error + actions ───────────────────────────────── */}
        {!loading && !loadError ? (
          <div className="mt-7">
            {saveError ? <p className="mb-2 text-center text-sm text-rose-600">{saveError}</p> : null}
            <div className="flex gap-2.5">
              <button
                type="button"
                className="flex-1 rounded-2xl border border-border-sweet/50 bg-white/70 py-2.5 text-sm text-neutral-600 transition hover:bg-white"
                onClick={goBack}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isBusy}
                className={`flex-1 rounded-2xl py-2.5 font-display text-[14px] font-semibold text-white transition disabled:opacity-60 ${saveButtonColor}`}
                onClick={() => void handleSave()}
              >
                {saving ? '保存中…' : imageUploading ? '上传中…' : isReport ? '撕下便签 · 贴给 ta' : '保存'}
              </button>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
