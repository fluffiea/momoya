import { Fragment, useEffect } from 'react';
import BottomTabBar from '@/components/layout/bottom-tab-bar/BottomTabBar';
import { useAuth } from '@/auth/useAuth';
import { connectDailyEvents, disconnectDailyEvents } from '@/lib/dailyEvents';
import { AppRoutes } from './routes';

export default function App() {
  const { user, loading } = useAuth();

  /**
   * 登录后建立 SSE；后台 Tab 在静默一段时间后断开以省电，回到前台再连上并收 `sync` 快照补全。
   */
  useEffect(() => {
    if (loading) return undefined;

    const HIDDEN_DISCONNECT_MS = 30_000;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const clearHiddenTimer = () => {
      if (hiddenTimer !== null) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };

    const syncConnection = () => {
      if (!user) {
        clearHiddenTimer();
        disconnectDailyEvents();
        return;
      }
      if (document.visibilityState === 'visible') {
        clearHiddenTimer();
        connectDailyEvents();
        return;
      }
      clearHiddenTimer();
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null;
        disconnectDailyEvents();
      }, HIDDEN_DISCONNECT_MS);
    };

    if (!user) {
      disconnectDailyEvents();
      return undefined;
    }

    syncConnection();
    document.addEventListener('visibilitychange', syncConnection);
    return () => {
      clearHiddenTimer();
      document.removeEventListener('visibilitychange', syncConnection);
    };
  }, [user, loading]);

  useEffect(() => {
    return () => {
      disconnectDailyEvents();
    };
  }, []);

  return (
    <Fragment>
      <AppRoutes />
      <BottomTabBar />
    </Fragment>
  );
}
