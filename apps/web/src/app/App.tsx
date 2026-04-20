import { Fragment, useEffect } from 'react';
import BottomTabBar from '@/components/layout/bottom-tab-bar/BottomTabBar';
import { useAuth } from '@/auth/useAuth';
import { connectDailyEvents, disconnectDailyEvents } from '@/lib/dailyEvents';
import { AppRoutes } from './routes';

export default function App() {
  const { user, loading } = useAuth();

  // 登录后建立 SSE 长连接；单设备登录时由服务端经 SSE `auth` 事件踢下线，无需轮询 /auth/me
  useEffect(() => {
    if (loading) return;
    if (user) {
      connectDailyEvents();
    } else {
      disconnectDailyEvents();
    }
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
