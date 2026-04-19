import { useId } from 'react';
import Modal from '@/components/ui/Modal';
import accept from '../images/accept.png';
import { CONFESS_MODAL_BACKDROP, CONFESS_MODAL_PANEL_ACCEPT } from './confessModalStyles';

export default function ConfessAcceptModal({ visible = false, onClose = () => {} }) {
  const titleId = useId();

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      width="min(92%, 20.25rem)"
      ariaLabelledBy={titleId}
      backdropClassName={CONFESS_MODAL_BACKDROP}
      contentClassName={CONFESS_MODAL_PANEL_ACCEPT}
    >
      <div className="flex flex-col gap-3">
        <header className="border-b border-confess-sky-strong/[0.09] pb-3 text-center">
          <div className="mx-auto flex max-w-[12rem] items-center gap-2" aria-hidden>
            <span className="h-px min-w-[0.75rem] flex-1 bg-gradient-to-r from-transparent to-confess-sky-strong/30" />
            <span className="text-[0.65rem] text-confess-sky-strong/50">★</span>
            <span className="h-px min-w-[0.75rem] flex-1 bg-gradient-to-l from-transparent to-confess-sky-strong/30" />
          </div>
          <h2
            id={titleId}
            className="mt-2 font-display text-base font-bold tracking-wide text-confess-sky-strong sm:text-lg"
          >
            欧耶！
          </h2>
          <p className="mt-1.5 font-display text-sm font-semibold text-neutral-600/90 sm:text-[15px]">
            我就知道你会同意的~
          </p>
        </header>

        <div className="space-y-1.5 text-xs leading-relaxed text-neutral-600/95 sm:text-sm">
          <p className="flex justify-end text-neutral-500/95">⭐ momo & yaya</p>
          <p className="flex justify-end text-neutral-500/95">⭐ 2025.12.12</p>
          <p>BIBOBIBO~</p>
          <p>请多指教</p>
          <p>嗯~就这样，渐渐地越来越喜欢彼此❤️</p>
          <div className="mt-2 overflow-hidden rounded-xl bg-gradient-to-b from-white/85 to-[rgb(122_200_228/0.06)] p-1 ring-1 ring-white/65">
            <img
              src={accept}
              alt=""
              className="block max-h-[min(32vh,10rem)] w-full rounded-lg object-contain object-center"
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-0.5 inline-flex min-h-[40px] w-full items-center justify-center rounded-full bg-confess-sky-strong/95 px-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgb(122_200_228/0.35)] transition hover:brightness-[1.03] active:scale-[0.98]"
          onClick={onClose}
        >
          收下这份开心
        </button>
      </div>
    </Modal>
  );
}
