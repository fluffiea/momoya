import { Routes, Route } from 'react-router-dom';
import PersistentTabsLayout from '@/app/PersistentTabsLayout';
import SecondaryPageOverlay from '@/app/SecondaryPageOverlay';
import RequireAuth from '@/auth/RequireAuth';
import DailyComposePage from '@/pages/daily/DailyComposePage';
import DailyEntryCommentsPage from '@/pages/daily/DailyEntryCommentsPage';
import Confess from '@/pages/confess/Confess';
import Apology from '@/pages/apology/Apology';
import LoginPage from '@/pages/login/LoginPage';
import ProfileEditPage from '@/pages/profile/ProfileEditPage';
import ProfilePasswordPage from '@/pages/profile/ProfilePasswordPage';

/**
 * 一级 Tab 路径（始终由 PersistentTabsLayout 渲染并保留状态）
 */
const PRIMARY_TAB_PATHS = ['/', '/daily', '/profile'];

/**
 * 把二级页面统一包一层 SecondaryPageOverlay，确保覆盖在 Tab 层之上。
 */
function secondary(node: React.ReactNode) {
  return <SecondaryPageOverlay>{node}</SecondaryPageOverlay>;
}

export function AppRoutes() {
  return (
    <>
      {/* 持久化 Tab 层：始终挂载在 DOM 中，根据路径切换显示 */}
      <PersistentTabsLayout />

      {/* 二级页面层：浮在 Tab 层之上 */}
      <Routes>
        {PRIMARY_TAB_PATHS.map((path) => (
          <Route key={path} path={path} element={null} />
        ))}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/daily/new"
          element={secondary(
            <RequireAuth>
              <DailyComposePage />
            </RequireAuth>,
          )}
        />
        <Route
          path="/daily/:entryId/edit"
          element={secondary(
            <RequireAuth>
              <DailyComposePage />
            </RequireAuth>,
          )}
        />
        <Route
          path="/daily/:entryId/comments"
          element={secondary(<DailyEntryCommentsPage />)}
        />
        <Route
          path="/profile/edit"
          element={secondary(
            <RequireAuth>
              <ProfileEditPage />
            </RequireAuth>,
          )}
        />
        <Route
          path="/profile/password"
          element={secondary(
            <RequireAuth>
              <ProfilePasswordPage />
            </RequireAuth>,
          )}
        />
        <Route path="/confess" element={<Confess />} />
        <Route path="/apology" element={<Apology />} />
      </Routes>
    </>
  );
}
