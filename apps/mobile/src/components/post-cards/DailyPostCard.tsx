import { Image, Text, View } from '@tarojs/components'
import { POST_COMMENT_PREVIEW } from '@momoya/shared'
import type { PostCommentDto } from '@momoya/shared'
import { resolveAssetUrl } from '../../config'
import { useRemoteImage } from '../../hooks/useRemoteImage'
import { previewPostImages } from '../../utils/previewPostImages'
import { formatRelative } from '../../utils/time'
import TagChip from '../TagChip'
import {
  PostCardThumbImage,
  postCardColors as C,
  postCardPx as px,
  postCardShellShadow,
  type PostListCardBaseProps,
} from './shared'

export type DailyPostCardProps = PostListCardBaseProps

export function DailyPostCard({ post, onLongPress, onTap }: DailyPostCardProps) {
  const authorAvatarUrl = resolveAssetUrl(post.author.avatar)
  const authorSrc = useRemoteImage(authorAvatarUrl)

  const handlePreview = (idx: number) => {
    if (post.images.length === 0) return
    void previewPostImages(post.images, idx)
  }

  const cols = post.images.length === 1 ? 1 : post.images.length <= 4 ? 2 : 3

  // 卡片只展示最早 1 条一级评论；更多条数/操作一律留给详情页
  const previewComments = (post.comments ?? []).slice(0, POST_COMMENT_PREVIEW)

  return (
    <View
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(195,181,159,0.38)',
        boxShadow: postCardShellShadow(),
      }}
      onLongPress={onLongPress}
      onClick={onTap}
    >
      {/* 信息区：左侧头像 + 昵称/相对时间；右侧标签（横向滚动兜底，超出省略） */}
      <View className="flex items-center gap-3">
        <View
          className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
          style={{ backgroundColor: 'rgba(195,181,159,0.32)' }}
        >
          {authorSrc ? (
            <Image src={authorSrc} className="h-full w-full" mode="aspectFill" />
          ) : (
            <View className="flex h-full w-full items-center justify-center">
              <Text style={{ fontSize: px(32), color: C.rosePink }}>♡</Text>
            </View>
          )}
        </View>

        <View className="flex min-w-0 flex-1 flex-col" style={{ gap: px(4) }}>
          <Text
            className="truncate text-sm font-semibold leading-snug"
            style={{ color: C.deepSlate }}
          >
            {post.author.nickname}
          </Text>
          <Text className="text-xs leading-none" style={{ color: C.tealGreen }}>
            {formatRelative(post.happenedAt)}
          </Text>
        </View>

        {post.tags.length > 0 ? (
          <View
            className="flex shrink-0 flex-wrap items-center justify-end gap-1.5"
            style={{ maxWidth: '55%' }}
          >
            {post.tags.slice(0, 3).map((t) => (
              <TagChip key={t} name={t} />
            ))}
            {post.tags.length > 3 ? (
              <Text className="text-xs" style={{ color: 'rgba(74,102,112,0.5)' }}>
                +{post.tags.length - 3}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 正文 */}
      {post.text ? (
        <Text
          className="whitespace-pre-wrap text-sm leading-[1.75]"
          style={{ color: C.deepSlate }}
        >
          {post.text}
        </Text>
      ) : null}

      {/* 配图 */}
      {post.images.length > 0 ? (
        <View
          className={`grid gap-2 ${
            cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {post.images.map((url, idx) => (
            <PostCardThumbImage
              key={url + idx}
              relative={url}
              onTap={() => handlePreview(idx)}
              single={cols === 1}
            />
          ))}
        </View>
      ) : null}

      {/* 评论预览：仅显示最早 1 条一级评论；空态直接隐藏整块（日常不下发 evaluation） */}
      {previewComments.length > 0 ? (
        <View
          className="flex flex-col gap-1.5 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: 'rgba(195,181,159,0.14)' }}
        >
          {previewComments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** 单条评论预览：左「昵称：正文」截断，右相对时间（列表即可看到，不必进详情） */
function CommentRow({ comment }: { comment: PostCommentDto }) {
  const timeLabel = formatRelative(comment.createdAt)
  return (
    <View className="flex min-w-0 flex-row items-center gap-2">
      <Text className="min-w-0 flex-1 truncate text-xs leading-[1.55]" style={{ color: C.deepSlate }}>
        <Text className="font-semibold" style={{ color: C.tealGreen }}>
          {comment.author.nickname}
        </Text>
        <Text style={{ color: 'rgba(74,102,112,0.55)' }}>：</Text>
        {comment.text}
      </Text>
      <Text className="shrink-0 text-xs leading-none" style={{ color: C.warmSand }}>
        {timeLabel}
      </Text>
    </View>
  )
}

export default DailyPostCard
