import { Text, View } from '@tarojs/components'
import type { PostDto } from '@momoya/shared'
import { previewPostImages } from '../../utils/previewPostImages'
import { formatRelative } from '../../utils/time'
import TagChip from '../TagChip'
import {
  PostCardThumbImage,
  postCardColors as C,
  postCardPx as px,
  reportArchiveShadow,
  reportCardBorderColor,
  reportCardContentSurface,
  reportFooterRailStyle,
  type PostListCardBaseProps,
} from './shared'

const EVAL_SNIPPET_MAX = 72

export type ReportPostCardProps = PostListCardBaseProps

function truncateSnippet(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * 已阅印章：镂空细线框 + 透明底，字与框同色；略旋转模拟盖章。
 * 叠放在「正文+图」整体内容区右下角，无图无文时不单独占一行（见主卡片分支）。
 */
function ReadBadge() {
  const stroke = C.rosePink
  return (
    <View
      className="flex items-center justify-center"
      style={{
        transform: 'rotate(-7deg)',
        borderRadius: px(8),
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: stroke,
        backgroundColor: 'transparent',
        paddingLeft: px(14),
        paddingRight: px(14),
        paddingTop: px(10),
        paddingBottom: px(10),
      }}
    >
      <Text
        style={{
          fontSize: px(20),
          fontWeight: '800',
          color: stroke,
          lineHeight: px(26),
          textAlign: 'center',
        }}
      >
        已阅
      </Text>
    </View>
  )
}

/**
 * 顶行：左侧「昵称的报备」，右侧 tags；下一行小字为发布时间（createdAt，相对时间）。
 */
function AuthorHeaderRow({
  nickname,
  tags,
  publishedAt,
}: {
  nickname: string
  tags: string[]
  publishedAt: string
}) {
  const name = nickname.trim() || 'TA'
  const preview = tags.slice(0, 4)
  const rest = tags.length - preview.length
  const publishedLabel = formatRelative(publishedAt)
  return (
    <View className="px-3 pt-2 pb-1.5">
      <View className="flex flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 shrink pr-1">
          <Text className="truncate" style={{ fontSize: px(28), color: C.deepSlate, fontWeight: '600' }}>
            {name}
            <Text style={{ fontWeight: '500', color: 'rgba(195,181,159,0.95)' }}> 的报备</Text>
          </Text>
        </View>
        {tags.length > 0 ? (
          <View className="flex max-w-[50%] shrink-0 flex-row flex-wrap items-center justify-end gap-1">
            {preview.map((t) => (
              <TagChip key={t} name={t} />
            ))}
            {rest > 0 ? (
              <Text className="text-xs font-semibold" style={{ color: C.tealGreen }}>
                +{rest}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {publishedLabel ? (
        <Text className="mt-1" style={{ fontSize: px(22), fontWeight: '500', color: 'rgba(74,102,112,0.48)' }}>
          发布 {publishedLabel}
        </Text>
      ) : null}
    </View>
  )
}

function PolaroidBlock({
  post,
  cols,
  onPreview,
}: {
  post: PostDto
  cols: number
  onPreview: (i: number) => void
}) {
  return (
    <View className="px-3 pb-1.5">
      <View
        style={{
          paddingLeft: px(8),
          paddingRight: px(8),
          paddingTop: px(8),
          paddingBottom: px(10),
          backgroundColor: 'rgba(255,253,251,0.98)',
          borderRadius: px(12),
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'rgba(195,181,159,0.32)',
          boxShadow: `0 ${px(2)} ${px(12)} rgba(74,102,112,0.05)`,
        }}
      >
        <View
          className={`grid ${cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}
        >
          {post.images.map((url, idx) => (
            <PostCardThumbImage
              key={url + idx}
              relative={url}
              onTap={() => onPreview(idx)}
              single={cols === 1}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

/** 评价人昵称 + 全角冒号 + 摘要（仅「有回复」阶段展示） */
function EvaluationSnippetLine({ nickname, text }: { nickname: string; text: string }) {
  const body = truncateSnippet(text, EVAL_SNIPPET_MAX)
  const name = nickname.trim() || 'TA'
  return (
    <Text
      className="truncate"
      style={{
        fontSize: px(26),
        lineHeight: px(40),
        color: C.deepSlate,
        letterSpacing: px(2),
      }}
    >
      <Text style={{ fontWeight: '700', color: C.tealGreen }}>{name}</Text>
      <Text style={{ color: 'rgba(74,102,112,0.5)' }}>：</Text>
      {body}
    </Text>
  )
}

type FooterPhase = 'unread' | 'read_no_reply' | 'reply'

function footerPhase(post: PostDto): FooterPhase {
  if (!post.readAt) return 'unread'
  const evalBody = post.evaluation?.text?.trim() ?? ''
  if (evalBody && post.evaluation) return 'reply'
  return 'read_no_reply'
}

const hintXs = { fontSize: px(22), lineHeight: px(32), color: 'rgba(74,102,112,0.48)' } as const

/** 状态标题；副文案可选，避免长句占位、挤压主内容 */
function StatusTitleHintRow({
  title,
  titleColor,
  titleWeight,
  hint,
}: {
  title: string
  titleColor: string
  titleWeight: '700' | '800'
  hint?: string
}) {
  if (!hint?.trim()) {
    return (
      <Text style={{ fontSize: px(24), fontWeight: titleWeight, color: titleColor }}>{title}</Text>
    )
  }
  return (
    <View className="flex min-w-0 flex-row items-baseline gap-2">
      <Text style={{ flexShrink: 0, fontSize: px(24), fontWeight: titleWeight, color: titleColor }}>{title}</Text>
      <Text className="min-w-0 flex-1 shrink" style={hintXs} numberOfLines={1}>
        {hint}
      </Text>
    </View>
  )
}

/** 底栏三阶段：仅展示状态；进详情统一由整卡 onTap（与日常列表一致） */
function ReportCardActionFooter({ post }: { post: PostDto }) {
  const phase = footerPhase(post)

  const shell =
    phase === 'unread'
      ? {
          borderColor: 'rgba(214,162,173,0.4)',
          backgroundColor: 'rgba(214,162,173,0.08)',
        }
      : {
          borderColor: 'rgba(160,175,132,0.4)',
          backgroundColor: 'rgba(160,175,132,0.08)',
        }

  return (
    <>
      <View
        className="flex w-full min-w-0 flex-col rounded-xl"
        style={{
          borderWidth: 1,
          borderStyle: 'solid',
          ...shell,
          paddingLeft: px(14),
          paddingRight: px(14),
          paddingTop: px(12),
          paddingBottom: px(12),
        }}
      >
        {phase === 'unread' ? (
          <View className="flex flex-col">
            <StatusTitleHintRow title="未阅" titleColor={C.rosePink} titleWeight="800" />
          </View>
        ) : null}

        {phase === 'read_no_reply' ? (
          <View className="flex flex-col">
            <StatusTitleHintRow title="无回复" titleColor="rgba(74,102,112,0.55)" titleWeight="700" />
          </View>
        ) : null}

        {phase === 'reply' && post.evaluation ? (
          <View className="flex min-w-0 flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1">
              <EvaluationSnippetLine
                nickname={post.evaluation.author.nickname.trim() || 'TA'}
                text={post.evaluation.text.trim()}
              />
            </View>
            <Text className="shrink-0 text-xs leading-none" style={{ color: C.warmSand, marginTop: px(4) }}>
              {formatRelative(post.evaluation.updatedAt)}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  )
}

export function ReportPostCard({ post, isMine: _isMine, onLongPress, onTap }: ReportPostCardProps) {
  const handlePreview = (idx: number) => {
    if (post.images.length === 0) return
    void previewPostImages(post.images, idx)
  }

  const cols = post.images.length === 1 ? 1 : post.images.length <= 4 ? 2 : 3

  return (
    <View
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: reportCardBorderColor(),
        boxShadow: reportArchiveShadow(),
        backgroundColor: reportCardContentSurface(),
      }}
      onLongPress={onLongPress}
      onClick={onTap}
    >
      <AuthorHeaderRow nickname={post.author.nickname} tags={post.tags} publishedAt={post.createdAt} />

      {post.images.length > 0 || post.text ? (
        <View style={{ position: 'relative' }}>
          {post.images.length > 0 ? (
            <PolaroidBlock post={post} cols={cols} onPreview={handlePreview} />
          ) : null}
          {post.text ? (
            <View className="flex flex-col px-3 pb-2 pt-2">
              <Text
                className="whitespace-pre-wrap"
                style={{
                  fontSize: px(28),
                  lineHeight: px(44),
                  color: C.deepSlate,
                }}
              >
                {post.text}
              </Text>
            </View>
          ) : null}
          {post.readAt ? (
            <View
              style={{
                position: 'absolute',
                right: px(22),
                bottom: px(22),
                zIndex: 2,
              }}
              catchMove
              onClick={(e) => e.stopPropagation()}
            >
              <ReadBadge />
            </View>
          ) : null}
        </View>
      ) : post.readAt ? (
        <View
          className="flex flex-row justify-end pb-2"
          style={{ paddingTop: px(4), paddingLeft: px(12), paddingRight: px(22) }}
        >
          <ReadBadge />
        </View>
      ) : null}

      <View
        style={{
          ...reportFooterRailStyle(),
          backgroundColor: 'rgba(214,162,173,0.06)',
          borderTopColor: 'rgba(214,162,173,0.22)',
        }}
      >
        <ReportCardActionFooter post={post} />
      </View>
    </View>
  )
}

export default ReportPostCard
