/**
 * 小程序端运行时配置。Taro 在构建时会把 `process.env.NODE_ENV` 以及所有
 * `TARO_APP_*` 前缀的变量替换为字面量，所以可以用它做 dev / prod 分支。
 *
 * - 模拟器联调：使用 `pnpm dev:weapp`，默认指向 `http://localhost:3000`。
 *   需要在微信开发者工具「详情 → 本地设置」中勾选「不校验合法域名」。
 * - 真机预览 / 真机调试：localhost 指的是手机自己，必须走电脑在局域网里的 IP。
 *   启动前注入环境变量即可（不用改代码）：
 *       PowerShell:  $env:TARO_APP_DEV_API_HOST='10.172.8.129'; pnpm dev:weapp
 *       bash:        TARO_APP_DEV_API_HOST=10.172.8.129 pnpm dev:weapp
 *   注意：真机调试仍需在开发者工具勾选「不校验合法域名」。
 * - 正式上线：使用 `pnpm build:weapp`，NODE_ENV=production。必须先把下方 PROD_API_BASE
 *   改成真实线上 HTTPS 域名，并在微信公众平台把该域名加入 request 合法域名白名单。
 */

const DEV_API_HOST = process.env.TARO_APP_DEV_API_HOST || 'localhost'
const DEV_API_PORT = process.env.TARO_APP_DEV_API_PORT || '3000'
const DEV_API_BASE = `http://${DEV_API_HOST}:${DEV_API_PORT}/api/v1`

// TODO(launch): 正式上线前把下面的占位域名改成真实生产地址，然后删掉这个 throw。
// 保留 throw 是为了避免误把占位地址打进生产包（历史上就出过 net::ERR_CONNECTION_CLOSED 的事故）。
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

/**
 * Socket.IO 根地址（默认 path `/socket.io`）。
 * `TARO_APP_WS_URL` 必须在对应 mode 的 `.env.*` 里声明（可为空字符串），
 * 以便 Taro 在构建期替换为字面量；小程序运行时没有 `process`，不能残留 `process.env`。
 */
const rawWsUrlFromBuild = process.env.TARO_APP_WS_URL || ''
export const WS_ORIGIN_URL =
  rawWsUrlFromBuild.length > 0 ? rawWsUrlFromBuild : appHttpOrigin

/**
 * 静态资源前缀。后端把 UPLOAD_DIR 挂到 /static，所以用 API_BASE_URL 的 origin
 * 加 /static 即可（与 /api/v1 同域）。若改为 CDN，单独改这里。
 */
export const STATIC_BASE_URL = `${appHttpOrigin}/static`

/**
 * 把后端返回的 /static/... 相对路径拼成完整 URL；若已经是完整 URL 原样返回；
 * 空串返回 ''（组件可据此显示默认图）。
 */
export function resolveAssetUrl(input: string | undefined | null): string {
  if (!input) return ''
  if (/^https?:\/\//i.test(input)) return input
  if (input.startsWith('/static/')) {
    return STATIC_BASE_URL + input.slice('/static'.length)
  }
  return input
}

export const REQUEST_TIMEOUT_MS = 10_000

// 领域常量统一住在 @momoya/shared，这里仅 re-export 方便页面 import。
export { UPLOAD_MAX_SIZE_BYTES } from '@momoya/shared'
