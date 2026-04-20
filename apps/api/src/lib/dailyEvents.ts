import type { Request, Response } from 'express';
import type { DailySyncBootstrapPayload, PresenceSsePayload } from '@momoya/shared';
import { pairedPartnerUsername } from '@momoya/shared';
import { User } from '../models/User.js';
import { DailyEntryModel } from '../models/DailyEntry.js';
import { SESSION_REPLACED_MSG } from '../middleware/sessionAuth.js';

/**
 * SSE（Server-Sent Events）广播中心
 *
 * 通道：
 * - `event: daily`    ── 日常/评论/报备变更
 * - `event: presence` ── 在线态；由 **SSE 连接生命周期** 驱动（与日常同源、秒级），
 *                        仅广播给「当事人 + 其配对方」，避免过度广播
 * - `event: sync`     ── 新连接建立后**单播**的快照（双人在线态 + 日常时间线游标）
 * - `event: auth`     ── 单设备会话替换（session.replaced）
 *
 * 在线态策略：
 * - 每条 SSE 连接即一张「在线票」；同一用户多标签用计数聚合（最后一条断才判离线）
 * - 下线广播走 **防抖**：计数降到 0 后延迟 {@link AWAY_DEBOUNCE_MS} 再真正广播 `away`，
 *   期间若又连上则取消。这样「别处登录踢旧 SSE + 新设备紧接着连」不会产生绿点闪烁。
 * - DB `lastActiveAt` 只 `$set`、不 `$unset`，作为跨进程/冷启动的 REST 兜底游标
 * - keepalive 刷新 `lastActiveAt`（频率可调）以便 REST 窗口判断「最近还活着」
 *
 * **部署假设（阶段 A）**：双用户、单机 API。水平扩展需 sticky session 或 Redis 广播（见 deploy/nginx.conf 注释）。
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DailyEvent =
  | { type: 'entry.created'; entryId: string; by: string; bodyPreview?: string }
  | { type: 'entry.updated'; entryId: string; by: string; bodyPreview?: string }
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
  usernameLower: string;
  keepAlive: ReturnType<typeof setInterval>;
  cleanup: () => void;
};

// ─── Module state ──────────────────────────────────────────────────────────────

const clients = new Set<SseClient>();

/** userId → 当前活跃 SSE 连接数（多标签聚合） */
const connectionCountByUserId = new Map<string, number>();

/** userId → 待触发的 away 广播定时器（防抖） */
const pendingAwayTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** keepalive 间隔（ms）；可用 `DAILY_SSE_KEEPALIVE_MS` 覆盖，夹在 10s–120s */
const KEEPALIVE_MS = (() => {
  const raw = Number(process.env.DAILY_SSE_KEEPALIVE_MS);
  if (!Number.isFinite(raw)) return 25_000;
  return Math.min(120_000, Math.max(10_000, Math.trunc(raw)));
})();

/**
 * 下线防抖：计数 → 0 后延迟多久再真正广播 `away`。
 * 需覆盖「踢旧会话 + 新设备建连」的典型时窗（浏览器通常 <1s）。
 */
const AWAY_DEBOUNCE_MS = (() => {
  const raw = Number(process.env.DAILY_SSE_AWAY_DEBOUNCE_MS);
  if (!Number.isFinite(raw)) return 2_500;
  return Math.min(30_000, Math.max(0, Math.trunc(raw)));
})();

// ─── IO helpers ────────────────────────────────────────────────────────────────

function writeOrCleanup(client: SseClient, chunk: string): void {
  try {
    client.res.write(chunk);
  } catch {
    client.cleanup();
  }
}

/** 向满足 predicate 的 clients 广播；未指定 predicate 则广播给所有人 */
function broadcast(chunk: string, predicate?: (c: SseClient) => boolean): void {
  for (const c of [...clients]) {
    if (predicate && !predicate(c)) continue;
    writeOrCleanup(c, chunk);
  }
}

function unicast(client: SseClient, chunk: string): void {
  if (!clients.has(client)) return;
  writeOrCleanup(client, chunk);
}

function presenceChunk(payload: PresenceSsePayload): string {
  return `event: presence\ndata: ${JSON.stringify(payload)}\n\n`;
}

function syncChunk(payload: DailySyncBootstrapPayload): string {
  return `event: sync\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * 配对观众：某一方 presence 变化时，应投递到「当事人 + 其配对方」的 SSE 客户端。
 * 非配对账号不接收，避免未来扩展多用户时把在线态广播给无关方。
 */
function presenceAudience(subjectUsernameLower: string): (c: SseClient) => boolean {
  const partner = pairedPartnerUsername(subjectUsernameLower);
  const allowed = new Set<string>([subjectUsernameLower]);
  if (partner) allowed.add(partner);
  return (c) => allowed.has(c.usernameLower);
}

// ─── Presence state management ────────────────────────────────────────────────

function getConnectionCount(userId: string): number {
  return connectionCountByUserId.get(userId) ?? 0;
}

function setConnectionCount(userId: string, next: number): void {
  if (next <= 0) connectionCountByUserId.delete(userId);
  else connectionCountByUserId.set(userId, next);
}

function cancelPendingAway(userId: string): void {
  const t = pendingAwayTimers.get(userId);
  if (t) {
    clearTimeout(t);
    pendingAwayTimers.delete(userId);
  }
}

/** 0→1：立即广播上线 + 刷新 DB 活跃时间 */
function onFirstConnectionUp(userId: string, usernameLower: string): void {
  cancelPendingAway(userId);
  void User.findByIdAndUpdate(userId, { $set: { lastActiveAt: new Date() } }).exec();
  broadcast(
    presenceChunk({ kind: 'active', username: usernameLower, at: new Date().toISOString() }),
    presenceAudience(usernameLower),
  );
}

/** 1→0：**防抖**后广播下线（期间回到 ≥1 则取消）；DB 不 `$unset`，保留历史 */
function onLastConnectionDown(userId: string, usernameLower: string): void {
  cancelPendingAway(userId);
  if (AWAY_DEBOUNCE_MS <= 0) {
    broadcast(
      presenceChunk({ kind: 'away', username: usernameLower, at: new Date().toISOString() }),
      presenceAudience(usernameLower),
    );
    return;
  }
  const timer = setTimeout(() => {
    pendingAwayTimers.delete(userId);
    if (getConnectionCount(userId) > 0) return;
    broadcast(
      presenceChunk({ kind: 'away', username: usernameLower, at: new Date().toISOString() }),
      presenceAudience(usernameLower),
    );
  }, AWAY_DEBOUNCE_MS);
  pendingAwayTimers.set(userId, timer);
}

function adjustPresence(userId: string, delta: -1 | 1, usernameLower: string): void {
  const prev = getConnectionCount(userId);
  const next = Math.max(0, prev + delta);
  setConnectionCount(userId, next);
  if (prev === 0 && next >= 1) {
    onFirstConnectionUp(userId, usernameLower);
  } else if (prev >= 1 && next === 0) {
    onLastConnectionDown(userId, usernameLower);
  }
}

/** 本进程内该用户是否有活跃 SSE 连接（多标签任一即可） */
export function isUserSseConnected(userId: string): boolean {
  return getConnectionCount(String(userId)) >= 1;
}

/** 同上，按 username 维度判断（用于 REST 兜底接口） */
export function isUsernameSseConnected(usernameLower: string): boolean {
  const u = String(usernameLower).trim().toLowerCase();
  if (!u) return false;
  for (const c of clients) {
    if (c.usernameLower === u) return true;
  }
  return false;
}

// ─── Snapshot (sync bootstrap) ─────────────────────────────────────────────────

function lastActiveIso(raw: unknown): string | null {
  if (!raw) return null;
  const t = new Date(raw as Date).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * sync 的在线态**只信进程内连接计数**，不看 DB 窗口。
 * 原因：DB `lastActiveAt` 的 N 秒窗口会在"partner 刚离线但窗口未过期"时错误判为在线，
 * 与 SSE 生命周期驱动的 presence 事件产生语义冲突。
 * 跨进程场景（阶段 B）走 Redis 广播统一 presence，DB 窗口仅供 REST 冷启动兜底。
 */
async function buildSyncBootstrap(
  userId: string,
  usernameLower: string,
): Promise<DailySyncBootstrapPayload> {
  const partnerUsername = pairedPartnerUsername(usernameLower);
  const [selfDoc, partnerDoc, latest] = await Promise.all([
    User.findById(userId).lean<{ lastActiveAt?: Date | null } | null>(),
    partnerUsername
      ? User.findOne({ username: partnerUsername }).lean<{ lastActiveAt?: Date | null } | null>()
      : Promise.resolve(null),
    DailyEntryModel.findOne()
      .sort({ at: -1, _id: -1 })
      .select({ at: 1 })
      .lean<{ at?: Date } | null>(),
  ]);

  // self 在 adjustPresence(+1) 之后一定 ≥1，仍显式读 count 保持语义自洽
  const presences: DailySyncBootstrapPayload['presences'] = [
    {
      username: usernameLower,
      online: isUserSseConnected(userId),
      lastActiveAt: lastActiveIso(selfDoc?.lastActiveAt),
    },
  ];

  if (partnerUsername) {
    presences.push({
      username: partnerUsername,
      online: isUsernameSseConnected(partnerUsername),
      lastActiveAt: lastActiveIso(partnerDoc?.lastActiveAt),
    });
  }

  return {
    kind: 'bootstrap',
    presences,
    latestEntryAt: latest?.at ? new Date(latest.at).toISOString() : null,
  };
}

async function sendSyncBootstrap(client: SseClient): Promise<void> {
  try {
    const payload = await buildSyncBootstrap(client.userId, client.usernameLower);
    unicast(client, syncChunk(payload));
  } catch {
    // 快照失败不致命，sync 事件丢一条不影响后续增量同步
  }
}

// ─── Public broadcast APIs ────────────────────────────────────────────────────

/** 日常/评论变更广播，所有已连接 client 收 */
export function broadcastDailyEvent(event: DailyEvent): void {
  broadcast(`event: daily\ndata: ${JSON.stringify(event)}\n\n`);
}

/**
 * 显式 presence 广播（目前内部由 SSE 生命周期驱动，**不建议**从路由直接调用）。
 * 保留导出用于将来极少数需要"瞬时上线通知"的场景（如强制刷新另一方 UI）。
 */
export function broadcastPresenceUpdate(payload: PresenceSsePayload): void {
  broadcast(presenceChunk(payload), presenceAudience(payload.username));
}

/** 别处登录抬高版本后，向仍挂在旧版本上的本用户 SSE 推送并断开 */
export function notifyStaleSseConnections(userId: string, newVersion: number): void {
  const v = Math.trunc(Number(newVersion));
  if (!Number.isFinite(v) || v < 0) return;
  const uid = String(userId);
  const chunk = `event: auth\ndata: ${JSON.stringify({
    type: 'session.replaced' as const,
    message: SESSION_REPLACED_MSG,
  })}\n\n`;
  for (const c of [...clients]) {
    if (c.userId !== uid) continue;
    if (c.authVersion >= v) continue;
    try {
      c.res.write(chunk);
    } catch {
      // ignore
    }
    c.cleanup();
  }
}

// ─── Subscribe (connection entry point) ────────────────────────────────────────

/**
 * 注册一个 SSE 长连接（须在鉴权通过、session 已写 userId/authVersion 之后调用）。
 * @param username 当前用户登录名；内部统一按 lower-case 使用
 */
export function subscribeDailyEvents(req: Request, res: Response, username: string): void {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const rawAv = req.session.authVersion;
  if (rawAv === undefined || rawAv === null) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const authVersion = Math.trunc(Number(rawAv));
  if (!Number.isFinite(authVersion) || authVersion < 0) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const usernameLower = String(username).trim().toLowerCase();
  if (!usernameLower) {
    res.status(400).json({ error: '无效用户' });
    return;
  }

  const uid = String(userId);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`retry: 5000\n`);
  res.write(`: connected\n\n`);

  const client = {
    res,
    userId: uid,
    authVersion,
    usernameLower,
    keepAlive: null as unknown as ReturnType<typeof setInterval>,
    cleanup: () => {},
  } as SseClient;

  const cleanup = () => {
    if (!clients.has(client)) return;
    clearInterval(client.keepAlive);
    clients.delete(client);
    adjustPresence(uid, -1, usernameLower);
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
      // keepalive 兼任刷新 DB 活跃时间，便于 REST 兜底对 partner 判断"最近还活着"
      void User.findByIdAndUpdate(uid, { $set: { lastActiveAt: new Date() } }).exec();
    } catch {
      cleanup();
    }
  }, KEEPALIVE_MS);

  clients.add(client);
  adjustPresence(uid, +1, usernameLower);
  void sendSyncBootstrap(client);

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('error', cleanup);
}
