import { useState, useRef } from 'react';
import type { UserPublic } from '@momoya/shared';
import SectionLabel from '@/components/ui/SectionLabel';
import { UserAvatar } from '@/components/user';
import AvatarCropModal from '@/components/profile/AvatarCropModal';
import { apiPatchJson, resolveApiUrl } from '@/lib/api';
import { compressForAvatarSource } from '@/lib/imageCompression';

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
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);

  const rawAvatar = user.profile.avatarUrl;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage('');
    setPreparing(true);
    try {
      // 先把超大原图缩到 ≤ 4096 再进裁剪器，避免 canvas / 拖拽卡顿
      const prepared = await compressForAvatarSource(file);
      setCropSource(prepared);
    } catch {
      setCropSource(file);
    } finally {
      setPreparing(false);
    }
  };

  const handleCropConfirmed = async (cropped: File) => {
    setAvatarPending(true);
    const fd = new FormData();
    fd.append('file', cropped);
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
      setMessage('头像已更新');
      setCropSource(null);
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
  const avatarButtonLabel = preparing
    ? '处理中…'
    : avatarPending
      ? '上传中…'
      : rawAvatar
        ? '更换头像'
        : '上传头像';

  return (
    <>
      <form onSubmit={handleSave} className="flex flex-col gap-5 pt-1">
        {/* ── 头像 ────────────────────────────────────────── */}
        <section aria-labelledby="pf-avatar-heading">
          <SectionLabel id="pf-avatar-heading" title="头像" />

          <div className="mt-3 flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="bg-white px-3 pt-3 pb-5 shadow-[0_12px_24px_-14px_rgba(199,117,154,0.45),0_6px_10px_-8px_rgba(60,40,20,0.2)]"
                style={{ transform: 'rotate(-2deg)', borderRadius: '6px' }}
              >
                <UserAvatar username={user.username} avatarUrl={rawAvatar || undefined} size="lg" />
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <button
              type="button"
              disabled={avatarPending || preparing}
              aria-label="选择头像图片文件"
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-love/30 bg-white/85 px-4 py-1.5 font-display text-[12px] font-bold text-brown-title/85 transition hover:border-love/55 hover:bg-rose-50/60 disabled:opacity-60"
            >
              {avatarButtonLabel}
            </button>
            <p className="text-[11px] leading-snug text-neutral-400">
              任意大小，将自动压缩并裁剪为圆形头像
            </p>
          </div>
        </section>

        {/* ── 基本资料 ────────────────────────────────────── */}
        <section aria-labelledby="pf-info-heading">
          <SectionLabel id="pf-info-heading" title="基本资料" />

          <div className="romance-note-sheet mt-3 space-y-4">
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

      <AvatarCropModal
        open={Boolean(cropSource)}
        sourceFile={cropSource}
        busy={avatarPending}
        onCancel={() => setCropSource(null)}
        onConfirm={handleCropConfirmed}
      />
    </>
  );
}
