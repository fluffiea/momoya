/**
 * 报备 tag 贴纸色：内置「干饭」「没干饭」固定色；其余按 tag.id 稳定映射到调色板（删建同 id 同色）。
 */

const STICKER_CLASSES = [
  'bg-[#f7c8b5] text-[#8a3f29]',
  'bg-[#b8d4e8] text-[#2a4a66]',
  'bg-[#c6dfb4] text-[#3e5f2c]',
  'bg-[#f9e28c] text-[#7a5b10]',
  'bg-[#eac3dc] text-[#84366a]',
  'bg-[#f2d5a7] text-[#8a5a1b]',
] as const;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 内置 label（归一化后）占用前两格，与 UI 内置 chip 一致 */
export function reportTagStickerClass(tag: { id: string; label: string }): string {
  const lk = tag.label.trim().toLowerCase();
  if (lk === '干饭') return STICKER_CLASSES[0];
  if (lk === '没干饭') return STICKER_CLASSES[1];
  const idx = 2 + (hashId(tag.id) % 4);
  return STICKER_CLASSES[idx];
}
