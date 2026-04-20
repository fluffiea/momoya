import {
  notifySessionReplaced,
  SESSION_REPLACED_DEFAULT_MESSAGE,
} from '@/auth/sessionReplaced';
import { resolveApiUrl } from './api';

/**
 * 日常 SSE 客户端：单例 EventSource + 订阅器
 *
 * - 浏览器原生 EventSource 自动重连，不需要手写心跳
 * - 通过 `connectDailyEvents` 在登录后建立连接，登出/失败时调用 `disconnectDailyEvents`
 * - 业务组件用 `subscribeDailyEvents(handler)` 订阅，组件卸载时调用返回的取消函数
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
  | { type: 'entry.acked'; entryId: string; by: string }
  | { type: 'review.upserted'; entryId: string; by: string }
  | { type: 'review.deleted'; entryId: string; by: string };

type Handler = (event: DailyEvent) => void;

const handlers = new Set<Handler>();
let source: EventSource | null = null;

function dispatch(raw: string) {
  try {
    const parsed = JSON.parse(raw) as DailyEvent;
    for (const h of handlers) {
      try {
        h(parsed);
      } catch {
        // ignore handler error
      }
    }
  } catch {
    // ignore non-JSON payload (e.g. heartbeat comments are not delivered as messages)
  }
}

export function connectDailyEvents(): void {
  if (source) return;
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  const url = resolveApiUrl('/api/daily/events');
  const es = new EventSource(url, { withCredentials: true });
  source = es;
  // 后端用 `event: daily` 标记，所以监听该自定义事件
  es.addEventListener('daily', (ev) => {
    dispatch((ev as MessageEvent<string>).data);
  });
  /** 单设备登录：服务端在别处登录后对旧 SSE 推送并断开，走此事件（无需轮询 /auth/me） */
  es.addEventListener('auth', (ev) => {
    try {
      const raw = (ev as MessageEvent<string>).data;
      const data = JSON.parse(raw) as { type?: string; message?: string };
      if (data.type === 'session.replaced') {
        notifySessionReplaced(
          typeof data.message === 'string' && data.message.trim()
            ? data.message.trim()
            : SESSION_REPLACED_DEFAULT_MESSAGE,
        );
        // 主动关闭，否则浏览器会按 retry 反复重连 /events，旧 cookie 导致大量 401
        disconnectDailyEvents();
      }
    } catch {
      // ignore
    }
  });
  // 兼容默认 message 事件（如果后端未来切换）
  es.onmessage = (ev) => dispatch(ev.data);
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
