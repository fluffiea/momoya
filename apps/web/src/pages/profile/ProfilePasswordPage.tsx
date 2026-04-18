import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { apiPatchJson } from '@/lib/api';
import PasswordFieldWithToggle from '@/components/ui/PasswordFieldWithToggle';

export default function ProfilePasswordPage() {
  const navigate = useNavigate();
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
    <div className="home-romance-bg">
      <div className="mx-auto w-[92%] max-w-md px-0 pb-safe-page pt-4 sm:pt-6">
        <header className="mb-5 flex items-center gap-2 border-b border-border-sweet/30 pb-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800"
            aria-label="返回"
          >
            ‹
          </button>
          <h1 className="font-display text-lg font-bold text-brown-title sm:text-xl">修改密码</h1>
        </header>

        <section className="love-note-card px-5 py-6 sm:px-6">
          <p className="mb-4 text-center text-xs leading-relaxed text-neutral-500">
            新密码会以加密形式保存在服务器，我们无法查看明文。
          </p>
          <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4">
            <PasswordFieldWithToggle
              id="pw-current"
              label="当前密码"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
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
            {error ? (
              <p className="text-center text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
            {message ? <p className="text-center text-sm text-emerald-600">{message}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-[#e891b0] py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {pending ? '保存中…' : '保存新密码'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
