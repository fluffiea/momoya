import { Routes, Route } from 'react-router-dom';
import TabBarLayout from '@/app/TabBarLayout';
import RequireAuth from '@/auth/RequireAuth';
import Home from '@/pages/home/Home';
import Daily from '@/pages/daily/Daily';
import DailyComposePage from '@/pages/daily/DailyComposePage';
import Confess from '@/pages/confess/Confess';
import Apology from '@/pages/apology/Apology';
import LoginPage from '@/pages/login/LoginPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import ProfileEditPage from '@/pages/profile/ProfileEditPage';
import ProfilePasswordPage from '@/pages/profile/ProfilePasswordPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<TabBarLayout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/daily/new"
          element={
            <RequireAuth>
              <DailyComposePage />
            </RequireAuth>
          }
        />
        <Route
          path="/daily/:entryId/edit"
          element={
            <RequireAuth>
              <DailyComposePage />
            </RequireAuth>
          }
        />
        <Route
          path="/daily"
          element={
            <RequireAuth>
              <Daily />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <ProfileEditPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/password"
          element={
            <RequireAuth>
              <ProfilePasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="/confess" element={<Confess />} />
      <Route path="/apology" element={<Apology />} />
    </Routes>
  );
}
