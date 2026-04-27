import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { resolveAssetUrl } from '../../config'
import { useRemoteImage } from '../../hooks/useRemoteImage'
import type { PostDto } from '@momoya/shared'
import TagChip from '../TagChip'
import { formatAbsolute, formatRelative } from '../../utils/time'

export const postCardPx = (n: number) => Taro.pxTransform(n)

/** 五色板（与 color-palette.mdc 一致） */
export const postCardColors = {
  deepSlate: '#4A6670',
  tealGreen: '#668F80',
  warmSand: '#C3B59F',
  rosePink: '#D6A2AD',
  sageGreen: '#A0AF84',
} as const

export interface PostListCardBaseProps {
  post: PostDto
  isMine: boolean
  /**
   * 列表卡片长按触发（删除菜单等）。
   * 如果不传，则卡片不响应长按。
   */
  onLongPress?: () => void
  onTap?: () => void
}

export function PostCardBadge({ label, sand }: { label: string; sand?: boolean }) {
  return (
    <View
      className="rounded-full px-2 py-0.5"
      style={{
        backgroundColor: sand ? 'rgba(195,181,159,0.5)' : 'rgba(160,175,132,0.4)',
      }}
    >
      <Text className="text-xs font-medium" style={{ color: postCardColors.deepSlate }}>
        {label}
      </Text>
    </View>
  )
}

export function postCardShellShadow(): string {
  const px = postCardPx
  return `0 ${px(4)} ${px(24)} rgba(74,102,112,0.08)`
}

/** 报备「档案卡」阴影，略强于日常列表卡 */
export function reportArchiveShadow(): string {
  const p = postCardPx
  return `0 ${p(6)} ${p(28)} rgba(74,102,112,0.11)`
}

/** 报备卡片 / 详情主卡内容区浅底（叠在页面上） */
export function reportCardContentSurface(): string {
  return 'rgba(255,253,251,0.98)'
}

/** 报备主卡外框线（slate 系，偏「单据」感） */
export function reportCardBorderColor(): string {
  return 'rgba(74,102,112,0.22)'
}

/** 底栏：阅读/流转状态带（玫瑰沙） */
export function reportFooterRailStyle(): {
  backgroundColor: string
  borderTopWidth: number
  borderTopStyle: 'solid'
  borderTopColor: string
  paddingLeft: string
  paddingRight: string
  paddingTop: string
  paddingBottom: string
} {
  const p = postCardPx
  return {
    backgroundColor: 'rgba(214,162,173,0.12)',
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'rgba(214,162,173,0.28)',
    paddingLeft: p(20),
    paddingRight: p(20),
    paddingTop: p(12),
    paddingBottom: p(12),
  }
}

/**
 * 报备头区：头像 + 昵称 + 单行「发生时间」+ 右侧 tag。
 * `happenedTimeStyle`：列表用相对时间；详情用绝对时间（与底部已阅时间并列，全卡只保留两个时间点）。
 */
export function ReportCardMetaHeader({
  nickname,
  avatarDisplaySrc,
  happenedAt,
  tags = [],
  showAllTags = false,
  happenedTimeStyle = 'relative',
}: {
  nickname: string
  avatarDisplaySrc: string | null
  happenedAt: string
  tags?: string[]
  showAllTags?: boolean
  /** 发生时刻展示：相对或绝对，只渲染一行 */
  happenedTimeStyle?: 'relative' | 'absolute'
}) {
  const p = postCardPx
  const cap = showAllTags ? tags.length : 3
  const tagPreview = tags.slice(0, cap)
  const tagRest = tags.length - tagPreview.length
  const happenedLabel =
    happenedTimeStyle === 'absolute' ? formatAbsolute(happenedAt) : formatRelative(happenedAt)
  const happenedSubColor =
    happenedTimeStyle === 'absolute' ? 'rgba(74,102,112,0.55)' : postCardColors.tealGreen

  return (
    <View className="flex min-w-0 flex-row items-center" style={{ gap: p(14) }}>
      <View
        className="h-12 w-12 shrink-0 overflow-hidden rounded-full"
        style={{
          backgroundColor: 'rgba(195,181,159,0.35)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'rgba(102,143,128,0.22)',
        }}
      >
        {avatarDisplaySrc ? (
          <Image src={avatarDisplaySrc} className="h-full w-full" mode="aspectFill" />
        ) : (
          <View className="flex h-full w-full items-center justify-center">
            <Text style={{ fontSize: p(34), color: postCardColors.rosePink }}>♡</Text>
          </View>
        )}
      </View>
      <View className="flex min-w-0 flex-1 flex-col" style={{ gap: p(4) }}>
        <Text
          className="truncate font-bold"
          style={{ fontSize: p(30), color: postCardColors.deepSlate, lineHeight: p(40) }}
        >
          {nickname}
        </Text>
        <Text className="truncate font-medium" style={{ color: happenedSubColor, fontSize: p(22) }}>
          {happenedLabel}
        </Text>
      </View>
      {tags.length > 0 ? (
        <View
          className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-1.5"
          style={{ maxWidth: '48%' }}
        >
          {tagPreview.map((t) => (
            <TagChip key={t} name={t} />
          ))}
          {tagRest > 0 ? (
            <Text className="text-xs font-semibold" style={{ color: postCardColors.tealGreen }}>
              +{tagRest}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** 角标「报备」— 方框印章式，区别于日常圆角 PostCardBadge */
export function ReportTypeStamp() {
  const p = postCardPx
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(102,143,128,0.5)',
        paddingLeft: p(10),
        paddingRight: p(10),
        paddingTop: p(4),
        paddingBottom: p(4),
        borderRadius: p(6),
        backgroundColor: 'rgba(102,143,128,0.08)',
      }}
    >
      <Text
        style={{
          fontSize: p(20),
          fontWeight: '700',
          color: postCardColors.deepSlate,
          letterSpacing: p(4),
        }}
      >
        报备
      </Text>
    </View>
  )
}

export type ReportStatusPillTone = 'unread' | 'read' | 'eval'

/** 报备列表底部状态 pill */
export function ReportStatusPill({
  label,
  tone,
}: {
  label: string
  tone: ReportStatusPillTone
}) {
  const p = postCardPx
  const { backgroundColor, borderColor, textColor } =
    tone === 'unread'
      ? {
          backgroundColor: 'rgba(214,162,173,0.16)',
          borderColor: 'rgba(214,162,173,0.5)',
          textColor: postCardColors.rosePink,
        }
      : tone === 'read'
        ? {
            backgroundColor: 'rgba(160,175,132,0.2)',
            borderColor: 'rgba(160,175,132,0.5)',
            textColor: postCardColors.deepSlate,
          }
        : {
            backgroundColor: 'rgba(102,143,128,0.12)',
            borderColor: 'rgba(102,143,128,0.42)',
            textColor: postCardColors.tealGreen,
          }
  return (
    <View
      className="flex flex-row items-center justify-center"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor,
        backgroundColor,
        borderRadius: p(6),
        paddingLeft: p(10),
        paddingRight: p(10),
        paddingTop: p(4),
        paddingBottom: p(4),
        minHeight: p(32),
      }}
    >
      <Text
        style={{
          fontSize: p(22),
          fontWeight: '600',
          color: textColor,
          lineHeight: p(28),
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

/** 详情页「TA 的评价」外框（slate 描边 + 档案阴影；左侧色条在页面内 flex 实现） */
export function reportEvaluationCardShell(): {
  backgroundColor: string
  borderWidth: number
  borderStyle: 'solid'
  borderColor: string
  boxShadow: string
} {
  return {
    backgroundColor: reportCardContentSurface(),
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(74,102,112,0.2)',
    boxShadow: reportArchiveShadow(),
  }
}

/** 评价卡左侧玫瑰强调条 */
export function reportEvaluationAccentStripStyle(): {
  width: string
  alignSelf: 'stretch'
  backgroundColor: string
} {
  return {
    width: postCardPx(5),
    alignSelf: 'stretch',
    backgroundColor: 'rgba(214,162,173,0.55)',
  }
}

export function PostCardThumbImage({
  relative,
  onTap,
  single,
}: {
  relative: string
  onTap: () => void
  single: boolean
}) {
  const absolute = resolveAssetUrl(relative)
  const src = useRemoteImage(absolute)
  return (
    <View
      className={`overflow-hidden rounded-lg ${single ? 'aspect-[4/3]' : 'aspect-square'}`}
      style={{ backgroundColor: 'rgba(195,181,159,0.22)' }}
      onClick={(e) => {
        e.stopPropagation()
        onTap()
      }}
    >
      {src ? (
        <Image src={src} className="h-full w-full" mode="aspectFill" />
      ) : (
        <View className="flex h-full w-full items-center justify-center">
          <Text className="text-xs" style={{ color: 'rgba(74,102,112,0.45)' }}>
            加载中
          </Text>
        </View>
      )}
    </View>
  )
}
