import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __srcDir = path.dirname(fileURLToPath(import.meta.url));

/** `apps/api/uploads/avatars`（源码在 `src/` 下时上一级为 `apps/api`） */
export const AVATARS_DIR = path.join(__srcDir, '..', 'uploads', 'avatars');
