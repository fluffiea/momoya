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
  | { type: 'comment.deleted'; entryId: string; commentId: string; by: string };

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
  // 兼容默认 message 事件（如果后端未来切换）
  es.onmessage = (ev) => dispatch(ev.data);
  es.onerror = () => {
    // EventSource 会自行重连；保持连接但不抛错
  };
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
