import { useMemo, useState } from 'react';
import cx from 'classnames';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import ConfessRejectModal from './modals/ConfessRejectModal';
import ConfessAcceptModal from './modals/ConfessAcceptModal';
import {
  CONFESS_PARAGRAPHS,
  REJECT_BUTTON_LABELS,
  REJECT_MODAL_STEPS,
  type RejectModalStep,
} from './confess-constants';

const DATE_BADGE = '2025.12.27';

const Confess = () => {
  const [rejectStep, setRejectStep] = useState(0);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectModalPayload, setRejectModalPayload] = useState<RejectModalStep | null>(null);
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  const rejectLen = REJECT_BUTTON_LABELS.length;
  const isFinalRejectStep = rejectStep === rejectLen - 1;

  const rejectText = useMemo(() => {
    const text = REJECT_BUTTON_LABELS[rejectStep];
    return text || REJECT_BUTTON_LABELS[rejectLen - 1];
  }, [rejectStep, rejectLen]);

  const acceptHandler = () => {
    setAcceptModalVisible(true);
  };

  const rejectHandler = () => {
    if (rejectStep < rejectLen - 1) {
      const payload = REJECT_MODAL_STEPS[rejectStep];
      if (payload) {
        setRejectModalPayload(payload);
        setRejectModalVisible(true);
      }
    } else {
      acceptHandler();
    }
  };

  const handleRejectModalClose = () => {
    setRejectModalVisible(false);
    setRejectModalPayload(null);
    setRejectStep((prev) => prev + 1);
  };

  const handleThinkAgain = () => {
    setRejectStep(0);
    setRejectModalVisible(false);
    setRejectModalPayload(null);
  };

  const transition = reduceMotion
    ? { duration: 0.2 }
    : { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="relative box-border w-full overflow-x-hidden bg-confess-sky px-4 pt-8 pb-safe-page sm:pt-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.42)_0%,transparent_55%)]"
        aria-hidden
      />

      <Motion.div
        className="relative mx-auto max-w-xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        {/* 信封纸主体 */}
        <div className="letter-envelope-sky relative rounded-[28px] border border-white/65 px-5 pt-12 pb-7 sm:px-7 sm:pt-14 sm:pb-8">
          {/* 大封蜡章：浮在信纸顶部中心 */}
          <span
            className="letter-wax-seal-sky absolute left-1/2 -top-7 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full sm:h-[60px] sm:w-[60px]"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="white"
              className="relative h-6 w-6 drop-shadow-[0_1px_1px_rgb(20_70_100/0.5)] sm:h-7 sm:w-7"
            >
              <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Zm2.7.5 6 4.62a.5.5 0 0 0 .6 0L18.3 7H5.7Z" />
            </svg>
          </span>

          {/* 邮戳：右上角圆章 */}
          <span
            className="letter-postmark absolute right-4 top-4 flex h-14 w-14 select-none items-center justify-center rounded-full font-display text-[10px] font-bold leading-tight tracking-[0.04em] text-confess-sky-strong/80 sm:right-5 sm:top-5 sm:h-[60px] sm:w-[60px] sm:text-[11px]"
            aria-hidden
          >
            <span className="text-center tabular-nums">
              {DATE_BADGE.replace(/\./g, '\n')}
            </span>
          </span>

          {/* 标题 */}
          <header className="text-center">
            <h1 className="font-display text-[26px] font-bold tracking-[0.04em] text-confess-sky-strong sm:text-[30px]">
              恋爱申请书
            </h1>
            <div className="mx-auto mt-2 flex max-w-[14rem] items-center gap-2.5" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-confess-sky-strong/35" />
              <span className="font-display text-[11px] tracking-[0.32em] text-confess-sky-strong/55">
                寄给 MOMO
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-confess-sky-strong/35" />
            </div>
          </header>

          {/* 正文 */}
          <div className="relative mt-7">
            <div
              className="confess-letter-paper pointer-events-none absolute inset-0 opacity-[0.55]"
              aria-hidden
            />
            <div className="relative px-1 py-0.5 text-neutral-600/95">
              <p className="font-display text-[17px] font-semibold text-neutral-700/90">
                致 MOMO：
              </p>

              <div className="mt-4 space-y-3.5 text-[15px] leading-[1.78] sm:text-base">
                {CONFESS_PARAGRAPHS.map((paragraph, index) =>
                  index === 0 ? (
                    <p
                      key={paragraph}
                      className="text-center font-display text-[15px] italic leading-[1.85] text-neutral-600/88 sm:text-base"
                    >
                      {paragraph}
                    </p>
                  ) : (
                    <p key={paragraph} className="indent-8 text-neutral-600/92">
                      {paragraph}
                    </p>
                  ),
                )}
              </div>
            </div>

            {/* 落款 */}
            <div className="mt-6 text-right text-[13px] text-confess-sky-strong/65 sm:mt-7">
              <p className="font-display italic">—— 一个紧张到等你回应的人</p>
            </div>

            {/* 操作按钮 */}
            <div className="relative mt-7">
              {isFinalRejectStep ? (
                <div className="flex flex-col items-stretch gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-gradient-to-b from-confess-sky-strong to-[#5da7c7] px-6 font-display text-[15px] font-bold text-white shadow-[0_8px_22px_rgb(122_200_228/0.4)] transition hover:brightness-105 active:scale-[0.98]"
                    onClick={acceptHandler}
                  >
                    同意交往
                  </button>
                  <button
                    type="button"
                    className="text-center font-display text-[12px] tracking-[0.2em] text-confess-sky-strong/65 underline decoration-confess-sky-strong/30 underline-offset-4 transition hover:text-confess-sky-strong"
                    onClick={handleThinkAgain}
                  >
                    我再想想
                  </button>
                </div>
              ) : (
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <button
                    type="button"
                    className={cx(
                      'inline-flex min-h-[46px] min-w-[5.5rem] flex-1 items-center justify-center rounded-full px-5 font-display text-[14px] font-bold transition active:scale-[0.98] sm:flex-none',
                      rejectStep === rejectLen - 2 &&
                        'bg-rose-600 text-white shadow-[0_6px_18px_rgb(225_29_72/0.35)] ring-1 ring-rose-300/50 hover:brightness-105',
                      rejectStep < rejectLen - 2 &&
                        'border border-confess-sky-strong/40 bg-white/75 text-confess-sky-strong shadow-sm hover:bg-white',
                    )}
                    onClick={rejectHandler}
                  >
                    {rejectText}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-[46px] min-w-[5.5rem] flex-1 items-center justify-center rounded-full bg-gradient-to-b from-confess-sky-strong to-[#5da7c7] px-5 font-display text-[14px] font-bold text-white shadow-[0_8px_22px_rgb(122_200_228/0.4)] transition hover:brightness-105 active:scale-[0.98] sm:flex-none"
                    onClick={acceptHandler}
                  >
                    同意
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 信封外的小字 */}
        <p className="mt-5 text-center font-display text-[12px] tracking-[0.22em] text-confess-sky-strong/55 sm:text-[13px]">
          请在此签收
        </p>
      </Motion.div>

      <ConfessRejectModal
        visible={rejectModalVisible}
        onClose={handleRejectModalClose}
        src={rejectModalPayload?.src}
        info={rejectModalPayload?.info}
      />

      <ConfessAcceptModal
        visible={acceptModalVisible}
        onClose={() => setAcceptModalVisible(false)}
      />
    </div>
  );
};

export default Confess;
