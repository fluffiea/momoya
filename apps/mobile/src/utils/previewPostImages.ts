import Taro from '@tarojs/taro'
import { resolveAssetUrl } from '../config'

/**
 * 与 useRemoteImage 相同判定：仅对外部 `http://` 资源需先走 downloadFile，
 * 微信基础库 3.x 下直接 `previewImage` 会长期转圈/失败；HTTPS 与已本地路径原样使用。
 */
function needsHttpDownload(url: string): boolean {
  if (!url || !url.startsWith('http://')) return false
  if (url.startsWith('http://tmp/') || url.startsWith('http://usr/')) return false
  return true
}

/**
 * 日常 / 报备 列表与详情里预览 `post.images`（含 `/static/...` 经 resolve 后的 dev HTTP URL）。
 */
export async function previewPostImages(
  relativeOrAbsolutePaths: string[],
  currentIndex: number,
): Promise<void> {
  if (relativeOrAbsolutePaths.length === 0) return
  const abs = relativeOrAbsolutePaths.map((p) => resolveAssetUrl(p))
  const paths = await Promise.all(
    abs.map(async (u) => {
      if (needsHttpDownload(u)) {
        try {
          const res = await Taro.downloadFile({ url: u })
          if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
            return res.tempFilePath
          }
        } catch {
          /* use fallback u */
        }
      }
      return u
    }),
  )
  const n = Math.max(0, Math.min(currentIndex, paths.length - 1))
  const current = paths[n] ?? paths[0]
  if (!current) return
  try {
    await Taro.previewImage({ urls: paths, current })
  } catch {
    Taro.showToast({ title: '无法预览', icon: 'none' })
  }
}
