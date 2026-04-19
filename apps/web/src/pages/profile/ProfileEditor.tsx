import { useState, useCallback, useRef } from 'react';
import type { UserPublic } from '@momoya/shared';
import SectionLabel from '@/components/ui/SectionLabel';
import { apiPatchJson, resolveApiUrl } from '@/lib/api';

type Props = {
  user: UserPublic;
  refresh: () => Promise<void>;
  /** 取消或保存成功后返回上一页/主页（由路由页传入） */
  onDone: () => void;
};

const fieldClass =
  'w-full rounded-xl border border-border-sweet/55 bg-white/95 px-3.5 py-2.5 text-sm text-neutral-800 outline-none transition focus:border-love/50 focus:ring-2 focus:ring-love/25';

export default function ProfileEditor({ user, refresh, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user.profile.displayName);
  const [bio, setBio] = useState(user.profile.bio);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);

  const onAvatarError = useCallback(() => {
    setAvatarBroken(true);
  }, []);

  const rawAvatar = user.profile.avatarUrl;
  const previewSrc = rawAvatar ? resolveApiUrl(rawAvatar) : '';
  const initial = (user.profile.displayName || user.username).slice(0, 1).toUpperCase();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage('');
    setAvatarPending(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(resolveApiUrl('/api/profile/avatar'), {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    setAvatarPending(false);
    let errText = '头像上传失败';
    try {
      const data = (await res.json()) as { error?: string };
      if (!res.ok) errText = data.error ?? errText;
    } catch {
      if (!res.ok) {
        /* keep default */
      }
    }
    if (res.ok) {
      setAvatarBroken(false);
      setMessage('头像已更新');
      await refresh();
    } else {
      setMessage(errText);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setPending(true);
    const r = await apiPatchJson<{ user: UserPublic }>('/api/profile/me', {
      displayName,
      bio,
    });
    setPending(false);
    if (r.ok) {
      setMessage('已保存');
      await refresh();
      onDone();
    } else {
      setMessage(r.error);
    }
  };

  const isSuccess = message === '已保存' || message === '头像已更新';

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 pt-1">
      {/* ── 头像 ────────────────────────────────────────── */}
      <section aria-labelledby="pf-avatar-heading">
        <SectionLabel id="pf-avatar-heading" title="头像" />

        <div className="mt-3 flex flex-col items-center gap-2.5">
          <div className="relative">
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full bg-gradient-to-br from-love/30 via-rose-200/30 to-transparent blur-md"
            />
            {previewSrc && !avatarBroken ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-white shadow-[0_6px_18px_rgb(249_172_201/0.35)] ring-1 ring-love/15">
                <img
                  src={previewSrc}
                  alt=""
                  className="block h-full w-full object-cover object-center"
                  onError={onAvatarError}
                />
              </div>
            ) : (
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-rose-100 via-love/20 to-rose-50 text-2xl font-semibold text-love/90 shadow-[0_6px_18px_rgb(249_172_201/0.35)] ring-1 ring-love/15"
                aria-hidden
              >
                {initial}
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarFile}
          />
          <button
            type="button"
            disabled={avatarPending}
            aria-label="选择头像图片文件"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-love/30 bg-white/85 px-4 py-1.5 font-display text-[12px] font-bold text-brown-title/85 transition hover:border-love/55 hover:bg-rose-50/60 disabled:opacity-60"
          >
            {avatarPending ? '上传中…' : previewSrc && !avatarBroken ? '更换头像' : '上传头像'}
          </button>
          <p className="text-[11px] leading-snug text-neutral-400">
            JPEG / PNG / WebP，最大 3MB
          </p>
        </div>
      </section>

      {/* ── 基本资料 ────────────────────────────────────── */}
      <section aria-labelledby="pf-info-heading">
        <SectionLabel id="pf-info-heading" title="基本资料" />

        <div className="mt-3 space-y-4 rounded-2xl border border-border-sweet/40 bg-white/85 px-4 py-4 shadow-[0_4px_18px_rgb(249_172_201/0.12)] sm:px-5 sm:py-5">
          <div>
            <label htmlFor="pf-name" className="mb-1.5 block text-[12px] font-medium text-brown-title/65">
              显示名称
            </label>
            <input
              id="pf-name"
              className={fieldClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
              placeholder="想被怎么称呼？"
            />
          </div>

          <div>
            <label htmlFor="pf-bio" className="mb-1.5 block text-[12px] font-medium text-brown-title/65">
              简介
            </label>
            <textarea
              id="pf-bio"
              rows={4}
              className={`${fieldClass} resize-y leading-relaxed`}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
              placeholder="写一句喜欢的、关于自己的小事吧"
            />
            <p className="mt-1 text-right text-[11px] text-neutral-400 tabular-nums">
              {bio.length}/2000
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <p
          className={`text-center text-sm ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}
          role={isSuccess ? undefined : 'alert'}
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-[#e891b0] py-3 font-display text-[15px] font-bold text-white shadow-[0_6px_18px_rgb(232_145_176/0.35)] transition hover:bg-[#d4769a] disabled:opacity-60"
      >
        {pending ? '保存中…' : '保存修改'}
      </button>
    </form>
  );
}
