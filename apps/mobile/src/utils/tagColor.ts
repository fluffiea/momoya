import { POST_TAG_PALETTE } from '@momoya/shared'

/** djb2 风格的稳定字符串哈希，用于按 tag name 选定调色板下标。 */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  // 转成非负整数
  return h >>> 0
}

export interface TagPaletteEntry {
  /** 背景色（#RRGGBB） */
  bg: string
  /** 文字色（#RRGGBB） */
  text: string
}

export function getTagPalette(name: string): TagPaletteEntry {
  const idx = hashString(name) % POST_TAG_PALETTE.length
  return POST_TAG_PALETTE[idx]
}
