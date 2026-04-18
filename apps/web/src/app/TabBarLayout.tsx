import { Outlet, useLocation } from 'react-router-dom';

/** 底部 Tab 实际展示的一级路由（与 BottomTabBar.showTabBar 一致） */
const PRIMARY_TAB_PATHS = new Set(['/', '/daily', '/profile']);

/**
 * 仅为带底部 Tab 的一级页预留 .pb-app-bottom-tab；二级全屏页不叠这层占位，避免大空白与多余滚动条。
 */
export default function TabBarLayout() {
  const { pathname } = useLocation();
  const reserveTabClearance = PRIMARY_TAB_PATHS.has(pathname);

  return (
    <div className={reserveTabClearance ? 'pb-app-bottom-tab' : undefined}>
      <Outlet />
    </div>
  );
}
