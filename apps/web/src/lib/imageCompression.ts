import imageCompression from 'browser-image-compression';

/**
 * 图片压缩工具：在浏览器里把用户选的大图压缩到合理范围再上传。
 * - 使用 browser-image-compression（worker 内执行，自动应用 EXIF 方向）。
 * - 输出统一为 webp，进一步减小体积。
 * - 始终返回 File，保留原文件名方便后端 contentType 识别失败时走扩展名兜底。
 */

const WEBP_MIME = 'image/webp';

function renameToWebp(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.webp`;
}

async function compressWith(
  file: File,
  opts: {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    initialQuality?: number;
    /** 默认 true；日常/报备选图在部分移动浏览器上 Web Worker 会卡死，需关 worker */
    useWebWorker?: boolean;
  },
): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB: opts.maxSizeMB,
    maxWidthOrHeight: opts.maxWidthOrHeight,
    useWebWorker: opts.useWebWorker ?? true,
    fileType: WEBP_MIME,
    initialQuality: opts.initialQuality ?? 0.85,
    alwaysKeepResolution: false,
  });
  const name = renameToWebp(file.name || 'image.webp');
  if (out instanceof File && out.type === WEBP_MIME && out.name === name) return out;
  return new File([out], name, { type: WEBP_MIME, lastModified: Date.now() });
}

/**
 * 日常/报备图片：目标 ≤ 1.5MB、长边 ≤ 2048。
 * 已经足够小的图片会被直接跳过处理（节省时间）。
 */
export async function compressForDaily(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // 小于 800KB 且已经是 jpeg/webp，基本无需处理
  if (file.size <= 800 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }
  return compressWith(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2048, useWebWorker: false });
}

/**
 * 头像「源图」预处理：先缩到长边 ≤ 4096，避免超大原图交给 react-easy-crop 时卡顿。
 * 裁剪步骤之后还会再做一次缩放到 512×512，所以这里不追求极致大小，保留清晰度用于选区。
 */
export async function compressForAvatarSource(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= 1.5 * 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }
  return compressWith(file, { maxSizeMB: 4, maxWidthOrHeight: 4096, initialQuality: 0.92 });
}

/**
 * 从 canvas blob 输出一张 ≤ 512×512 的圆形/正方形头像，统一 webp。
 * 调用方自己在 canvas 里裁好后交进来。
 */
export async function normalizeAvatarBlob(blob: Blob, fileName = 'avatar.webp'): Promise<File> {
  const asFile = new File([blob], fileName, {
    type: blob.type || WEBP_MIME,
    lastModified: Date.now(),
  });
  return compressWith(asFile, { maxSizeMB: 0.5, maxWidthOrHeight: 512, initialQuality: 0.9 });
}
