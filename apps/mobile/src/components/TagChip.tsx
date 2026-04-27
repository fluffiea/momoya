import { Text, View } from '@tarojs/components'
import { getTagPalette } from '../utils/tagColor'

export interface TagChipProps {
  name: string
  /** 小号展示在卡片上；大号在选择器里 */
  size?: 'sm' | 'md'
  /** 右上角显示删除按钮（报备 custom tag 的管理场景） */
  removable?: boolean
  /** 被选中的视觉状态（发布页的 tag picker） */
  selected?: boolean
  onTap?: () => void
  onRemove?: () => void
}

export default function TagChip({
  name,
  size = 'sm',
  removable,
  selected,
  onTap,
  onRemove,
}: TagChipProps) {
  const palette = getTagPalette(name)
  const base = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  const ring = selected
    ? 'ring-2 ring-pink-400 ring-offset-1 ring-offset-white'
    : ''
  return (
    <View
      className={`inline-flex items-center gap-1 rounded-full ${base} ${ring}`}
      style={{ backgroundColor: palette.bg, color: palette.text }}
      onClick={onTap}
    >
      <Text style={{ color: palette.text }}>{name}</Text>
      {removable ? (
        <View
          className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/10"
          catchMove
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
        >
          <Text className="text-[10px] leading-none text-white">×</Text>
        </View>
      ) : null}
    </View>
  )
}
