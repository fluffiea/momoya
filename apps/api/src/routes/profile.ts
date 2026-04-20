import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import sharp from 'sharp';
import type { DailyTag } from '@momoya/shared';
import { User } from '../models/User.js';
import { toUserPublic } from '../lib/userPublic.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { AVATARS_DIR } from '../paths.js';
import { AVATAR_STATIC_PREFIX, isSafeAvatarFilename, tryDeleteAvatarFile } from '../lib/avatarFiles.js';
import { encryptProfileField } from '../lib/fieldCrypto.js';

/** 单条自定义 tag 上限长度（展示/输入层也保持同值，避免后端悄悄截断导致前后端不一致） */
const REPORT_TAG_LABEL_MAX = 16;
/** 用户级自定义 tag 上限数量，避免滥用 */
const REPORT_TAG_MAX_ITEMS = 30;
/** 内置 tag label（大小写/首尾空格归一化后等价），这些不允许出现在用户自定义库中 */
const BUILTIN_TAG_LABELS = new Set(['干饭', '没干饭']);

type TagInput = { id?: unknown; label?: unknown };

/**
 * 对 PATCH 过来的 reportTags 做严格归一化：
 *   - 必须是数组
 *   - 每项：id 非空字符串、label trim 后非空且 ≤ REPORT_TAG_LABEL_MAX
 *   - 过滤掉内置 label（如「干饭」），避免持久化库和 UI 内置项重复
 *   - 按 label 小写去重，保留首次出现顺序
 *   - 整体长度裁到 REPORT_TAG_MAX_ITEMS
 */
function normalizeReportTagsInput(raw: unknown): { ok: true; tags: DailyTag[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'reportTags 必须是数组' };
  }
  const seen = new Set<string>();
  const out: DailyTag[] = [];
  for (const item of raw as TagInput[]) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const rawLabel = typeof item.label === 'string' ? item.label.trim() : '';
    if (!id || !rawLabel) continue;
    const label = rawLabel.slice(0, REPORT_TAG_LABEL_MAX);
    if (BUILTIN_TAG_LABELS.has(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: id.slice(0, 64), label });
    if (out.length >= REPORT_TAG_MAX_ITEMS) break;
  }
  return { ok: true, tags: out };
}

export const profileRouter = Router();

profileRouter.use(requireAuth);

const BCRYPT_COST = 12;

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '尝试次数过多，请稍后再试' },
});

const ALLOWED_UPLOAD_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** 头像统一裁剪/压缩参数 */
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_OUTPUT_EXT = '.webp';

// 用 memoryStorage：先把上传文件读到内存，由 sharp 处理后写入磁盘。
// 前端已裁剪 + 压缩，正常文件 < 1MB；上限留 8MB 作为兜底。
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPEG、PNG、WebP'));
    }
  },
});

profileRouter.get('/me', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  res.json({ user: toUserPublic(user) });
});

profileRouter.patch('/me', async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const { displayName, bio, dailyDefaultView, reportTags } = req.body ?? {};
  if (
    displayName === undefined &&
    bio === undefined &&
    dailyDefaultView === undefined &&
    reportTags === undefined
  ) {
    res.json({ user: toUserPublic(user) });
    return;
  }
  if (displayName !== undefined) {
    user.profile.displayName = encryptProfileField(String(displayName).slice(0, 120));
  }
  if (bio !== undefined) {
    user.profile.bio = encryptProfileField(String(bio).slice(0, 2000));
  }
  if (dailyDefaultView !== undefined) {
    if (dailyDefaultView !== 'daily' && dailyDefaultView !== 'report') {
      res.status(400).json({ error: 'dailyDefaultView 取值无效' });
      return;
    }
    user.profile.dailyDefaultView = dailyDefaultView;
  }
  if (reportTags !== undefined) {
    const r = normalizeReportTagsInput(reportTags);
    if (!r.ok) {
      res.status(400).json({ error: r.error });
      return;
    }
    // 用 user.set 走 Mongoose 的路径解析，能确保老 user 文档（没有 reportTags 字段）
    // 在此时被正确写入并标脏，避免"接口看似成功、库里其实没更新"的现象
    user.set('profile.reportTags', r.tags);
  }
  await user.save();
  res.json({ user: toUserPublic(user) });
});

profileRouter.patch('/password', passwordChangeLimiter, async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: '请填写当前密码和新密码' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: '新密码至少 6 位' });
    return;
  }
  if (newPassword.length > 128) {
    res.status(400).json({ error: '新密码过长' });
    return;
  }
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    res.status(400).json({ error: '当前密码不正确' });
    return;
  }
  const same = await bcrypt.compare(newPassword, user.passwordHash);
  if (same) {
    res.status(400).json({ error: '新密码不能与当前密码相同' });
    return;
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await user.save();
  res.json({ ok: true });
});

profileRouter.post(
  '/avatar',
  (req, res, next) => {
    avatarUpload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: string }).code) : '';
        let msg = err instanceof Error ? err.message : '上传失败';
        if (code === 'LIMIT_FILE_SIZE') {
          msg = '图片过大，请换一张更小的图片';
        }
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '请选择图片文件' });
      return;
    }
    const user = await User.findById(req.session.userId);
    if (!user) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    // sharp 居中"cover"裁剪 → 正方形 → 缩放到 512×512 → 输出 webp。
    // 这样无论原图比例如何，存盘的头像都是 1:1，前端任意位置展示都不会出现黑边/拉伸。
    let processed: Buffer;
    try {
      processed = await sharp(req.file.buffer, { failOn: 'error' })
        .rotate() // 自动应用 EXIF 方向，避免手机拍的图旋转错位
        .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, {
          fit: 'cover',
          position: 'attention', // 智能选择主体居中（人像通常会保留脸部）
        })
        .webp({ quality: 88 })
        .toBuffer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '图片处理失败';
      res.status(400).json({ error: `图片处理失败：${msg}` });
      return;
    }

    const filename = `${randomUUID()}${AVATAR_OUTPUT_EXT}`;
    if (!isSafeAvatarFilename(filename)) {
      res.status(500).json({ error: '无效文件名' });
      return;
    }
    const fullPath = path.join(AVATARS_DIR, filename);
    try {
      await writeFile(fullPath, processed);
    } catch {
      res.status(500).json({ error: '保存图片失败' });
      return;
    }

    const prev = user.profile?.avatarUrl;
    const nextUrl = `${AVATAR_STATIC_PREFIX}${filename}`;
    user.profile.avatarUrl = nextUrl;
    try {
      await user.save();
    } catch {
      // 写库失败：回滚刚写的文件
      tryDeleteAvatarFile(nextUrl);
      res.status(500).json({ error: '保存失败' });
      return;
    }
    tryDeleteAvatarFile(prev);
    res.json({ user: toUserPublic(user) });
  },
);
