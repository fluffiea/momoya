import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import Home from '@/pages/home/Home';
import Daily from '@/pages/daily/Daily';
import ProfilePage from '@/pages/profile/ProfilePage';

type TabKey = 'home' | 'daily' | 'profile';

/**
 * Tab 层在以下路径下展示：
 * - 一级 Tab：'/', '/daily', '/profile'
 * - 二级 Tab 衍生页面：'/daily/...', '/profile/...'
 *   （这些路径下，二级页面浮在 Tab 层之上，关闭后 Tab 仍在原位置）
 *
 * 其他独立全屏页（/login, /confess, /apology）不挂载 Tab 层。
 */
function shouldMountTabs(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true;
  if (pathname === '/daily' || pathname.startsWith('/daily/')) return true;
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return true;
  return false;
}

function resolveTab(pathname: string): TabKey {
  if (pathname === '/daily' || pathname.startsWith('/daily/')) return 'daily';
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile';
  return 'home';
}

const PROTECTED_TABS: ReadonlySet<TabKey> = new Set(['daily', 'profile']);

/**
 * 同时挂载三个一级 Tab，仅通过 hidden 切换显示。
 * - 每个 Tab 拥有独立的 overflow-y-auto 容器，浏览器自动保留各自的 scrollTop
 * - 切换 tab 不会卸载组件，所有状态、滚动位置、列表数据天然保留
 * - 二级页面（编辑/详情等）会浮在此层之上，返回时主 Tab 仍在原位
 */
export default function PersistentTabsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const mounted = shouldMountTabs(pathname);
  const activeTab = mounted ? resolveTab(pathname) : 'home';

  // 仅在 active tab 是受保护页面且未登录时跳转，避免后台 inactive tab 误触发跳转
  useEffect(() => {
    if (!mounted || loading) return;
    if (!user && PROTECTED_TABS.has(activeTab)) {
      navigate('/login', { replace: true, state: { from: pathname } });
    }
  }, [mounted, loading, user, activeTab, pathname, navigate]);

  if (!mounted) return null;

  return (
    <>
      <TabPane tabKey="home" active={activeTab === 'home'}>
        <Home />
      </TabPane>
      <TabPane tabKey="daily" active={activeTab === 'daily'}>
        <Daily />
      </TabPane>
      <TabPane tabKey="profile" active={activeTab === 'profile'}>
        <ProfilePage />
      </TabPane>
    </>
  );
}

/**
 * 用 visibility 控制显隐而非 hidden（display:none）：
 * - 三个 Tab 都正常布局，子组件 offsetWidth/Height 测量恒定有效，避免初始挂载在 inactive 状态下
 *   出现尺寸为 0 的卡死锁宽 bug（如 HomeRomanceSectionHeading 的 lockedWidth）
 * - inactive Tab 不接收点击 / 不响应键盘焦点
 * - 通过 z-index 让 active Tab 在视觉与命中测试上覆盖在其它 Tab 之上
 */
function TabPane({
  tabKey,
  active,
  children,
}: {
  tabKey: TabKey;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-tab-pane={tabKey}
      className="fixed inset-0 overflow-y-auto pb-app-bottom-tab"
      style={{
        visibility: active ? 'visible' : 'hidden',
        pointerEvents: active ? 'auto' : 'none',
        zIndex: active ? 1 : 0,
      }}
      aria-hidden={!active}
      inert={!active || undefined}
    >
      {children}
    </div>
  );
}
