import { Fragment, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import BottomTabBar from '@/components/layout/bottom-tab-bar/BottomTabBar';
import { AppRoutes } from './routes';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Fragment>
      <AppRoutes />
      <BottomTabBar />
    </Fragment>
  );
}
