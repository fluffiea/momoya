import { useEffect, useState } from 'react';
import { resolveApiUrl } from '@/lib/api';

export type UserAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<UserAvatarSize, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-sm',
  lg: 'h-[84px] w-[84px] text-2xl',
  xl: 'h-[92px] w-[92px] text-3xl sm:h-[100px] sm:w-[100px]',
};

export type UserAvatarProps = {
  username: string;
  /** 与 `GET /api/home/partners`、个人资料一致的相对或绝对路径；空则首字母占位 */
  avatarUrl?: string;
  size?: UserAvatarSize;
  /** 叠在尺寸圆角之上，例如 `ring-1 ring-love/15` */
  className?: string;
};

/**
 * 全站统一头像：有 URL 则 `resolveApiUrl` 后展示，加载失败或缺省则首字母圆形占位。
 * 与伴侣用户名映射请用 `usePartnerAvatars`（`./usePartnerAvatars.ts`，经 `@/components/user` 导出）。
 */
export function UserAvatar({ username, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const char = username.charAt(0).toUpperCase();
  const dim = SIZE_CLASS[size];

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const frameClass = size === 'xl' ? 'ring-1 ring-love/15' : 'border border-border-sweet/20';

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={resolveApiUrl(avatarUrl)}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ${frameClass} ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const fallbackGradient =
    size === 'lg' || size === 'xl'
      ? 'bg-gradient-to-br from-rose-100 via-love/20 to-rose-50 font-semibold text-love/90'
      : 'bg-love/20 font-bold text-[#e891b0]';

  const fallbackRing = size === 'xl' ? 'ring-1 ring-love/15' : size === 'lg' ? 'ring-1 ring-love/15' : '';

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full ${fallbackGradient} ${fallbackRing} ${className}`}
      aria-hidden
    >
      {char}
    </div>
  );
}
