import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { resolveAssetUrl } from '../config'
import { useRemoteImage } from '../hooks/useRemoteImage'

const px = (n: number) => Taro.pxTransform(n)

export interface EditPostImageSlot {
  localPath: string
  remoteUrl: string | null
}

/**
 * 发布/编辑页单格图片：与列表、详情一致，对 dev 环境 HTTP 静态需经 useRemoteImage。
 */
export function EditPostSlotImage({ slot, className }: { slot: EditPostImageSlot; className?: string }) {
  const urlForImage = useMemo(() => {
    if (slot.remoteUrl) {
      return resolveAssetUrl(slot.remoteUrl)
    }
    return slot.localPath
  }, [slot.remoteUrl, slot.localPath])
  const src = useRemoteImage(urlForImage || undefined)

  if (!src) {
    return (
      <View
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: 'rgba(195,181,159,0.2)' }}
      >
        <Text style={{ fontSize: px(20), color: 'rgba(74,102,112,0.5)' }}>加载中</Text>
      </View>
    )
  }
  return <Image src={src} className={className ?? 'h-full w-full'} mode="aspectFill" />
}
