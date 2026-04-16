import { Outlet } from 'react-router-dom';

/**
 * 包裹首页与日常：统一为底部固定 Tab 预留留白（见 index.css .pb-app-bottom-tab）。
 */
export default function TabBarLayout() {
  return (
    <div className="pb-app-bottom-tab">
      <Outlet />
    </div>
  );
}
