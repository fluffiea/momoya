import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { toUserPublic } from '../lib/userPublic.js';
import { validateSessionOr401 } from '../middleware/sessionAuth.js';
import { notifyStaleSseConnections } from '../lib/dailyEvents.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '尝试次数过多，请稍后再试' },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const username = String(req.body?.username ?? '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!username || !password) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }
  const user = await User.findOne({ username });
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  try {
    // 先换新 session id，再递增版本，避免「先改库、regenerate 失败」导致全端无法登录
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    user.authSessionVersion = (user.authSessionVersion ?? 0) + 1;
    // 先写一枚"最近活跃"游标：REST 兜底（/api/profile/partner）在前端 SSE 尚未建立的空窗期
    // 仍能把本次登录视为"刚刚活跃"。SSE 接上后 adjustPresence 会负责实时广播 active。
    user.lastActiveAt = new Date();
    await user.save();
    const nextVer = Math.trunc(Number(user.authSessionVersion ?? 0));
    if (!Number.isFinite(nextVer) || nextVer < 0) {
      res.status(500).json({ error: '登录失败，请稍后再试' });
      return;
    }
    req.session.userId = String(user._id);
    req.session.authVersion = nextVer;
    // 等登录响应发出后再踢旧 SSE：给浏览器先 `close()` 旧 EventSource 的时间，避免同标签误收 session.replaced。
    // 旧连接被踢 → 触发 adjustPresence(-1)，但下线广播走防抖，新设备稍后建立 SSE 时会取消 away，不会产生绿点闪烁。
    res.once('finish', () => {
      notifyStaleSseConnections(String(user._id), nextVer);
    });
    res.json({ user: toUserPublic(user) });
  } catch (e) {
    console.error('[auth] login session error', e);
    res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: '退出失败' });
      return;
    }
    res.clearCookie('momoya.sid', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.json({ ok: true });
  });
});

authRouter.get('/me', async (req, res, next) => {
  try {
    const user = await validateSessionOr401(req, res);
    if (!user) return;
    res.json({ user: toUserPublic(user) });
  } catch (err) {
    next(err);
  }
});
