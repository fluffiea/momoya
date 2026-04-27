import { TAG_NAME_MAX } from '@momoya/shared'

/**
 * 解析「自由输入」模式下的 tag 字符串（日常发布页用）。
 *
 * 规则：
 * 1. 用半角 `,` 或 全角 `，` 分割
 * 2. trim 每一段
 * 3. 去空
 * 4. 去重（保持首次出现顺序）
 * 5. 超过 TAG_NAME_MAX 的强制截断到上限
 */
export function parseTagInput(raw: string): string[] {
  if (!raw) return []
  const parts = raw.split(/[,，]/)
  const out: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const t = p.trim().slice(0, TAG_NAME_MAX)
    if (!t) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** 反向：已选 tag 数组拼回输入框字符串（用于编辑态回填）。 */
export function stringifyTagInput(tags: readonly string[]): string {
  return tags.join(',')
}
