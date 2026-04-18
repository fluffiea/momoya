import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { User } from '../models/User.js';
import { toUserPublic } from '../lib/userPublic.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { AVATARS_DIR } from '../paths.js';
import { AVATAR_STATIC_PREFIX, isSafeAvatarFilename, tryDeleteAvatarFile } from '../lib/avatarFiles.js';
import { encryptProfileField } from '../lib/fieldCrypto.js';

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

const mimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, AVATARS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = mimeToExt[file.mimetype]!;
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (mimeToExt[file.mimetype]) {
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
  const { displayName, bio } = req.body ?? {};
  if (displayName === undefined && bio === undefined) {
    res.json({ user: toUserPublic(user) });
    return;
  }
  if (displayName !== undefined) {
    user.profile.displayName = encryptProfileField(String(displayName).slice(0, 120));
  }
  if (bio !== undefined) {
    user.profile.bio = encryptProfileField(String(bio).slice(0, 2000));
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
          msg = '文件过大（最大 3MB）';
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
      await unlink(req.file.path).catch(() => {});
      res.status(401).json({ error: '未登录' });
      return;
    }
    const name = path.basename(req.file.filename);
    if (!isSafeAvatarFilename(name)) {
      await unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: '无效文件名' });
      return;
    }
    const prev = user.profile?.avatarUrl;
    const nextUrl = `${AVATAR_STATIC_PREFIX}${name}`;
    user.profile.avatarUrl = nextUrl;
    try {
      await user.save();
    } catch {
      await unlink(req.file.path).catch(() => {});
      res.status(500).json({ error: '保存失败' });
      return;
    }
    tryDeleteAvatarFile(prev);
    res.json({ user: toUserPublic(user) });
  },
);
