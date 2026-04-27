import Taro from '@tarojs/taro'
import {
  ErrorKey,
  type ErrorKeyType,
  isSessionFatal,
  type TokenPairDto,
} from '@momoya/shared'
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config'
import { useAuthStore } from '../store/authStore'

/** 后端统一响应外壳。 */
export interface ApiResponseWrapper<T> {
  code: number
  data: T | null
  msg: string
  errorKey?: ErrorKeyType
}

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly msg: string,
    public readonly errorKey: ErrorKeyType | undefined,
    public readonly status: number,
  ) {
    super(msg)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: unknown
  headers?: Record<string, string>
  /** 跳过自动注入 Authorization，例如 /auth/login、/auth/refresh。 */
  skipAuth?: boolean
  /** 内部使用：避免 refresh 后无限重试。 */
  _retried?: boolean
}

/** 不经过 refresh 拦截的最底层请求。 */
async function rawRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', data, headers = {}, skipAuth } = options
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }
  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  let resp: Taro.request.SuccessCallbackResult<ApiResponseWrapper<T>>
  try {
    resp = await Taro.request<ApiResponseWrapper<T>>({
      url: fullUrl,
      method,
      data: data as Taro.request.Option['data'],
      header: finalHeaders,
      timeout: REQUEST_TIMEOUT_MS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络请求失败'
    throw new ApiError(-1, msg, undefined, 0)
  }

  const status = resp.statusCode
  const body = resp.data as ApiResponseWrapper<T> | undefined

  if (status >= 200 && status < 300 && body && body.code === 0) {
    return body.data as T
  }

  const errorKey = body?.errorKey as ErrorKeyType | undefined
  const msg = body?.msg ?? `HTTP ${status}`
  const code = typeof body?.code === 'number' ? body.code : status
  throw new ApiError(code, msg, errorKey, status)
}

// 并发期间的 refresh 去重：多个请求同时遇到 access 过期，只发一次 refresh
let refreshingPromise: Promise<void> | null = null

async function doRefreshOnce(): Promise<void> {
  if (refreshingPromise) return refreshingPromise
  refreshingPromise = (async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) {
      throw new ApiError(40102, '未登录', ErrorKey.E_AUTH_REQUIRED, 401)
    }
    const tokens = await rawRequest<TokenPairDto>('/auth/refresh', {
      method: 'POST',
      data: { refreshToken },
      skipAuth: true,
    })
    useAuthStore.getState().setTokens(tokens)
  })()
  try {
    await refreshingPromise
  } finally {
    refreshingPromise = null
  }
}

function redirectToLogin(): void {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1]
  const currentRoute = current?.route ?? ''
  if (currentRoute === 'pages/login/index') return
  Taro.reLaunch({ url: '/pages/login/index' }).catch(() => {
    // 小程序未就绪时 reLaunch 可能失败，忽略
  })
}

/**
 * 业务层统一请求。
 * - 自动拼接 API_BASE_URL
 * - 自动带 Authorization
 * - 遇到 E_AUTH_EXPIRED 自动 refresh 一次并重试
 * - 遇到 E_SESSION_KICKED / E_AUTH_INVALID / E_AUTH_REQUIRED 清登录态并踢回登录页
 */
export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await rawRequest<T>(url, options)
  } catch (err) {
    if (!(err instanceof ApiError)) throw err

    if (
      err.errorKey === ErrorKey.E_AUTH_EXPIRED &&
      !options._retried &&
      !options.skipAuth
    ) {
      try {
        await doRefreshOnce()
        return await rawRequest<T>(url, { ...options, _retried: true })
      } catch (refreshErr) {
        useAuthStore.getState().logout()
        redirectToLogin()
        throw refreshErr
      }
    }

    if (isSessionFatal(err.errorKey) && !options.skipAuth) {
      useAuthStore.getState().logout()
      redirectToLogin()
    }
    throw err
  }
}

export const api = {
  get: <T,>(url: string, opts?: Omit<RequestOptions, 'method' | 'data'>) =>
    apiRequest<T>(url, { ...opts, method: 'GET' }),
  post: <T,>(
    url: string,
    data?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'data'>,
  ) => apiRequest<T>(url, { ...opts, method: 'POST', data }),
  patch: <T,>(
    url: string,
    data?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'data'>,
  ) => apiRequest<T>(url, { ...opts, method: 'PATCH', data }),
  put: <T,>(
    url: string,
    data?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'data'>,
  ) => apiRequest<T>(url, { ...opts, method: 'PUT', data }),
  delete: <T,>(url: string, opts?: Omit<RequestOptions, 'method' | 'data'>) =>
    apiRequest<T>(url, { ...opts, method: 'DELETE' }),
}
