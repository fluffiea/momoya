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
  /** 为 false 时面板不启用内部纵向滚动（适合一屏内固定布局，避免双滚动条） */
  panelScrollable?: boolean;
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
    panelScrollable = true,
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
          // box-border：width 即视觉总宽（含 padding/border），避免在小屏上撑出视口、看似贴边
          'box-border rounded-2xl border border-white/80 bg-white p-4 shadow-2xl ring-1 ring-black/5',
          panelScrollable ? 'max-h-[90vh] overflow-y-auto' : 'max-h-none overflow-hidden',
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
