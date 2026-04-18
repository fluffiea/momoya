/**
 * 道歉信路由门控：同标签 sessionStorage 记录已验证状态。
 * 纯前端校验无法真正隐藏密码，仅防随手改 URL；真保密需服务端鉴权。
 */
export const APOLOGY_SESSION_KEY = 'momoya:apology-unlocked';

export const APOLOGY_PASSWORD = '0822';

export function readApologyUnlocked() {
  try {
    return sessionStorage.getItem(APOLOGY_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeApologyUnlocked() {
  try {
    sessionStorage.setItem(APOLOGY_SESSION_KEY, '1');
  } catch {
    // 隐私模式等可能不可用
  }
}
