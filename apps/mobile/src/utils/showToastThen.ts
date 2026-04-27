import Taro from '@tarojs/taro'

type ToastOption = Parameters<typeof Taro.showToast>[0]

const DEFAULT_DELAY_MS = 450

/**
 * 先 `showToast`，再在稳定时机执行后续逻辑（常见为 `navigateBack` / `reLaunch`）。
 *
 * 微信小程序里若 Toast 与路由在同一同步栈紧挨着执行，提示常被「吃掉」或表现异常；
 * 使用 `nextTick` 将跳转推到下一任务后，再配合极短延时，比在各页面散落魔数更易维护。
 * 若某端仍不稳，仅调大传入的 `delayMs` 即可。
 */
export function showToastThen(
  toast: ToastOption,
  then: () => void | Promise<void>,
  options?: { delayMs?: number },
): void {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS
  Taro.showToast(toast)
  Taro.nextTick(() => {
    setTimeout(() => {
      void Promise.resolve(then()).catch(() => {})
    }, delayMs)
  })
}
