import { useMemo, useState } from 'react';
import cx from 'classnames';
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

  return (
    <div className="relative box-border w-full overflow-x-hidden bg-confess-sky px-4 pt-6 pb-safe-page">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.42)_0%,transparent_55%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-xl">
        <div className="rounded-3xl border border-white/55 bg-gradient-to-b from-white/88 via-white/78 to-[rgb(122_200_228/0.06)] p-5 shadow-[0_8px_40px_rgb(122_200_228/0.12)] ring-1 ring-confess-sky-strong/10 backdrop-blur-md sm:p-6">
          <header className="border-b border-confess-sky-strong/[0.09] pb-5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-wide text-confess-sky-strong sm:text-[1.65rem]">
              恋爱申请书
            </h1>
            <div
              className="mx-auto mt-3 flex max-w-[min(18rem,100%)] items-center gap-2.5 px-1"
              aria-hidden
            >
              <span className="h-px min-w-[1.5rem] flex-1 bg-gradient-to-r from-transparent via-confess-sky-strong/25 to-confess-sky-strong/35" />
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-confess-sky-strong/12 text-[0.85rem] shadow-inner ring-1 ring-white/70">
                ✉️
              </span>
              <span className="h-px min-w-[1.5rem] flex-1 bg-gradient-to-l from-transparent via-confess-sky-strong/25 to-confess-sky-strong/35" />
            </div>
            <p className="mt-3 font-display text-[11px] font-medium tracking-[0.2em] text-confess-sky-strong/42">
              寄出日期
            </p>
            <p className="mt-1 font-display text-sm tabular-nums text-confess-sky-strong/75">{DATE_BADGE}</p>
          </header>

          <div className="relative mt-6">
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

            <div className="relative mt-8">
              {isFinalRejectStep ? (
                <div className="flex flex-col items-stretch gap-3">
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-confess-sky-strong px-6 text-sm font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.98]"
                    onClick={acceptHandler}
                  >
                    同意交往
                  </button>
                  <button
                    type="button"
                    className="text-center text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-4 transition hover:text-confess-sky-strong"
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
                      'inline-flex min-h-[44px] min-w-[5.5rem] flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm transition active:scale-[0.98] sm:flex-none',
                      rejectStep === rejectLen - 2 &&
                        'bg-rose-600 text-white ring-1 ring-rose-300/50 hover:brightness-105',
                      rejectStep < rejectLen - 2 &&
                        'border border-confess-sky-strong/45 bg-white/70 text-confess-sky-strong hover:bg-white',
                    )}
                    onClick={rejectHandler}
                  >
                    {rejectText}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] min-w-[5.5rem] flex-1 items-center justify-center rounded-full bg-confess-sky-strong px-5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.98] sm:flex-none"
                    onClick={acceptHandler}
                  >
                    同意
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
