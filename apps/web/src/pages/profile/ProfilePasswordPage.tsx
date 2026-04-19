import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/useAuth';
import { apiPatchJson } from '@/lib/api';
import PasswordFieldWithToggle from '@/components/ui/PasswordFieldWithToggle';
import SecondaryPageHeader from '@/components/ui/SecondaryPageHeader';
import SectionLabel from '@/components/ui/SectionLabel';

export default function ProfilePasswordPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setPending(true);
    const r = await apiPatchJson<{ ok: boolean }>('/api/profile/password', {
      currentPassword,
      newPassword,
    });
    setPending(false);
    if (r.ok) {
      setMessage('密码已更新，请牢记新密码');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setError(r.error);
    }
  };

  return (
    <div className="home-romance-bg flex min-h-full flex-col">
      <SecondaryPageHeader title="修改密码" backTo="/profile" />

      <div className="mx-auto w-[92%] max-w-md flex-1 px-0 pb-safe-page pt-4 sm:pt-5">
        {/* 安心提示 */}
        <div className="mx-auto flex max-w-[20rem] items-start gap-3 rounded-2xl border border-love/15 bg-rose-50/55 px-4 py-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-love shadow-[inset_0_0_0_1px_rgb(249_172_201/0.4)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 1.5a4 4 0 0 0-4 4V8H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 18h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 15 8h-1V5.5a4 4 0 0 0-4-4Zm-2.5 4a2.5 2.5 0 0 1 5 0V8h-5V5.5Z" />
            </svg>
          </span>
          <p className="text-[12px] leading-relaxed text-brown-title/75 sm:text-[13px]">
            新密码会以<strong className="font-semibold text-brown-title">加密形式</strong>
            保存在服务器，我们无法查看明文，请放心。
          </p>
        </div>

        <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-5 flex flex-col gap-5 sm:mt-6">
          <section aria-labelledby="pw-current-heading">
            <SectionLabel id="pw-current-heading" title="当前密码" />
            <div className="mt-3 rounded-2xl border border-border-sweet/40 bg-white/85 px-4 py-4 shadow-[0_4px_18px_rgb(249_172_201/0.12)] sm:px-5">
              <PasswordFieldWithToggle
                id="pw-current"
                ariaLabel="当前密码"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
            </div>
          </section>

          <section aria-labelledby="pw-new-heading">
            <SectionLabel id="pw-new-heading" title="新密码" />
            <div className="mt-3 space-y-4 rounded-2xl border border-border-sweet/40 bg-white/85 px-4 py-4 shadow-[0_4px_18px_rgb(249_172_201/0.12)] sm:px-5">
              <PasswordFieldWithToggle
                id="pw-new"
                label="新密码（至少 6 位）"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordFieldWithToggle
                id="pw-confirm"
                label="确认新密码"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </div>
          </section>

          {error ? (
            <p className="text-center text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-center text-sm text-emerald-600">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-[#e891b0] py-3 font-display text-[15px] font-bold text-white shadow-[0_6px_18px_rgb(232_145_176/0.35)] transition hover:bg-[#d4769a] disabled:opacity-60"
          >
            {pending ? '保存中…' : '保存新密码'}
          </button>
        </form>
      </div>
    </div>
  );
}
