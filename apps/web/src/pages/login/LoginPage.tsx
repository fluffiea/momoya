import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { useAuth } from '@/auth/useAuth';
import PasswordFieldWithToggle from '@/components/ui/PasswordFieldWithToggle';
import PageFooter from '@/components/ui/PageFooter';
import SectionLabel from '@/components/ui/SectionLabel';

const easeOut = [0.22, 1, 0.36, 1] as const;

/** 与 API seed 一致，仅两枚账号 */
const LOGIN_ACCOUNTS = [
  { username: 'jiangjiang', label: '江江', sub: 'jiangjiang' },
  { username: 'mengmeng', label: '萌萌', sub: 'mengmeng' },
] as const;

const triggerClass =
  'flex h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-border-sweet/55 bg-white/95 px-3.5 text-left text-sm text-brown-title/90 outline-none transition data-[placeholder]:text-neutral-400 focus:border-love/50 focus:ring-2 focus:ring-love/25';

const contentClass =
  'z-[1200] overflow-hidden rounded-xl border border-border-sweet/45 bg-white/98 shadow-[0_8px_32px_rgb(249_172_201/0.22)] ring-1 ring-love/10';

const itemClass =
  'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-brown-title/90 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-rose-50/90 data-[state=checked]:bg-love/12 data-[state=checked]:font-semibold data-[state=checked]:text-love';

function ChevronDown() {
  return (
    <Select.Icon className="shrink-0 text-love/55" aria-hidden>
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </Select.Icon>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/daily';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('请选择用户');
      return;
    }
    setPending(true);
    const r = await login(username.trim(), password);
    setPending(false);
    if (r.ok) {
      navigate(from, { replace: true });
    } else {
      setError(r.message);
    }
  };

  const selectedAccount = LOGIN_ACCOUNTS.find((a) => a.username === username);

  return (
    <div className="home-romance-bg flex min-h-full flex-col px-6 pt-10 pb-safe-page sm:pt-12">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {/* ── Hero ────────────────────────────────────── */}
        <Motion.section
          className="text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          {/* 心形 logo —— 与全站「封蜡章」语言一致的柔粉渐变 */}
          <div className="mx-auto flex justify-center">
            <span className="heart-letter-seal relative flex h-14 w-14 items-center justify-center rounded-full">
              <svg
                viewBox="0 0 24 24"
                fill="white"
                className="relative h-6 w-6"
                style={{ filter: 'drop-shadow(0 1px 0 rgb(217 138 168 / 0.32))' }}
              >
                <path d="M12 21s-7-4.5-9.5-9C.5 8.5 2.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4.5 0 6.5 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z" />
              </svg>
            </span>
          </div>

          <h1 className="mt-4 font-display text-[26px] font-bold tracking-wide text-brown-title sm:text-[28px]">
            欢迎回来
          </h1>
          <p className="mt-1.5 font-display text-[12px] tracking-[0.22em] text-brown-title/55 sm:text-[13px]">
            萌萌 & 江江的小站
          </p>
        </Motion.section>

        {/* ── Form ────────────────────────────────────── */}
        <Motion.form
          onSubmit={handleSubmit}
          className="mt-7 flex flex-col gap-4 sm:mt-8 sm:gap-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.05 }}
        >
          <section aria-labelledby="login-user-heading">
            <SectionLabel id="login-user-heading" title="是哪一位呢" />
            <div className="mt-3">
              <Select.Root value={username || undefined} onValueChange={setUsername}>
                <Select.Trigger id="login-user" className={triggerClass} aria-label="选择登录用户">
                  <Select.Value placeholder="请选择登录用户">
                    {selectedAccount ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-love/15 font-display text-[11px] font-bold text-love">
                          {selectedAccount.label.charAt(0)}
                        </span>
                        <span>{selectedAccount.label}</span>
                        <span className="text-[11px] text-neutral-400">
                          ({selectedAccount.sub})
                        </span>
                      </span>
                    ) : null}
                  </Select.Value>
                  <ChevronDown />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className={`${contentClass} min-w-[var(--radix-select-trigger-width)]`}
                    position="popper"
                    sideOffset={6}
                    align="start"
                  >
                    <Select.Viewport className="p-1">
                      {LOGIN_ACCOUNTS.map((a) => (
                        <Select.Item key={a.username} value={a.username} className={itemClass}>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-love/12 font-display text-[11px] font-bold text-love">
                            {a.label.charAt(0)}
                          </span>
                          <Select.ItemText>{a.label}</Select.ItemText>
                          <span className="ml-auto text-[11px] text-neutral-400">
                            {a.sub}
                          </span>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </section>

          <section aria-labelledby="login-pass-heading">
            <SectionLabel id="login-pass-heading" title="悄悄话密码" />
            <div className="mt-3">
              <PasswordFieldWithToggle
                id="login-pass"
                ariaLabel="登录密码"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
            </div>
          </section>

          {error ? (
            <p className="text-center text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-full rounded-2xl bg-[#e891b0] py-3 font-display text-[15px] font-bold text-white shadow-[0_8px_22px_rgb(232_145_176/0.4)] transition hover:bg-[#d4769a] disabled:opacity-60"
          >
            {pending ? '登录中…' : '进入小站'}
          </button>
        </Motion.form>

        <div className="flex-1" />

        <PageFooter text="两个人的小站，一起守护" className="mt-8" />
      </div>
    </div>
  );
}
