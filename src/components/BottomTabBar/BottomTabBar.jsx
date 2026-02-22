import { NavLink, useLocation } from "react-router-dom";
import { createPortal } from 'react-dom';
import cx from 'classnames';
import { useState } from "react";
import style from './BottomTabBar.module.scss';
import homeIcon from './icons/home.svg';
import homeActiveIcon from './icons/home-active.svg';
import dailyIcon from './icons/daily.svg';
import dailyActiveIcon from './icons/daily-active.svg';

const links = [
  {
    path: '/',
    label: '主页',
    icon: homeIcon,
    activeIcon: homeActiveIcon,
  },
  {
    path: '/daily',
    label: '日常',
    icon: dailyIcon,
    activeIcon: dailyActiveIcon,
  }
];

const BottomTabBar = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const location = useLocation();
  const pathname = location.pathname;

  if (!links.some(link => link.path === pathname)) {
    return null;
  }

  const activeChange = (active, index) => {
    if (active) {
      setActiveIndex(index);
    }
    return cx(style.bottomTabBarItem, { [style.active]: active });
  }

  const element = (
    <div className={style.bottomTabBar}>
      {links.map((link, index) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) => activeChange(isActive, index)}
        >
          <img src={activeIndex === index ? link.activeIcon : link.icon} alt={link.label} />
          <span>{link.label}</span>
        </NavLink>
      ))}
    </div>
  );

  return createPortal(element, document.body);
};

export default BottomTabBar;
