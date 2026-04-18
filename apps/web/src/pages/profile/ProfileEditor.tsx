import { useState, useCallback, useRef } from 'react';
import type { UserPublic } from '@momoya/shared';
import { apiPatchJson, resolveApiUrl } from '@/lib/api';

type Props = {
  user: UserPublic;
  refresh: () => Promise<void>;
  /** 取消或保存成功后返回上一页/主页（由路由页传入） */
  onDone: () => void;
};

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

  return (
    <section className="love-note-card px-5 py-6 sm:px-6">
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label htmlFor="pf-name" className="mb-1 block text-xs font-medium text-neutral-600">
            显示名称
          </label>
          <input
            id="pf-name"
            className="w-full rounded-xl border border-border-sweet/60 px-3 py-2.5 text-sm outline-none focus:border-love/50 focus:ring-2 focus:ring-love/25"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="pf-bio" className="mb-1 block text-xs font-medium text-neutral-600">
            简介
          </label>
          <textarea
            id="pf-bio"
            rows={4}
            className="w-full resize-y rounded-xl border border-border-sweet/60 px-3 py-2.5 text-sm outline-none focus:border-love/50 focus:ring-2 focus:ring-love/25"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
          />
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium text-neutral-600">头像</span>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {previewSrc && !avatarBroken ? (
                <div className="h-14 w-14 overflow-hidden rounded-full border border-love/20">
                  <img
                    src={previewSrc}
                    alt=""
                    className="block h-full w-full object-cover object-center"
                    onError={onAvatarError}
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border-sweet/80 bg-neutral-50 text-xs text-neutral-400">
                  无
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
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
                className="w-full rounded-xl border border-border-sweet/60 bg-white px-3 py-2.5 text-left text-sm text-neutral-700 outline-none transition hover:border-love/40 disabled:opacity-60"
              >
                {avatarPending ? '上传中…' : '更换图片'}
              </button>
              <p className="mt-1 text-[11px] leading-snug text-neutral-400">JPEG / PNG / WebP，最大 3MB</p>
            </div>
          </div>
        </div>

        {message ? (
          <p
            className={`text-center text-sm ${message === '已保存' || message === '头像已更新' ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-[#e891b0] py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </form>
    </section>
  );
}
