import { Fragment, useEffect } from 'react';
import BottomTabBar from '@/components/layout/bottom-tab-bar/BottomTabBar';
import { useAuth } from '@/auth/useAuth';
import { connectDailyEvents, disconnectDailyEvents } from '@/lib/dailyEvents';
import { AppRoutes } from './routes';

export default function App() {
  const { user, loading } = useAuth();

  // 登录后建立 SSE 长连接，登出/卸载时断开
  useEffect(() => {
    if (loading) return;
    if (user) {
      connectDailyEvents();
    } else {
      disconnectDailyEvents();
    }
    return () => {
      // 不在 user 变化时断开（otherwise 切换 user 才需要），但应用真卸载时清理
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
