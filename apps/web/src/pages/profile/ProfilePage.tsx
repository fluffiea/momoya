import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import type { DailyEntryKind, UserPublic } from '@momoya/shared';
import { useAuth } from '@/auth/useAuth';
import DangerConfirmModal from '@/components/ui/DangerConfirmModal';
import PageFooter from '@/components/ui/PageFooter';
import SectionLabel from '@/components/ui/SectionLabel';
import { UserAvatar } from '@/components/user';
import { apiPatchJson } from '@/lib/api';

const easeOut = [0.22, 1, 0.36, 1] as const;

/** 关于我：单行且宽度够时正文与签名同一行（签名靠右），否则签名单独一行且始终靠右 */
function ProfileAboutBio({ bio, username }: { bio: string; username: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const sigRef = useRef<HTMLParagraphElement>(null);
  const [layout, setLayout] = useState<'beside' | 'stack'>('beside');

  const runMeasure = useCallback(() => {
    const wrap = wrapRef.current;
    const bioEl = bioRef.current;
    const sigEl = sigRef.current;
    if (!wrap || !bioEl || !sigEl) return;

    const cs = getComputedStyle(bioEl);
    const lh = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize);
    const lineH = Number.isFinite(lh) && lh > 0 ? lh : fs * 1.75;
    if (bioEl.scrollHeight > lineH * 1.35) {
      setLayout('stack');
      return;
    }

    const gap = 12;
    const wWrap = wrap.clientWidth;
    const wSig = sigEl.getBoundingClientRect().width;

    const prev = { display: bioEl.style.display, width: bioEl.style.width, maxWidth: bioEl.style.maxWidth };
    bioEl.style.display = 'inline-block';
    bioEl.style.width = 'max-content';
    bioEl.style.maxWidth = '100%';
    void bioEl.offsetWidth;
    const wBio = bioEl.getBoundingClientRect().width;
    bioEl.style.display = prev.display;
    bioEl.style.width = prev.width;
    bioEl.style.maxWidth = prev.maxWidth;
    void bioEl.offsetWidth;

    setLayout(wBio + wSig + gap <= wWrap + 0.5 ? 'beside' : 'stack');
  }, []);

  useLayoutEffect(() => {
    runMeasure();
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => runMeasure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bio, username, runMeasure]);

  const bioClass =
    'whitespace-pre-wrap break-words font-display text-[15px] leading-[1.75] text-[#5a3446] sm:text-[15.5px] ' +
    (layout === 'beside'
      ? 'inline-block min-w-0 max-w-[calc(100%-7rem)] text-left'
      : 'block w-full text-left');

  return (
    <div
      ref={wrapRef}
      className={layout === 'beside' ? 'flex flex-row items-end justify-between gap-x-3' : 'flex flex-col gap-2'}
    >
      <p ref={bioRef} className={bioClass}>
        {bio}
      </p>
      <p
        ref={sigRef}
        className={
          'flex items-center gap-1.5 font-display text-[11px] font-normal italic text-love/70 ' +
          (layout === 'beside' ? 'shrink-0' : 'self-end')
        }
      >
        <span aria-hidden className="h-px w-6 shrink-0 bg-gradient-to-r from-transparent to-love/35" />
        {`@${username}`}
      </p>
    </div>
  );
}

type QuickEntry = {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: ReactNode;
};

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
  const { user, refresh, logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [viewPending, setViewPending] = useState(false);

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

  const handleChangeDefaultView = useCallback(
    async (next: DailyEntryKind) => {
      if (!user || user.profile.dailyDefaultView === next) return;
      setViewPending(true);
      const r = await apiPatchJson<{ user: UserPublic }>('/api/profile/me', {
        dailyDefaultView: next,
      });
      setViewPending(false);
      if (r.ok) {
        await refresh();
      } else {
        window.alert(r.error);
      }
    },
    [user, refresh],
  );

  if (!user) return null;

  const { displayName, bio, avatarUrl, dailyDefaultView } = user.profile;
  const titleName = displayName.trim() || '未设置昵称';

  const quickEntries: QuickEntry[] = [
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
            <div className="relative">
              <div
                className="relative bg-white px-3 pt-3 pb-4 shadow-[0_14px_28px_-16px_rgba(199,117,154,0.45),0_6px_10px_-8px_rgba(60,40,20,0.2)]"
                style={{ transform: 'rotate(-2.2deg)', borderRadius: '6px' }}
              >
                <UserAvatar username={user.username} avatarUrl={avatarUrl || undefined} size="xl" />
                <p className="mt-2 text-center font-display text-[12px] font-bold tracking-[0.18em] text-brown-title/75">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          <h2 className="mt-5 font-display text-[22px] font-bold tracking-wide text-brown-title sm:text-2xl">
            {titleName}
          </h2>
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

          <div className="mt-3 rounded-2xl border border-rose-200/50 bg-white/95 px-5 py-4 shadow-[0_6px_22px_-14px_rgb(199_117_154/0.28)] sm:px-6 sm:py-5">
            {bio.trim() ? (
              <ProfileAboutBio bio={bio} username={user.username} />
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="font-display text-sm text-[#a74c72]/80">还没有写简介呢</p>
                <button
                  type="button"
                  onClick={() => navigate('/profile/edit')}
                  className="rounded-full border border-love/40 bg-white px-4 py-1 font-display text-[12px] font-bold text-brown-title/85 transition hover:border-love/60 hover:bg-rose-50/60"
                >
                  去补一句话
                </button>
              </div>
            )}
          </div>
        </Motion.section>

        {/* ── 偏好设置 ─────────────────────────────────────── */}
        <Motion.section
          className="mt-7 sm:mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.08 }}
          aria-labelledby="profile-prefs-heading"
        >
          <SectionLabel id="profile-prefs-heading" title="偏好设置" />

          <div className="relative mt-3 rounded-2xl border border-border-sweet/70 bg-white/92 px-5 py-4 shadow-[0_4px_18px_rgb(199_117_154/0.18)] sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[14px] font-semibold text-brown-title">
                  日常默认视图
                </p>
                <p className="mt-0.5 text-[12px] text-neutral-500">
                  打开「日常」Tab 时先展示哪种内容
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label="日常默认视图"
                className="relative inline-flex items-center gap-1 overflow-hidden rounded-full p-1"
              >
                {/*
                 * 与 Daily 页的 ViewSegmented 同源：背景色 + 滑动丸子。
                 * 这里放在 ProfilePage 里不共享 layoutId，和 Daily 分段是独立的两个小动画。
                 */}
                <Motion.div
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full"
                  initial={false}
                  animate={{
                    backgroundColor:
                      dailyDefaultView === 'daily'
                        ? 'rgba(253, 224, 235, 0.65)'
                        : 'rgba(254, 235, 200, 0.65)',
                  }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                />
                {(['daily', 'report'] as const).map((v) => {
                  const active = dailyDefaultView === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={viewPending}
                      onClick={() => void handleChangeDefaultView(v)}
                      className="relative rounded-full px-3 py-1 font-display text-[12px] font-semibold transition-colors disabled:opacity-60"
                    >
                      {active && (
                        <Motion.span
                          layoutId="profile-default-view-pill"
                          aria-hidden
                          className={`absolute inset-0 rounded-full bg-white ${
                            v === 'daily'
                              ? 'shadow-[0_2px_8px_rgb(249_172_201/0.45)]'
                              : 'shadow-[0_2px_8px_rgb(251_191_36/0.45)]'
                          }`}
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      )}
                      <span
                        className={`relative z-10 ${
                          active
                            ? v === 'daily'
                              ? 'text-love'
                              : 'text-amber-600'
                            : 'text-brown-title/55'
                        }`}
                      >
                        {v === 'daily' ? '日常' : '报备'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
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

          <nav className="mt-3 flex flex-col gap-3.5" aria-label="个人相关操作">
            {quickEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => navigate(entry.to)}
                className="profile-entry-card group relative flex w-full items-center gap-3.5 rounded-2xl border border-border-sweet/70 bg-white/92 px-4 py-3.5 text-left shadow-[0_3px_14px_rgb(199_117_154/0.18)] transition hover:-translate-y-px hover:border-love/55 hover:bg-white hover:shadow-[0_8px_22px_rgb(199_117_154/0.28)] sm:px-5"
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
