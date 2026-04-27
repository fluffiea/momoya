import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useAuthStore } from '../../store/authStore'
const px = (n: number) => Taro.pxTransform(n)

const FLOATERS = [
  { char: '✿', cls: 'float-anim', pos: { top: '8%', left: '7%' }, delay: '0s', size: 52, color: '#A0AF84' },
  { char: '⊹', cls: 'float-anim-slow', pos: { top: '10%', right: '9%' }, delay: '0.8s', size: 36, color: '#668F80' },
  { char: '❋', cls: 'float-anim', pos: { top: '20%', left: '18%' }, delay: '1.2s', size: 40, color: '#D6A2AD' },
  { char: '◌', cls: 'float-anim-slow', pos: { top: '6%', right: '26%' }, delay: '0.4s', size: 72, color: '#C3B59F' },
  { char: '✦', cls: 'float-anim', pos: { bottom: '22%', left: '5%' }, delay: '2s', size: 56, color: '#A0AF84' },
  { char: '❋', cls: 'float-anim', pos: { bottom: '16%', right: '7%' }, delay: '1.6s', size: 44, color: '#668F80' },
  { char: '✿', cls: 'float-anim-slow', pos: { bottom: '30%', right: '18%' }, delay: '0.2s', size: 32, color: '#D6A2AD' },
]

export default function EchoPage() {
  useLoad(() => {
    if (!useAuthStore.getState().isAuthed()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  return (
    <View
      className="relative flex min-h-screen flex-col items-center justify-center px-6"
      style={{
        background: 'linear-gradient(160deg, #C3B59F 0%, rgba(195,181,159,0.85) 50%, rgba(195,181,159,0.65) 100%)',
      }}
    >
      {FLOATERS.map((f, i) => (
        <Text
          key={i}
          className={`pointer-events-none absolute ${f.cls}`}
          style={{ ...f.pos, fontSize: px(f.size), color: f.color, animationDelay: f.delay }}
        >
          {f.char}
        </Text>
      ))}

      <View
        className="relative z-10 -mt-10 w-full rounded-3xl bg-white px-7 py-10"
        style={{
          border: '1px solid #C3B59F',
          boxShadow: `0 ${px(16)} ${px(64)} rgba(74,102,112,0.12)`,
        }}
      >
        <View className="mb-6 flex flex-col items-center gap-1">
          <View className="flex items-center gap-2">
            <Text style={{ fontSize: px(40), color: '#D6A2AD' }}>✉</Text>
            <Text className="text-2xl font-bold" style={{ color: '#4A6670' }}>回响</Text>
            <Text style={{ fontSize: px(40), color: '#D6A2AD' }}>✉</Text>
          </View>
          <Text className="text-xs" style={{ color: '#668F80' }}>Echo · 留给彼此的小纸条</Text>
        </View>

        <View
          className="rounded-2xl px-5 py-4"
          style={{ backgroundColor: 'rgba(195,181,159,0.12)', border: '1px solid rgba(195,181,159,0.4)' }}
        >
          <Text
            className="text-sm leading-loose"
            style={{ color: '#668F80' }}
          >
            回响区即将开放，在这里你可以给 TA 留下日常小信息。敬请期待 ♡
          </Text>
        </View>

        <View className="mt-6 flex items-center justify-center gap-1">
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
          <Text className="text-xs" style={{ color: '#A0AF84' }}>功能施工中，快了</Text>
          <Text style={{ fontSize: px(24), color: '#C3B59F' }}>✦</Text>
        </View>
      </View>
    </View>
  )
}
