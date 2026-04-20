/** 与 apiFetch 中 SESSION_REPLACED 分支共用，避免魔法字符串分叉 */

/** 与 API `SESSION_REPLACED_MSG` 一致，供 SSE / 缺省文案使用 */
export const SESSION_REPLACED_DEFAULT_MESSAGE = '账号已在其他设备登录，请重新登录';

export const SESSION_REPLACED_EVENT = 'momoya:session-replaced';

const BROADCAST_NAME = 'momoya-auth-session';

/** 同一标签页内多次并行 401 只通知一次；成功登录后需 reset */
let notifiedThisTab = false;

export function resetSessionReplacedGate() {
  notifiedThisTab = false;
}

/** 广播先于 apiFetch 到达时使用，避免同一标签页重复弹窗/重复 dispatch */
export function markSessionReplacedHandled() {
  notifiedThisTab = true;
}

/**
 * 通知当前页与其他标签页：会话已被新设备取代。
 * 其他标签页不会自动收到 fetch 的 CustomEvent，依赖 BroadcastChannel。
 */
export function notifySessionReplaced(message: string) {
  if (typeof window === 'undefined') return;
  if (notifiedThisTab) return;
  markSessionReplacedHandled();
  window.dispatchEvent(
    new CustomEvent(SESSION_REPLACED_EVENT, { detail: { message } }),
  );
  try {
    const bc = new BroadcastChannel(BROADCAST_NAME);
    bc.postMessage({ message });
    bc.close();
  } catch {
    // 旧环境无 BroadcastChannel
  }
}

export function subscribeSessionReplacedBroadcast(
  onMessage: (message: string) => void,
): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  let bc: BroadcastChannel;
  try {
    bc = new BroadcastChannel(BROADCAST_NAME);
  } catch {
    return () => {};
  }
  bc.onmessage = (ev: MessageEvent<{ message?: string }>) => {
    const msg = typeof ev.data?.message === 'string' ? ev.data.message : '';
    onMessage(msg);
  };
  return () => {
    try {
      bc.close();
    } catch {
      // ignore
    }
  };
}
