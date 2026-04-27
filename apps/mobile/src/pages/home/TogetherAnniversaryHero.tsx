import { Image, Text, View } from '@tarojs/components'
import { coupleLinkHeartDataUri } from './coupleLinkHeartSvg'
import Taro from '@tarojs/taro'
import type { AnniversaryDto, MeDto, PartnerBriefDto } from '@momoya/shared'
import { useEffect, useMemo, useState } from 'react'
import { resolveAssetUrl } from '../../config'
import { useRemoteImage } from '../../hooks/useRemoteImage'
import { computeTogetherElapsed } from '../../utils/anniversary'
import { formatAbsolute } from '../../utils/time'

const px = (n: number) => Taro.pxTransform(n)

const DEEP_SLATE = '#4A6670'
const WARM_SAND = '#C3B59F'
const TEAL = '#668F80'
const SAGE = '#A0AF84'
const ROSE = '#D6A2AD'

/** 头像直径（设计稿 px）；略小一点配合大内边距，中间更透气 */
const AVATAR_SZ = 86

function AvatarCircle({ src }: { src: string | null }) {
  const size = px(AVATAR_SZ)
  return (
    <View
      className="shrink-0 overflow-hidden rounded-full bg-white"
      style={{
        width: size,
        height: size,
        border: `${px(2)} solid #ffffff`,
        boxShadow: `0 ${px(2)} ${px(14)} rgba(74,102,112,0.1), 0 0 0 ${px(1)} rgba(214,162,173,0.35)`,
      }}
    >
      {src ? (
        <Image src={src} className="h-full w-full" mode="aspectFill" />
      ) : (
        <View className="flex h-full w-full items-center justify-center">
          <Text style={{ fontSize: px(36), color: ROSE }}>♡</Text>
        </View>
      )}
    </View>
  )
}

/** 仅本块每秒 setState，避免整张 Hero（头像、爱心图）跟着重绘。 */
function TogetherElapsedLive({ dateIso }: { dateIso: string }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = useMemo(
    () => computeTogetherElapsed(dateIso, new Date()),
    [dateIso, tick],
  )

  return (
    <View
      className="relative overflow-hidden rounded-2xl"
      style={{
        paddingLeft: px(24),
        paddingRight: px(24),
        paddingTop: px(24),
        paddingBottom: px(24),
        border: '1px solid rgba(214,162,173,0.32)',
        backgroundColor: 'rgba(255,255,255,0.98)',
      }}
    >
      <Text
        className="pointer-events-none absolute"
        style={{
          right: px(16),
          top: px(12),
          fontSize: px(48),
          color: ROSE,
          opacity: 0.22,
        }}
      >
        ✿
      </Text>

      <View className="flex flex-row items-baseline justify-center" style={{ marginBottom: px(8) }}>
        <Text className="font-bold" style={{ fontSize: px(76), lineHeight: px(84), color: ROSE }}>
          {elapsed.totalDays}
        </Text>
        <Text className="font-semibold" style={{ fontSize: px(30), lineHeight: px(84), color: SAGE, marginLeft: px(6) }}>
          天
        </Text>
      </View>
      <Text
        className="block text-center"
        style={{
          fontSize: px(22),
          lineHeight: px(32),
          color: WARM_SAND,
          marginBottom: px(16),
        }}
      >
        起点 {formatAbsolute(dateIso)}
      </Text>

      <View className="flex flex-row">
        <View
          className="min-w-0 flex-1 rounded-xl"
          style={{
            marginRight: px(6),
            paddingTop: px(14),
            paddingBottom: px(14),
            paddingLeft: px(8),
            paddingRight: px(8),
            backgroundColor: 'rgba(102,143,128,0.12)',
            border: `1px solid rgba(102,143,128,0.32)`,
          }}
        >
          <Text
            className="block text-center font-medium"
            style={{ fontSize: px(20), lineHeight: px(28), color: TEAL, marginBottom: px(6) }}
          >
            时
          </Text>
          <Text className="block text-center font-semibold" style={{ fontSize: px(26), lineHeight: px(36), color: DEEP_SLATE }}>
            {elapsed.hours} 小时
          </Text>
        </View>
        <View
          className="min-w-0 flex-1 rounded-xl"
          style={{
            marginRight: px(6),
            paddingTop: px(14),
            paddingBottom: px(14),
            paddingLeft: px(8),
            paddingRight: px(8),
            backgroundColor: 'rgba(160,175,132,0.16)',
            border: `1px solid rgba(160,175,132,0.36)`,
          }}
        >
          <Text
            className="block text-center font-medium"
            style={{ fontSize: px(20), lineHeight: px(28), color: SAGE, marginBottom: px(6) }}
          >
            分
          </Text>
          <Text className="block text-center font-semibold" style={{ fontSize: px(26), lineHeight: px(36), color: DEEP_SLATE }}>
            {elapsed.minutes} 分钟
          </Text>
        </View>
        <View
          className="min-w-0 flex-1 rounded-xl"
          style={{
            paddingTop: px(14),
            paddingBottom: px(14),
            paddingLeft: px(8),
            paddingRight: px(8),
            backgroundColor: 'rgba(214,162,173,0.16)',
            border: `1px solid rgba(214,162,173,0.38)`,
          }}
        >
          <Text
            className="block text-center font-medium"
            style={{ fontSize: px(20), lineHeight: px(28), color: ROSE, marginBottom: px(6) }}
          >
            秒
          </Text>
          <Text className="block text-center font-semibold" style={{ fontSize: px(26), lineHeight: px(36), color: DEEP_SLATE }}>
            {elapsed.seconds} 秒钟
          </Text>
        </View>
      </View>
    </View>
  )
}

export function TogetherAnniversaryHero({
  item,
  me,
  partner,
}: {
  item: AnniversaryDto
  me: MeDto | null
  partner: PartnerBriefDto | null
}) {
  const meUrl = useMemo(() => resolveAssetUrl(me?.avatar ?? ''), [me?.avatar])
  const partnerUrl = useMemo(() => resolveAssetUrl(partner?.avatar ?? ''), [partner?.avatar])
  const meSrc = useRemoteImage(meUrl)
  const partnerSrc = useRemoteImage(partnerUrl)

  const heartLinkUri = useMemo(() => coupleLinkHeartDataUri(), [])

  return (
    <View
      className="relative mb-4 overflow-hidden rounded-3xl bg-white"
      style={{
        paddingLeft: px(32),
        paddingRight: px(32),
        paddingTop: px(28),
        paddingBottom: px(32),
        border: '1px solid rgba(195,181,159,0.55)',
        boxShadow: `0 ${px(6)} ${px(24)} rgba(74,102,112,0.09)`,
      }}
    >
      <Text
        className="block text-center font-medium"
        style={{
          fontSize: px(28),
          lineHeight: px(40),
          color: DEEP_SLATE,
          marginBottom: px(20),
        }}
      >
        点滴时光，连成我们的故事
      </Text>

      {/* 浅粉底带加大内边距：头像不贴边；中线 + 精简爱心，减轻拥挤与压迫感 */}
      <View
        className="flex w-full flex-col"
        style={{
          marginBottom: px(20),
          paddingTop: px(26),
          paddingBottom: px(24),
          paddingLeft: px(36),
          paddingRight: px(36),
          borderRadius: px(28),
          backgroundColor: 'rgba(214,162,173,0.07)',
        }}
      >
        <View
          className="relative w-full"
          style={{
            height: px(AVATAR_SZ),
          }}
        >
          <View
            className="pointer-events-none absolute"
            style={{
              left: 0,
              right: 0,
              top: px(AVATAR_SZ / 2 - 1),
              height: px(2),
              zIndex: 0,
              borderRadius: px(2),
              backgroundColor: 'rgba(214,162,173,0.45)',
            }}
          />
          {/* 与昵称行同一三列宽：左列宽=头像直径，昵称才能与头像竖直对齐 */}
          <View
            className="absolute left-0 right-0 top-0 flex flex-row items-center"
            style={{ bottom: 0, zIndex: 1 }}
          >
            <View className="flex shrink-0 flex-col items-center" style={{ width: px(AVATAR_SZ) }}>
              <AvatarCircle src={meSrc} />
            </View>
            <View className="min-w-0 flex-1" />
            <View className="flex shrink-0 flex-col items-center" style={{ width: px(AVATAR_SZ) }}>
              <AvatarCircle src={partnerSrc} />
            </View>
          </View>
          <View
            className="pointer-events-none absolute left-0 right-0 top-0 flex flex-row items-center justify-center"
            style={{ bottom: 0, zIndex: 2 }}
          >
            <Image
              src={heartLinkUri}
              mode="aspectFit"
              style={{
                width: px(132),
                height: px(96),
              }}
            />
          </View>
        </View>
        <View
          className="flex w-full flex-row items-start"
          style={{
            marginTop: px(18),
          }}
        >
          <View className="flex shrink-0 flex-col items-center" style={{ width: px(AVATAR_SZ) }}>
            <Text
              className="truncate font-medium"
              style={{
                width: '100%',
                fontSize: px(22),
                lineHeight: px(30),
                color: DEEP_SLATE,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {me?.nickname ?? '我'}
            </Text>
          </View>
          <View className="min-w-0 flex-1" />
          <View className="flex shrink-0 flex-col items-center" style={{ width: px(AVATAR_SZ) }}>
            <Text
              className="truncate font-medium"
              style={{
                width: '100%',
                fontSize: px(22),
                lineHeight: px(30),
                color: DEEP_SLATE,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {partner?.nickname ?? 'Ta'}
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="block text-center"
        style={{
          fontSize: px(22),
          lineHeight: px(32),
          color: 'rgba(214,162,173,0.92)',
          marginBottom: px(6),
        }}
      >
        每一秒都算数
      </Text>
      <Text
        className="block text-center font-semibold"
        style={{
          fontSize: px(30),
          lineHeight: px(42),
          color: DEEP_SLATE,
          marginBottom: px(20),
        }}
      >
        这是我们一起走过的
      </Text>

      <TogetherElapsedLive dateIso={item.date} />
    </View>
  )
}
