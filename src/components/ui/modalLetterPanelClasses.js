/**
 * 信纸风 Modal 面板：前半段在道歉 / 告白弹窗中相同，仅尾色与 ring 不同（Tailwind 类名须保持静态完整串）。
 */
export const MODAL_LETTER_PANEL_SHARED_PREFIX =
  '!rounded-2xl !p-4 overflow-y-auto !border !border-white/55 !bg-gradient-to-b !from-white/88 !via-white/78';

export const MODAL_LETTER_PANEL_APOLOGY_TAIL =
  '!to-[rgb(249_172_201/0.1)] !shadow-[0_8px_40px_rgb(249_172_201/0.18)] !ring-1 !ring-love/20 backdrop-blur-md';

export const MODAL_LETTER_PANEL_CONFESS_TAIL =
  '!to-[rgb(122_200_228/0.08)] !shadow-[0_8px_40px_rgb(122_200_228/0.14)] !ring-1 !ring-confess-sky-strong/10 backdrop-blur-md';
