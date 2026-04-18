import fs from 'node:fs/promises';
import path from 'node:path';
import { AVATARS_DIR } from '../paths.js';

export const AVATAR_STATIC_PREFIX = '/api/static/avatars/';

export async function ensureAvatarsDir(): Promise<void> {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
}

/** multer 保存名：`${uuid}.${jpg|png|webp}` */
const SAFE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function isSafeAvatarFilename(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function tryDeleteAvatarFile(avatarUrl: string | undefined | null): void {
  if (!avatarUrl || !avatarUrl.startsWith(AVATAR_STATIC_PREFIX)) return;
  const name = path.basename(avatarUrl);
  if (!isSafeAvatarFilename(name)) return;
  const full = path.resolve(AVATARS_DIR, name);
  const dir = path.resolve(AVATARS_DIR);
  if (!full.startsWith(dir + path.sep) && full !== dir) return;
  void fs.unlink(full).catch(() => {
    /* ignore missing file */
  });
}
