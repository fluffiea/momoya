import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 通过向上查找 package.json 定位 apps/api 包根目录，使 uploads 相对路径在以下三种结构下都正确：
 *
 * 1. 本地 dev：       apps/api/src/paths.ts        → ../package.json   → apps/api/uploads
 * 2. 旧 dist 结构：   apps/api/dist/paths.js       → ../package.json   → apps/api/uploads
 * 3. 新 dist 结构：   apps/api/dist/src/paths.js   → ../../package.json → apps/api/uploads
 * 4. Docker 容器：    /app/dist/src/paths.js       → /app/package.json  → /app/uploads
 *
 * 找不到则用环境变量 UPLOADS_DIR，再退回原始相对路径。
 */
function findUploadsBase(): string {
  if (process.env.UPLOADS_DIR) return path.resolve(process.env.UPLOADS_DIR);

  let dir = __dir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, 'uploads');
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 兜底（保留原行为）
  return path.resolve(__dir, '..', 'uploads');
}

const UPLOADS_BASE = findUploadsBase();

export const AVATARS_DIR = path.join(UPLOADS_BASE, 'avatars');
export const DAILY_IMAGES_DIR = path.join(UPLOADS_BASE, 'daily-images');
