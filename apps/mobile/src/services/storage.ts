import Taro from '@tarojs/taro'

/** 小程序 Storage Key 统一在此声明，避免字符串散落各处。 */
export const StorageKey = {
  AccessToken: 'momoya:accessToken',
  RefreshToken: 'momoya:refreshToken',
  User: 'momoya:user',
} as const

export type StorageKeyType = (typeof StorageKey)[keyof typeof StorageKey]

export function readStorage<T>(key: StorageKeyType): T | null {
  try {
    const raw = Taro.getStorageSync(key)
    if (raw === '' || raw === null || raw === undefined) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T
      } catch {
        return raw as unknown as T
      }
    }
    return raw as T
  } catch {
    return null
  }
}

export function writeStorage<T>(key: StorageKeyType, value: T): void {
  try {
    if (value === null || value === undefined) {
      Taro.removeStorageSync(key)
    } else {
      Taro.setStorageSync(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      )
    }
  } catch {
    // 忽略存储错误（小程序存储上限 10MB，正常情况下不会触发）
  }
}

export function clearAuthStorage(): void {
  writeStorage(StorageKey.AccessToken, null)
  writeStorage(StorageKey.RefreshToken, null)
  writeStorage(StorageKey.User, null)
}
