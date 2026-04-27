import Taro from '@tarojs/taro'
import {
  ErrorKey,
  type ErrorKeyType,
  isSessionFatal,
  type UploadImageResultDto,
} from '@momoya/shared'
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config'
import { useAuthStore } from '../store/authStore'
import { ApiError } from './request'
import type { ApiResponseWrapper } from './request'

/**
 * 上传单张图片到 POST /upload/image。
 * Taro.uploadFile 直接吃本地文件路径（来自 chooseMedia / chooseImage），
 * 发送 multipart/form-data；字段名必须是 `file`（与后端 FileInterceptor 对齐）。
 */
export async function uploadImage(
  filePath: string,
): Promise<UploadImageResultDto> {
  const token = useAuthStore.getState().accessToken
  if (!token) {
    throw new ApiError(40102, '未登录', ErrorKey.E_AUTH_REQUIRED, 401)
  }

  let resp: Taro.uploadFile.SuccessCallbackResult
  try {
    resp = await Taro.uploadFile({
      url: `${API_BASE_URL}/upload/image`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      timeout: REQUEST_TIMEOUT_MS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '上传失败'
    throw new ApiError(-1, msg, undefined, 0)
  }

  let parsed: ApiResponseWrapper<UploadImageResultDto> | undefined
  try {
    parsed =
      typeof resp.data === 'string'
        ? (JSON.parse(resp.data) as ApiResponseWrapper<UploadImageResultDto>)
        : (resp.data as ApiResponseWrapper<UploadImageResultDto>)
  } catch {
    throw new ApiError(-1, '服务端响应解析失败', undefined, resp.statusCode)
  }

  if (resp.statusCode >= 200 && resp.statusCode < 300 && parsed?.code === 0 && parsed.data) {
    return parsed.data
  }

  const errorKey = parsed?.errorKey as ErrorKeyType | undefined
  const code = typeof parsed?.code === 'number' ? parsed.code : resp.statusCode
  const msg = parsed?.msg ?? `HTTP ${resp.statusCode}`

  if (errorKey && isSessionFatal(errorKey)) {
    useAuthStore.getState().logout()
    Taro.reLaunch({ url: '/pages/login/index' }).catch(() => {})
  }
  throw new ApiError(code, msg, errorKey, resp.statusCode)
}
