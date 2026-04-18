import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import cx from 'classnames';
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
  },
];

function tabClassName(isActive: boolean) {
  return cx(
    'relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-2 py-2 no-underline outline-none transition-colors duration-200 [-webkit-tap-highlight-color:transparent]',
    'font-display text-xs font-medium sm:text-sm',
    isActive
      ? 'font-bold text-white'
      : 'hover:bg-love/10 hover:text-neutral-600',
    !isActive && 'text-[#666666]',
  );
}

const BottomTabBar = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([null, null]);
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const activeIndex = pathname === '/daily' ? 1 : 0;

  const pillTransition = reduceMotion
    ? { duration: 0.15, ease: 'easeOut' as const }
    : { type: 'spring' as const, stiffness: 420, damping: 32 };

  const updatePill = useCallback(() => {
    const container = containerRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!container || !tab) return;
    const c = container.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    setPill({
      left: t.left - c.left,
      top: t.top - c.top,
      width: t.width,
      height: t.height,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    updatePill();
  }, [pathname, updatePill]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      updatePill();
    });
    const el = containerRef.current;
    if (el) {
      ro.observe(el);
    }
    tabRefs.current.forEach((node) => {
      if (node) ro.observe(node);
    });
    window.addEventListener('resize', updatePill);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updatePill);
    };
  }, [updatePill]);

  if (!links.some((link) => link.path === pathname)) {
    return null;
  }

  const element = (
    <div
      ref={containerRef}
      className="bottom-tab-bar fixed left-1/2 z-[100] flex min-h-[48px] w-[min(92%,20rem)] max-w-md -translate-x-1/2 items-stretch gap-1 rounded-2xl px-1.5 py-1"
      style={{
        bottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <Motion.div
        aria-hidden
        className="pointer-events-none absolute z-0 rounded-xl bg-[#e891b0] shadow-sm"
        initial={false}
        animate={{
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
        }}
        transition={pillTransition}
      />
      {links.map((link, index) => (
        <NavLink
          key={link.path}
          ref={(node: HTMLAnchorElement | null) => {
            tabRefs.current[index] = node;
          }}
          to={link.path}
          className={({ isActive }) => tabClassName(isActive)}
          end={link.path === '/'}
        >
          {({ isActive }) => (
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <img
                src={isActive ? link.activeIcon : link.icon}
                alt=""
                className="h-5 w-5 shrink-0 sm:h-[22px] sm:w-[22px]"
              />
              <span className="transition-colors duration-200">{link.label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );

  return createPortal(element, document.body);
};

export default BottomTabBar;
