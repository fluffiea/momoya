import type { ReactNode } from 'react';

/**
 * 二级页面通用覆盖层：
 * - fixed inset-0 全屏覆盖，盖住下层的 PersistentTabsLayout
 * - z-50 高于 Tab 层（TabPane 是 z-1）；
 *   BottomTabBar(z-100) 在二级页路由下不渲染；
 *   ImagePreviewDialog(z-[1500]) 通过 portal 挂在 body 上，独立于本层
 * - overflow 由二级页自己处理（多数页面已是 h-[100dvh] flex 自管理）
 */
export default function SecondaryPageOverlay({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto">{children}</div>;
}
