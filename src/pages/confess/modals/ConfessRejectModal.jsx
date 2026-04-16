import { useId } from 'react';
import Modal from '@/components/ui/Modal';
import { CONFESS_MODAL_BACKDROP, CONFESS_MODAL_PANEL_REJECT } from './confessModalStyles';

export default function ConfessRejectModal({
  visible = false,
  onClose = () => {},
  src = '',
  info = '',
}) {
  const titleId = useId();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      width="min(86%, 16.75rem)"
      ariaLabelledBy={titleId}
      backdropClassName={CONFESS_MODAL_BACKDROP}
      contentClassName={CONFESS_MODAL_PANEL_REJECT}
    >
      <div className="flex flex-col gap-3">
        <header className="border-b border-confess-sky-strong/[0.09] pb-3 text-center">
          <p
            id={titleId}
            className="font-display text-sm font-bold tracking-wide text-confess-sky-strong sm:text-[15px]"
          >
            再等一下嘛
          </p>
        </header>
        {src ? (
          <img
            src={src}
            alt=""
            className="mx-auto max-h-[min(38vh,11rem)] w-auto max-w-full rounded-xl object-contain shadow-[0_2px_12px_rgb(122_200_228/0.18)] ring-1 ring-white/70"
          />
        ) : null}
        <p className="text-center font-display text-sm font-semibold text-neutral-600/95 sm:text-base">
          {info}
        </p>
        <button
          type="button"
          className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full bg-confess-sky-strong/95 px-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgb(122_200_228/0.35)] transition hover:brightness-[1.03] active:scale-[0.98]"
          onClick={onClose}
        >
          知道啦
        </button>
      </div>
    </Modal>
  );
}
