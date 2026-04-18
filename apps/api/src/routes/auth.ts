import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { toUserPublic } from '../lib/userPublic.js';

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
  req.session.userId = String(user._id);
  res.json({ user: toUserPublic(user) });
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

authRouter.get('/me', async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  res.json({ user: toUserPublic(user) });
});
