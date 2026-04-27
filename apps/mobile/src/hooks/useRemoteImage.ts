import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'

/**
 * 微信基础库 3.x 开始，`<Image src="http://...">` 会被阻断
 * （"不再支持 HTTP 协议，请升级到 HTTPS"）；但 `Taro.downloadFile`
 * 在开发者工具勾选"不校验合法域名"后仍可访问 HTTP，并返回
 * `wxfile://...` 形式的临时路径，可以直接作为 `<Image>` 的 src。
 *
 * 本 hook：
 * - 对 `http://` 开头的外部 URL 走一次 `downloadFile`，返回 tempFilePath；
 * - 对 `https://` / `wxfile://` / `data:` 等自身已合规的协议：原样透传；
 * - 另外对旧版 iOS 微信出现过的 `http://tmp/` / `http://usr/` 形式的 tempFilePath
 *   做一次防御：即使被当作 URL 再传进来也不会触发二次下载；
 * - 进程内缓存同 URL 的 tempFilePath 避免重复下载；
 * - 组件卸载时取消结果回写。
 *
 * 上线后静态资源换成 HTTPS，自动退化成直连，不会多一次 download。
 */

const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function needsDownload(url: string): boolean {
  // 明确只针对 "http://" 开头的外部 URL；微信内部 http://tmp/xxx 保留原样。
  if (!url.startsWith('http://')) return false
  if (url.startsWith('http://tmp/') || url.startsWith('http://usr/')) return false
  return true
}

async function resolve(url: string): Promise<string> {
  const cached = cache.get(url)
  if (cached) return cached
  const pending = inflight.get(url)
  if (pending) return pending

  const task = (async () => {
    try {
      const res = await Taro.downloadFile({ url })
      if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
        cache.set(url, res.tempFilePath)
        return res.tempFilePath
      }
      return ''
    } catch {
      return ''
    } finally {
      inflight.delete(url)
    }
  })()
  inflight.set(url, task)
  return task
}

export function useRemoteImage(url: string | undefined | null): string {
  const initial = !url ? '' : needsDownload(url) ? (cache.get(url) ?? '') : url
  const [src, setSrc] = useState<string>(initial)

  useEffect(() => {
    if (!url) {
      setSrc('')
      return
    }
    if (!needsDownload(url)) {
      setSrc(url)
      return
    }
    const cached = cache.get(url)
    if (cached) {
      setSrc(cached)
      return
    }

    let cancelled = false
    resolve(url).then((path) => {
      if (!cancelled) setSrc(path)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return src
}
