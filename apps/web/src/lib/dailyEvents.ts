import type { DailySyncBootstrapPayload, PresenceSsePayload } from '@momoya/shared';
import {
  notifySessionReplaced,
  SESSION_REPLACED_DEFAULT_MESSAGE,
} from '@/auth/sessionReplaced';
import { resolveApiUrl } from './api';

/**
 * 日常 + 在线 SSE 客户端：单例 EventSource + 订阅器
 *
 * - 在线态与日常评论同源：`presence` 由服务端在 **SSE 连接建立/关闭** 时推送 `active`/`away`，
 *   秒级、无 HTTP 心跳轮询、无定时器轮询
 * - `sync`：重连后服务端单播的快照（双人在线态 + 日常时间线游标），供补齐断线期间的漏推
 * - 浏览器原生 EventSource 自动重连；登出时 `disconnectDailyEvents`
 *
 * **阶段 A**：实时通道为 SSE（`/api/daily/events`）。若未来引入 WebSocket（阶段 B），
 * 可在此做双写过渡再移除 EventSource。
 */

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
  | { type: 'entry.acked'; entryId: string; by: string }
  | { type: 'review.upserted'; entryId: string; by: string }
  | { type: 'review.deleted'; entryId: string; by: string };

type Handler = (event: DailyEvent) => void;
type PresenceHandler = (payload: PresenceSsePayload) => void;
type SyncBootstrapHandler = (payload: DailySyncBootstrapPayload) => void;

const handlers = new Set<Handler>();
const presenceHandlers = new Set<PresenceHandler>();
const syncBootstrapHandlers = new Set<SyncBootstrapHandler>();
let source: EventSource | null = null;

// ─── JSON helpers ──────────────────────────────────────────────────────────────

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    // 仅接受 plain object，拒绝带原型链的「奇怪对象」
    if (Object.getPrototypeOf(v) !== Object.prototype) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isNonEmptyString(v: unknown, max = 256): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function dispatchTo<T>(set: Set<(p: T) => void>, payload: T): void {
  for (const h of set) {
    try {
      h(payload);
    } catch {
      // 单个订阅者异常不影响其他订阅者
    }
  }
}

// ─── Dispatchers ───────────────────────────────────────────────────────────────

function dispatchDaily(raw: string) {
  const o = parseJsonObject(raw);
  if (!o) return;
  if (!isNonEmptyString(o.type, 64)) return;
  dispatchTo(handlers, o as unknown as DailyEvent);
}

function dispatchPresence(raw: string) {
  const o = parseJsonObject(raw);
  if (!o) return;
  const kind = o.kind;
  if (kind !== 'active' && kind !== 'away') return;
  if (!isNonEmptyString(o.username, 64) || !isNonEmptyString(o.at, 64)) return;
  const username = o.username.trim().toLowerCase();
  const at = o.at.trim();
  const payload: PresenceSsePayload =
    kind === 'active' ? { kind: 'active', username, at } : { kind: 'away', username, at };
  dispatchTo(presenceHandlers, payload);
}

function dispatchSyncBootstrap(raw: string) {
  const o = parseJsonObject(raw);
  if (!o) return;
  if (o.kind !== 'bootstrap') return;
  const presRaw = o.presences;
  if (!Array.isArray(presRaw) || presRaw.length === 0 || presRaw.length > 4) return;

  const presences: DailySyncBootstrapPayload['presences'] = [];
  for (const slot of presRaw) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return;
    if (Object.getPrototypeOf(slot) !== Object.prototype) return;
    const s = slot as Record<string, unknown>;
    if (!isNonEmptyString(s.username, 64)) return;
    if (typeof s.online !== 'boolean') return;
    let lastActiveAt: string | null;
    if (s.lastActiveAt === null) {
      lastActiveAt = null;
    } else if (isNonEmptyString(s.lastActiveAt, 64)) {
      lastActiveAt = s.lastActiveAt.trim();
    } else {
      return;
    }
    presences.push({
      username: s.username.trim().toLowerCase(),
      online: s.online,
      lastActiveAt,
    });
  }

  let latestEntryAt: string | null;
  if (o.latestEntryAt === null) {
    latestEntryAt = null;
  } else if (isNonEmptyString(o.latestEntryAt, 64)) {
    latestEntryAt = o.latestEntryAt.trim();
  } else if (o.latestEntryAt === undefined) {
    latestEntryAt = null;
  } else {
    return;
  }

  dispatchTo(syncBootstrapHandlers, { kind: 'bootstrap', presences, latestEntryAt });
}

function dispatchAuth(raw: string) {
  const o = parseJsonObject(raw);
  if (!o) return;
  if (o.type !== 'session.replaced') return;
  const msg =
    typeof o.message === 'string' && o.message.trim().length > 0 && o.message.length <= 500
      ? o.message.trim()
      : SESSION_REPLACED_DEFAULT_MESSAGE;
  notifySessionReplaced(msg);
  // 主动关闭，否则浏览器会按 retry 反复重连 /events，旧 cookie 导致大量 401
  disconnectDailyEvents();
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function connectDailyEvents(): void {
  if (source) return;
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  const url = resolveApiUrl('/api/daily/events');
  const es = new EventSource(url, { withCredentials: true });
  source = es;
  es.addEventListener('daily', (ev) => dispatchDaily((ev as MessageEvent<string>).data));
  es.addEventListener('presence', (ev) => dispatchPresence((ev as MessageEvent<string>).data));
  es.addEventListener('sync', (ev) => dispatchSyncBootstrap((ev as MessageEvent<string>).data));
  es.addEventListener('auth', (ev) => dispatchAuth((ev as MessageEvent<string>).data));
  // 不接收默认 `message` 事件：服务端所有业务包都带 `event:` 前缀，默认通道不应命中任何业务 handler，
  // 否则 sync/presence 的 JSON 形状有可能被当成 daily 事件传入业务层。
}

export function disconnectDailyEvents(): void {
  if (!source) return;
  try {
    source.close();
  } catch {
    // ignore
  }
  source = null;
}

export function subscribeDailyEvents(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function subscribePresence(handler: PresenceHandler): () => void {
  presenceHandlers.add(handler);
  return () => {
    presenceHandlers.delete(handler);
  };
}

/** SSE `sync`：连接建立后的快照（在线态 + 日常游标） */
export function subscribeSyncBootstrap(handler: SyncBootstrapHandler): () => void {
  syncBootstrapHandlers.add(handler);
  return () => {
    syncBootstrapHandlers.delete(handler);
  };
}
