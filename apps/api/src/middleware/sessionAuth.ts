import type { Request, Response } from 'express';
import { User, type UserDoc } from '../models/User.js';

export const SESSION_REPLACED_CODE = 'SESSION_REPLACED' as const;
export const SESSION_REPLACED_MSG = '账号已在其他设备登录，请重新登录';

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

async function safeDestroySession(req: Request): Promise<void> {
  try {
    await destroySession(req);
  } catch (e) {
    console.error('[sessionAuth] session.destroy failed', e);
  }
}

/**
 * 校验 session 与用户的 authSessionVersion 一致；否则销毁 session 并写入 401。
 * 成功时返回当前用户文档，供 /auth/me 等复用。
 */
export async function validateSessionOr401(req: Request, res: Response): Promise<UserDoc | null> {
  if (!req.session.userId) {
    res.status(401).json({ error: '未登录' });
    return null;
  }
  const user = await User.findById(req.session.userId);
  if (!user) {
    await safeDestroySession(req);
    res.status(401).json({ error: '未登录' });
    return null;
  }
  const rawSv = req.session.authVersion;
  if (rawSv === undefined || rawSv === null) {
    await safeDestroySession(req);
    res.status(401).json({ error: '未登录' });
    return null;
  }
  const sessionVer = Math.trunc(Number(rawSv));
  const userVer = Math.trunc(Number(user.authSessionVersion ?? 0));
  if (!Number.isFinite(sessionVer) || !Number.isFinite(userVer)) {
    await safeDestroySession(req);
    res.status(401).json({ error: '未登录' });
    return null;
  }
  if (sessionVer !== userVer) {
    await safeDestroySession(req);
    res.status(401).json({ error: SESSION_REPLACED_MSG, code: SESSION_REPLACED_CODE });
    return null;
  }
  return user;
}
