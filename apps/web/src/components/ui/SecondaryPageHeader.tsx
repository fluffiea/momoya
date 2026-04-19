import { useNavigate } from 'react-router-dom';
import cx from 'classnames';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** 自定义返回行为，默认 navigate(-1)；传入字符串则 navigate(string) */
  onBack?: () => void;
  backTo?: string;
  /** 右侧自定义槽（保存按钮、操作菜单等） */
  rightSlot?: ReactNode;
  /** 是否吸顶；默认 true，与 SecondaryPageOverlay 容器配合 */
  sticky?: boolean;
  className?: string;
};

/**
 * 二级页面统一顶部栏。
 *
 * 设计：
 * - 圆角返回按钮（统一 hover 色）
 * - 居中或左对齐标题（默认左对齐，符合移动端二级页常规）
 * - 右侧可放保存/操作按钮槽
 * - 半透明白底 + 柔和粉色阴影，保持与 SecondaryPageOverlay 风格统一
 *
 * 用法：
 *   <SecondaryPageHeader title="编辑日常" rightSlot={<button>保存</button>} />
 */
export default function SecondaryPageHeader({
  title,
  onBack,
  backTo,
  rightSlot,
  sticky = true,
  className,
}: Props) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    navigate(-1);
  };

  return (
    <header
      className={cx(
        'shrink-0 border-b border-border-sweet/30 bg-white/90 shadow-[0_1px_10px_rgb(249_172_201/0.18)]',
        sticky && 'sticky top-0 z-20',
        className,
      )}
    >
      <div className="mx-auto flex h-12 w-full max-w-md items-center gap-2 px-3 sm:h-[52px] sm:px-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] leading-none text-neutral-500 transition hover:bg-rose-50/70 hover:text-brown-title sm:h-10 sm:w-10"
          aria-label="返回"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-brown-title sm:text-base">
          {title}
        </h1>
        {rightSlot ? (
          <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
        ) : null}
      </div>
    </header>
  );
}
