/**
 * 小程序端运行时配置。
 * Taro 会在构建期内联 `process.env.NODE_ENV` 与 `TARO_APP_*`。
 */

const DEV_API_HOST = process.env.TARO_APP_DEV_API_HOST || 'localhost'
const DEV_API_PORT = process.env.TARO_APP_DEV_API_PORT || '3000'
const DEV_API_BASE = `http://${DEV_API_HOST}:${DEV_API_PORT}/api/v1`

// TODO(launch): 上线前改成真实 HTTPS API 地址；保留 throw 防止占位域名进正式包。
const PROD_API_BASE = 'https://api.momoya.example.com/api/v1'

function resolveApiBase(): string {
  if (process.env.NODE_ENV !== 'production') return DEV_API_BASE
  if (PROD_API_BASE.includes('example.com')) {
    throw new Error(
      '[momoya config] PROD_API_BASE 仍是占位域名，请先在 apps/mobile/src/config/index.ts 改成真实线上地址。',
    )
  }
  return PROD_API_BASE
}

export const API_BASE_URL = resolveApiBase()

/** 去掉 `/api/v1` 后的 HTTP(S) 源，用于静态资源与 Socket 默认地址 */
const appHttpOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

/** Socket.IO 根地址；空值时与 API 同源。变量必须在 `.env.*` 中声明。 */
const rawWsUrlFromBuild = process.env.TARO_APP_WS_URL || ''
export const WS_ORIGIN_URL =
  rawWsUrlFromBuild.length > 0 ? rawWsUrlFromBuild : appHttpOrigin

/** 静态资源前缀；后端将上传目录挂到同源 `/static`。 */
export const STATIC_BASE_URL = `${appHttpOrigin}/static`

/** 将后端返回的 `/static/...` 补成完整 URL；完整 URL 与空值原样处理。 */
export function resolveAssetUrl(input: string | undefined | null): string {
  if (!input) return ''
  if (/^https?:\/\//i.test(input)) return input
  if (input.startsWith('/static/')) {
    return STATIC_BASE_URL + input.slice('/static'.length)
  }
  return input
}

export const REQUEST_TIMEOUT_MS = 10_000

// 页面侧统一从这里取共享常量，避免到处引用 shared。
export { UPLOAD_MAX_SIZE_BYTES } from '@momoya/shared'
