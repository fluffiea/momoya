import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';
import { normalizeAvatarBlob } from '@/lib/imageCompression';

type Props = {
  open: boolean;
  /** 选中的源图（可能较大；react-easy-crop 用 Image() 加载无压力，但建议上游先压过） */
  sourceFile: File | null;
  onCancel: () => void;
  /** 用户确认后回传裁剪好的 webp File（≤ 512×512），由父组件负责上传 */
  onConfirm: (file: File) => void | Promise<void>;
  busy?: boolean;
};

const OUTPUT_SIZE = 512;

/**
 * 用 canvas 对原图按裁剪区域精确裁出 OUTPUT_SIZE × OUTPUT_SIZE 的 webp。
 * react-easy-crop 提供的 `pixelCrop` 已经映射到原图像素坐标（含旋转后的坐标系）。
 */
async function cropToBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  // 越界兜底：先铺一层白底，避免透明像素在 iOS/Safari 的 webp 里被渲染成黑色
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('裁剪失败'))),
      'image/webp',
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err instanceof Event ? new Error('图片加载失败') : err);
    img.src = src;
  });
}

export default function AvatarCropModal({
  open,
  sourceFile,
  onCancel,
  onConfirm,
  busy = false,
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !sourceFile) {
      setImageUrl(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPixelCrop(null);
      setError('');
      return;
    }
    const url = URL.createObjectURL(sourceFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, sourceFile]);

  const onCropComplete = useCallback((_area: Area, cropped: Area) => {
    setPixelCrop(cropped);
  }, []);

  const handleConfirm = async () => {
    if (!imageUrl || !pixelCrop) return;
    setError('');
    setProcessing(true);
    try {
      const blob = await cropToBlob(imageUrl, pixelCrop);
      const file = await normalizeAvatarBlob(blob, 'avatar.webp');
      await onConfirm(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : '裁剪失败');
    } finally {
      setProcessing(false);
    }
  };

  if (!open || !imageUrl) return null;

  const disabled = busy || processing;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="裁剪头像"
    >
      <div className="flex w-[92vw] max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-neutral-100 px-4 py-3 text-center">
          <h2 className="font-display text-[15px] font-bold text-brown-title">选择头像区域</h2>
          <p className="mt-0.5 text-[11px] text-neutral-400">拖动调整位置 · 双指或滑动条缩放</p>
        </header>

        {/* 裁剪区：固定正方形舞台，圆形选区 */}
        <div className="relative aspect-square w-full bg-neutral-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            minZoom={1}
            maxZoom={5}
            zoomSpeed={0.5}
            objectFit="cover"
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span aria-hidden className="font-display text-[11px] text-brown-title/60">缩放</span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={disabled}
            className="flex-1 accent-[#e891b0]"
            aria-label="缩放"
          />
          <span className="w-10 text-right font-display text-[11px] tabular-nums text-brown-title/60">
            {zoom.toFixed(1)}×
          </span>
        </div>

        {error ? (
          <p className="px-4 pb-2 text-center text-[12px] text-rose-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2.5 border-t border-neutral-100 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="flex-1 rounded-2xl border border-border-sweet/50 bg-white py-2.5 text-sm text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={disabled || !pixelCrop}
            className="flex-1 rounded-2xl bg-[#e891b0] py-2.5 font-display text-[14px] font-bold text-white shadow-[0_6px_18px_rgb(232_145_176/0.32)] transition hover:bg-[#d4769a] disabled:opacity-60"
          >
            {processing ? '处理中…' : busy ? '上传中…' : '确认'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
