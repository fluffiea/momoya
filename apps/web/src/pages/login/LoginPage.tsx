import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import PasswordFieldWithToggle from '@/components/ui/PasswordFieldWithToggle';

/** 与 API seed 一致，仅两枚账号 */
const LOGIN_ACCOUNTS = [
  { username: 'jiangjiang', label: '江江（jiangjiang）' },
  { username: 'mengmeng', label: '萌萌（mengmeng）' },
] as const;

const triggerClass =
  'flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-border-sweet/60 bg-white/95 px-3 text-left text-sm text-brown-title/90 outline-none transition data-[placeholder]:text-neutral-400 focus:border-love/50 focus:ring-2 focus:ring-love/25';

const contentClass =
  'z-[1200] overflow-hidden rounded-xl border border-border-sweet/45 bg-white/98 shadow-[0_8px_32px_rgb(249_172_201/0.22)] ring-1 ring-love/10';

const itemClass =
  'relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm text-brown-title/90 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-rose-50/90 data-[state=checked]:bg-love/12 data-[state=checked]:font-semibold data-[state=checked]:text-love';

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

  return (
    <div className="home-romance-bg flex flex-col px-6 pt-12 pb-safe-page">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center font-display text-2xl font-bold text-brown-title">登录</h1>
        <p className="mt-2 text-center text-sm text-neutral-500">萌萌 & 江江的小站</p>

        <form
          onSubmit={handleSubmit}
          className="love-note-card mt-8 space-y-4 px-5 py-6 sm:px-6"
        >
          <div>
            <label htmlFor="login-user" className="mb-1 block text-xs font-medium text-neutral-600">
              用户
            </label>
            <Select.Root value={username || undefined} onValueChange={setUsername}>
              <Select.Trigger id="login-user" className={triggerClass} aria-label="选择登录用户">
                <Select.Value placeholder="请选择用户" />
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
                        <Select.ItemText>{a.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          <PasswordFieldWithToggle
            id="login-pass"
            label="密码"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error ? (
            <p className="text-center text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-[#e891b0] py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
          >
            {pending ? '登录中…' : '进入'}
          </button>
        </form>
      </div>
    </div>
  );
}
