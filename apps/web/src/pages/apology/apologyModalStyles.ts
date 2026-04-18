/** 道歉信密码门控：与恋区粉棕信纸一致的柔和遮罩与面板（对标 confessModalStyles，色系为 love） */
import {
  MODAL_LETTER_PANEL_APOLOGY_TAIL,
  MODAL_LETTER_PANEL_SHARED_PREFIX,
} from '@/components/ui/modalLetterPanelClasses';

export const APOLOGY_MODAL_BACKDROP =
  'bg-[rgb(249_172_201/0.38)] backdrop-blur-[3px]';

const PANEL_BASE = `${MODAL_LETTER_PANEL_SHARED_PREFIX} ${MODAL_LETTER_PANEL_APOLOGY_TAIL}`;

export const APOLOGY_MODAL_PANEL = `!max-h-[min(82vh,34rem)] ${PANEL_BASE}`;
