import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import PageFooter from '@/components/ui/PageFooter';
import SectionLabel from '@/components/ui/SectionLabel';
import { resolveApiUrl } from '@/lib/api';

const easeOut = [0.22, 1, 0.36, 1] as const;

type QuickEntry = {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: ReactNode;
};

const PencilIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
    <path d="M14.69 2.66a2.25 2.25 0 0 1 3.18 3.18l-9.1 9.1a2 2 0 0 1-.86.5l-3.18.95a.75.75 0 0 1-.93-.93l.95-3.18a2 2 0 0 1 .5-.86l9.44-9.44Zm1.06 1.06L6.31 13.16a.5.5 0 0 0-.13.22l-.6 2.04 2.04-.6a.5.5 0 0 0 .22-.13l9.44-9.44a.75.75 0 0 0-1.53-1.53Z" />
  </svg>
);

const UserIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
    <path d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.5c-3.04 0-6.5 1.59-6.5 4.5v.75c0 .41.34.75.75.75h11.5a.75.75 0 0 0 .75-.75V16c0-2.91-3.46-4.5-6.5-4.5Z" />
  </svg>
);

const LockIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
    <path d="M10 1.5a4 4 0 0 0-4 4V8H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 15 8h-1V5.5a4 4 0 0 0-4-4Zm-2.5 4a2.5 2.5 0 0 1 5 0V8h-5V5.5Z" />
  </svg>
);

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

  const quickEntries: QuickEntry[] = [
    {
      id: 'new-daily',
      label: '记一条日常',
      hint: '写下今天的小心情',
      to: '/daily/new',
      icon: PencilIcon,
    },
    {
      id: 'edit-profile',
      label: '编辑资料',
      hint: '更新昵称、头像与简介',
      to: '/profile/edit',
      icon: UserIcon,
    },
    {
      id: 'change-password',
      label: '修改密码',
      hint: '保护好账号的钥匙',
      to: '/profile/password',
      icon: LockIcon,
    },
  ];

  return (
    <div className="home-romance-bg min-h-full">
      <div className="mx-auto w-[92%] max-w-md pt-7 sm:pt-9">
        {/* ── Hero ─────────────────────────────────────────── */}
        <Motion.section
          className="text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          <SectionLabel title="我的小档案" />

          <div className="mx-auto mt-5 flex justify-center">
            {previewSrc && !heroAvatarBroken ? (
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-love/35 via-rose-200/40 to-transparent blur-md"
                />
                <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-white shadow-[0_8px_24px_rgb(249_172_201/0.35)] ring-1 ring-love/15 sm:h-24 sm:w-24">
                  <img
                    src={previewSrc}
                    alt=""
                    className="block h-full w-full object-cover object-center"
                    onError={() => setHeroAvatarBroken(true)}
                  />
                </div>
              </div>
            ) : (
              <div
                className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-rose-100 via-love/20 to-rose-50 text-3xl font-semibold text-love/90 shadow-[0_8px_24px_rgb(249_172_201/0.35)] ring-1 ring-love/15 sm:h-24 sm:w-24"
                aria-hidden
              >
                {initial}
              </div>
            )}
          </div>

          <h2 className="mt-3 font-display text-[22px] font-bold tracking-wide text-brown-title sm:text-2xl">
            {titleName}
          </h2>
          <p className="mt-1 font-display text-[12px] tracking-[0.2em] text-brown-title/55 sm:text-[13px]">
            @{user.username}
          </p>
        </Motion.section>

        {/* ── 简介卡 ───────────────────────────────────────── */}
        <Motion.section
          className="mt-7 sm:mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.05 }}
          aria-labelledby="profile-bio-heading"
        >
          <SectionLabel id="profile-bio-heading" title="关于我" />

          <div className="mt-3 rounded-2xl border border-border-sweet/45 bg-white/85 px-5 py-4 shadow-[0_4px_18px_rgb(249_172_201/0.16)] sm:px-6 sm:py-5">
            {bio.trim() ? (
              <p className="whitespace-pre-wrap text-[14px] leading-[1.85] text-neutral-700 sm:text-[15px]">
                {bio}
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <p className="text-sm text-neutral-400">还没有写简介呢</p>
                <button
                  type="button"
                  onClick={() => navigate('/profile/edit')}
                  className="rounded-full border border-love/30 bg-white px-4 py-1 font-display text-[12px] font-bold text-brown-title/85 transition hover:border-love/55 hover:bg-rose-50/60"
                >
                  去补一句话
                </button>
              </div>
            )}
          </div>
        </Motion.section>

        {/* ── 快捷入口 ─────────────────────────────────────── */}
        <Motion.section
          className="mt-7 sm:mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          aria-labelledby="profile-quick-heading"
        >
          <SectionLabel id="profile-quick-heading" title="快捷入口" />

          <nav className="mt-3 flex flex-col gap-2.5" aria-label="个人相关操作">
            {quickEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(entry.to)}
                className="profile-entry-card group relative flex w-full items-center gap-3.5 rounded-2xl border border-border-sweet/40 bg-white/85 px-4 py-3.5 text-left shadow-[0_2px_12px_rgb(249_172_201/0.12)] transition hover:-translate-y-px hover:border-love/40 hover:bg-white hover:shadow-[0_6px_18px_rgb(249_172_201/0.22)] sm:px-5"
              >
                <span
                  className="profile-entry-seal flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white sm:h-12 sm:w-12"
                  aria-hidden
                >
                  {entry.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-bold leading-tight text-brown-title sm:text-base">
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-neutral-500 sm:text-[13px]">
                    {entry.hint}
                  </span>
                </span>
                <span
                  className="text-base text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-love/70"
                  aria-hidden
                >
                  ›
                </span>
              </button>
            ))}
          </nav>
        </Motion.section>

        {/* ── 退出登录 ─────────────────────────────────────── */}
        <div className="mt-8 text-center">
          <button
            type="button"
            className="font-display text-[12px] tracking-[0.2em] text-neutral-400 transition hover:text-rose-400"
            onClick={() => setLogoutConfirmOpen(true)}
          >
            退出登录
          </button>
        </div>

        <PageFooter text="把日子写成两个人的诗" />
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
  );
}
