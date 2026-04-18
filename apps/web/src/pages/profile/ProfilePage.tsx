import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import { resolveApiUrl } from '@/lib/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [heroAvatarBroken, setHeroAvatarBroken] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  useEffect(() => {
    setHeroAvatarBroken(false);
  }, [user?.profile.avatarUrl]);

  const confirmLogout = useCallback(async () => {
    setLogoutPending(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      window.alert('退出失败，请稍后重试');
    } finally {
      setLogoutPending(false);
      setLogoutConfirmOpen(false);
    }
  }, [logout, navigate]);

  if (!user) return null;

  const { displayName, bio, avatarUrl } = user.profile;
  const previewSrc = avatarUrl ? resolveApiUrl(avatarUrl) : '';
  const initial = (displayName || user.username).slice(0, 1).toUpperCase();
  const titleName = displayName.trim() || '未设置昵称';

  return (
    <div className="home-romance-bg min-h-tab-page">
      <div className="mx-auto w-[92%] max-w-md px-0 pb-5 pt-6 sm:pt-8">
        <header className="mb-3 text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide text-brown-title">我的</h1>
        </header>

        <section className="love-note-card px-5 pb-5 pt-5 text-center sm:px-6 sm:pb-6 sm:pt-6">
          <div className="mx-auto flex justify-center">
            {previewSrc && !heroAvatarBroken ? (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-love/25 shadow-sm">
                <img
                  src={previewSrc}
                  alt=""
                  className="block h-full w-full object-cover object-center"
                  onError={() => setHeroAvatarBroken(true)}
                />
              </div>
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-love/15 bg-gradient-to-br from-love/15 to-rose-100/80 text-2xl font-semibold text-love/90 shadow-inner"
                aria-hidden
              >
                {initial}
              </div>
            )}
          </div>
          <h2 className="mt-3 font-display text-xl font-bold tracking-wide text-brown-title">{titleName}</h2>
          <p className="mt-1.5 text-sm text-neutral-500">@{user.username}</p>
          <div className="mt-4 border-t border-border-sweet/40 pt-4 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">简介</p>
            {bio.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{bio}</p>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">还没有写简介，可在「编辑资料」里补上。</p>
            )}
          </div>
        </section>

        <section className="love-note-card mt-4 px-4 py-4 sm:px-5">
          <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            快捷入口
          </p>
          <nav className="flex flex-col gap-2" aria-label="个人相关操作">
            <button
              type="button"
              onClick={() => navigate('/daily/new')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-sweet/45 bg-white/90 px-4 py-3.5 text-left text-sm font-semibold text-brown-title/90 shadow-sm transition hover:border-love/35 hover:bg-rose-50/40"
            >
              <span>记一条日常</span>
              <span className="text-neutral-300" aria-hidden>
                ›
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile/edit')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-sweet/45 bg-white/90 px-4 py-3.5 text-left text-sm font-semibold text-brown-title/90 shadow-sm transition hover:border-love/35 hover:bg-rose-50/40"
            >
              <span>编辑资料</span>
              <span className="text-neutral-300" aria-hidden>
                ›
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile/password')}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-sweet/45 bg-white/90 px-4 py-3.5 text-left text-sm font-semibold text-brown-title/90 shadow-sm transition hover:border-love/35 hover:bg-rose-50/40"
            >
              <span>修改密码</span>
              <span className="text-neutral-300" aria-hidden>
                ›
              </span>
            </button>
          </nav>
        </section>

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-700"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            退出登录
          </button>
        </div>

        <DangerConfirmModal
          open={logoutConfirmOpen}
          onClose={() => {
            if (!logoutPending) setLogoutConfirmOpen(false);
          }}
          title="退出登录？"
          description="退出后需要重新登录才能继续使用。"
          confirmLabel="退出登录"
          pending={logoutPending}
          pendingConfirmLabel="退出中…"
          onConfirm={() => void confirmLogout()}
        />
      </div>
    </div>
  );
}
