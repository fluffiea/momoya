import { useId, type ReactNode } from 'react';
import Modal from './Modal';

const backdropClassName =
  'fixed inset-0 z-[2100] flex items-center justify-center bg-black/30 backdrop-blur-[2px]';

const contentClassName =
  'rounded-[22px] border border-border-sweet/45 bg-gradient-to-b from-white via-white to-rose-50/80 p-5 shadow-[0_8px_40px_rgb(249_172_201/0.22)] ring-1 ring-love/10';

const cancelBtnClass =
  'flex-1 rounded-xl border border-border-sweet/50 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-white/90 disabled:opacity-50';

const confirmBtnClass =
  'flex-1 rounded-xl border border-rose-200/90 bg-white py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  pendingConfirmLabel?: string;
  cancelLabel?: string;
};

/**
 * 与「删除日常」同壳的二次确认弹窗（恋区圆角卡片 + 双按钮），供删除、退出登录等复用。
 */
export default function DangerConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  pendingConfirmLabel,
  cancelLabel = '取消',
}: Props) {
  const titleId = useId();

  return (
    <Modal
      visible={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      width="min(92%, 20rem)"
      panelScrollable={false}
      closeOnBackdropClick={!pending}
      ariaLabelledBy={titleId}
      backdropClassName={backdropClassName}
      contentClassName={contentClassName}
    >
      <h2 id={titleId} className="font-display text-center text-lg font-bold text-brown-title">
        {title}
      </h2>
      <div className="mt-2 text-center text-sm leading-relaxed text-neutral-600">{description}</div>
      <div className="mt-6 flex gap-2">
        <button type="button" disabled={pending} className={cancelBtnClass} onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          className={confirmBtnClass}
          onClick={() => void onConfirm()}
        >
          {pending && pendingConfirmLabel ? pendingConfirmLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
