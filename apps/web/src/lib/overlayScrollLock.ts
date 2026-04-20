/**
 * 恋区主滚动在 TabPane（[data-tab-pane]）与二级页（[data-secondary-scroll]）上，仅给 body 设 overflow:hidden 无法阻止穿透。
 * 用引用计数在打开抽屉/底部层时统一加 `.scroll-lock`，由全局 CSS 锁住上述容器。
 */
let depth = 0;

export function lockOverlayScroll(): () => void {
  depth += 1;
  if (depth === 1) {
    document.documentElement.classList.add('scroll-lock');
  }
  return () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      document.documentElement.classList.remove('scroll-lock');
    }
  };
}
