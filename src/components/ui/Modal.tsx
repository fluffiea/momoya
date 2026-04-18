import type { ReactNode, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import cx from 'classnames';

type ModalProps = {
  visible?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  width?: string;
  closeOnBackdropClick?: boolean;
  ariaLabelledBy?: string;
  contentClassName?: string;
  backdropClassName?: string;
};

const Modal = (props: ModalProps) => {
  const {
    visible = false,
    onClose = () => {},
    children = null,
    width = '60%',
    closeOnBackdropClick = true,
    ariaLabelledBy,
    contentClassName,
    backdropClassName = 'bg-white/60 backdrop-blur-sm',
  } = props;

  const closeHandler = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  const modal = () => (
    <div
      className={cx('fixed inset-0 z-[1000] flex items-center justify-center', backdropClassName)}
      onClick={closeHandler}
      role="presentation"
    >
      <div
        className={cx(
          'box-content max-h-[90vh] overflow-y-auto rounded-2xl border border-white/80 bg-white p-4 shadow-2xl ring-1 ring-black/5',
          contentClassName,
        )}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
      >
        {children}
      </div>
    </div>
  );

  return visible && createPortal(modal(), document.body);
};

export default Modal;
