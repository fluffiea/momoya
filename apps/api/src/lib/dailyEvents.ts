import type { Request, Response } from 'express';

/**
 * SSE（Server-Sent Events）广播中心：
 * - 只为「日常 + 评论」相关变更广播事件
 * - 不携带敏感数据，仅最小元信息（id/by），客户端按需自行刷数据
 * - 使用 keep-alive 注释行避免代理超时
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
  | { type: 'comment.deleted'; entryId: string; commentId: string; by: string };

const clients = new Set<Response>();

/** 注册一个 SSE 长连接 */
export function subscribeDailyEvents(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`retry: 5000\n`);
  res.write(`: connected\n\n`);

  clients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(`: ka\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(keepAlive);
    clients.delete(res);
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('error', cleanup);
}

/** 向所有已连接客户端广播一条事件 */
export function broadcastDailyEvent(event: DailyEvent): void {
  const payload = `event: daily\ndata: ${JSON.stringify(event)}\n\n`;
  for (const c of clients) {
    try {
      c.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}
