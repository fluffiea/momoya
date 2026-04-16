/** 与 Confess 主卡片一致的柔和信纸风（供拒绝/同意弹窗共用） */
import {
  MODAL_LETTER_PANEL_CONFESS_TAIL,
  MODAL_LETTER_PANEL_SHARED_PREFIX,
} from '@/components/ui/modalLetterPanelClasses';

export const CONFESS_MODAL_BACKDROP =
  'bg-[rgb(122_200_228/0.38)] backdrop-blur-[3px]';

const PANEL_BASE = `${MODAL_LETTER_PANEL_SHARED_PREFIX} ${MODAL_LETTER_PANEL_CONFESS_TAIL}`;

export const CONFESS_MODAL_PANEL_REJECT = `!max-h-[min(72vh,28rem)] ${PANEL_BASE}`;

export const CONFESS_MODAL_PANEL_ACCEPT = `!max-h-[min(78vh,32rem)] ${PANEL_BASE}`;
