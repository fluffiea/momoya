import { useConnectivityBanner } from '@/lib/useConnectivityBanner';

/**
 * 全局固定顶栏：仅浏览器断网时一行提示；z-index 低于全屏 Modal。
 */
export default function GlobalConnectivityBanner() {
  const state = useConnectivityBanner();

  if (state === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[1900] pt-[env(safe-area-inset-top,0px)]"
    >
      <div className="flex items-center justify-center border-b border-rose-200/70 bg-rose-100/95 px-3 py-1 text-center shadow-[0_1px_0_rgb(255_255_255/0.6)_inset] backdrop-blur-[2px]">
        <p className="font-display text-[12px] font-medium leading-tight text-rose-800/90">
          网络已断开
        </p>
      </div>
    </div>
  );
}
