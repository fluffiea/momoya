import { Fragment, useEffect } from "react";
import { Routes, Route, useLocation  } from 'react-router-dom';
import Home from "./pages/home/Home";
import Daily from "./pages/daily/Daily";
import Confess from "./pages/confess/Confess";
import Apology from "./pages/apology/Apology";
import BottomTabBar from "./components/BottomTabBar/BottomTabBar";
import './App.scss';

function App() {
   const location = useLocation(); // 获取当前路由位置

  // 核心：路由路径变化时，强制滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]); // 依赖：路由路径变化时执行

  return (
    <Fragment>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/confess" element={<Confess />} />
        <Route path="/apology" element={<Apology />} />
      </Routes>
      <BottomTabBar />
    </Fragment>
  )
}

export default App
