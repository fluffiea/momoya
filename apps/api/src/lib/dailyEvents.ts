import type { Request, Response } from 'express';
import { SESSION_REPLACED_MSG } from '../middleware/sessionAuth.js';

/**
 * SSE（Server-Sent Events）广播中心：
 * - 只为「日常 + 评论」相关变更广播事件
 * - 不携带敏感数据，仅最小元信息（id/by），客户端按需自行刷数据
 * - 使用 keep-alive 注释行避免代理超时
 * - 每条连接记录 userId + authVersion，供别处登录时精准踢掉旧 SSE
 */

export type DailyEvent =
  | { type: 'entry.created'; entryId: string; by: string }
  | { type: 'entry.updated'; entryId: string; by: string }
  | { type: 'entry.deleted'; entryId: string; by: string }
  | {
      type: 'comment.created';
      entryId: string;
      commentId: string;
      parentId: string | null;
      by: string;
    }
  | { type: 'comment.updated'; entryId: string; commentId: string; by: string }
  | { type: 'comment.deleted'; entryId: string; commentId: string; by: string }
  /** 报备：对方点击「已阅」后广播 */
  | { type: 'entry.acked'; entryId: string; by: string }
  /** 报备：对方写入或更新「评价」 */
  | { type: 'review.upserted'; entryId: string; by: string }
  /** 报备：对方撤回「评价」 */
  | { type: 'review.deleted'; entryId: string; by: string };

type SseClient = {
  res: Response;
  userId: string;
  authVersion: number;
  keepAlive: ReturnType<typeof setInterval>;
  cleanup: () => void;
};

const clients = new Set<SseClient>();

/** 别处登录抬高版本后，向仍挂在旧版本上的本用户 SSE 推送并断开（不依赖前端轮询） */
export function notifyStaleSseConnections(userId: string, newVersion: number): void {
  const authPayload = {
    type: 'session.replaced' as const,
    message: SESSION_REPLACED_MSG,
  };
  const chunk = `event: auth\ndata: ${JSON.stringify(authPayload)}\n\n`;
  for (const c of [...clients]) {
    if (c.userId !== userId) continue;
    if (c.authVersion >= newVersion) continue;
    try {
      c.res.write(chunk);
    } catch {
      // ignore
    }
    c.cleanup();
  }
}

/** 注册一个 SSE 长连接（须在已通过鉴权、session 已写 userId/authVersion 之后调用） */
export function subscribeDailyEvents(req: Request, res: Response): void {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const authVersion = req.session.authVersion ?? 0;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`retry: 5000\n`);
  res.write(`: connected\n\n`);

  const client = {
    res,
    userId,
    authVersion,
    keepAlive: null as unknown as ReturnType<typeof setInterval>,
    cleanup: () => {},
  } as SseClient;

  const cleanup = () => {
    if (!clients.has(client)) return;
    clearInterval(client.keepAlive);
    clients.delete(client);
    try {
      res.end();
    } catch {
      // ignore
    }
  };
  client.cleanup = cleanup;

  client.keepAlive = setInterval(() => {
    try {
      res.write(`: ka\n\n`);
    } catch {
      cleanup();
    }
  }, 25_000);

  clients.add(client);

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('error', cleanup);
}

/** 向所有已连接客户端广播一条日常事件 */
export function broadcastDailyEvent(event: DailyEvent): void {
  const payload = `event: daily\ndata: ${JSON.stringify(event)}\n\n`;
  for (const c of [...clients]) {
    try {
      c.res.write(payload);
    } catch {
      c.cleanup();
    }
  }
}
