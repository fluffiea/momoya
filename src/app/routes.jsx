import { Routes, Route } from 'react-router-dom';
import TabBarLayout from '@/app/TabBarLayout';
import Home from '@/pages/home/Home';
import Daily from '@/pages/daily/Daily';
import Confess from '@/pages/confess/Confess';
import Apology from '@/pages/apology/Apology';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<TabBarLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/daily" element={<Daily />} />
      </Route>
      <Route path="/confess" element={<Confess />} />
      <Route path="/apology" element={<Apology />} />
    </Routes>
  );
}
