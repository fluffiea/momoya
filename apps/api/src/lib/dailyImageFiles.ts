import fs from 'node:fs/promises';
import path from 'node:path';
import { DAILY_IMAGES_DIR } from '../paths.js';

export const DAILY_IMAGES_STATIC_PREFIX = '/api/static/daily-images/';

export async function ensureDailyImagesDir(): Promise<void> {
  await fs.mkdir(DAILY_IMAGES_DIR, { recursive: true });
}

/** multer 保存名：`${uuid}.${jpg|png|webp}` */
const SAFE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function isSafeDailyImageFilename(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function tryDeleteDailyImageFile(imageUrl: string | undefined | null): void {
  if (!imageUrl || !imageUrl.startsWith(DAILY_IMAGES_STATIC_PREFIX)) return;
  const name = path.basename(imageUrl);
  if (!isSafeDailyImageFilename(name)) return;
  const full = path.resolve(DAILY_IMAGES_DIR, name);
  const dir = path.resolve(DAILY_IMAGES_DIR);
  if (!full.startsWith(dir + path.sep) && full !== dir) return;
  void fs.unlink(full).catch(() => {
    /* ignore missing file */
  });
}
