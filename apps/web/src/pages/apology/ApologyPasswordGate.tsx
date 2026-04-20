import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/ui/Modal';
import { APOLOGY_PASSWORD } from './apologyAuth';
import { APOLOGY_MODAL_BACKDROP, APOLOGY_MODAL_PANEL } from './apologyModalStyles';

type ApologyPasswordGateProps = {
  onSuccess: () => void;
};

export default function ApologyPasswordGate({ onSuccess }: ApologyPasswordGateProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed !== APOLOGY_PASSWORD) {
        setError('密码不对哦，再试一次');
        return;
      }
      setError('');
      onSuccess();
    },
    [value, onSuccess],
  );

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 home-romance-bg" aria-hidden />
      <Modal
        visible
        closeOnBackdropClick={false}
        onClose={() => {}}
        width="min(92%, 22.25rem)"
        ariaLabelledBy={titleId}
        backdropClassName={APOLOGY_MODAL_BACKDROP}
        contentClassName={APOLOGY_MODAL_PANEL}
      >
        <form onSubmit={handleSubmit} className="relative">
          <header className="border-b border-love/15 pb-3 text-center">
            <h2
              id={titleId}
              className="font-display text-lg font-bold text-brown-title sm:text-xl"
            >
              私密信件
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600/95">
              请输入四位数密码以阅读道歉信
            </p>
          </header>
          <label htmlFor="apology-pwd" className="sr-only">
            四位数密码
          </label>
          <div
            className="relative mt-5"
            onClick={() => inputRef.current?.focus()}
          >
            {/* 真正的输入框：透明覆盖整个区域 */}
            <input
              ref={inputRef}
              id="apology-pwd"
              type="password"
              name="apology-password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={value}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'apology-pwd-error' : undefined}
              onChange={(e) => {
                setValue(e.target.value.replace(/\D/g, '').slice(0, 4));
                if (error) setError('');
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl bg-transparent text-center font-mono text-transparent caret-transparent outline-none"
              style={{ letterSpacing: '0.6em' }}
            />
            {/* 视觉：4 个圆点格子 */}
            <div
              className="pointer-events-none flex items-center justify-center gap-2.5 sm:gap-3"
              aria-hidden
            >
              {[0, 1, 2, 3].map((i) => {
                const filled = value.length > i;
                const isCaret = focused && value.length === i;
                return (
                  <span
                    key={i}
                    className={`flex h-12 w-10 items-center justify-center rounded-xl border transition sm:h-[52px] sm:w-11 ${
                      filled
                        ? 'border-love/55 bg-rose-50/60 shadow-[0_2px_8px_rgb(249_172_201/0.25)]'
                        : isCaret
                          ? 'border-love/45 bg-white ring-2 ring-love/25'
                          : 'border-border-sweet/60 bg-white/80'
                    }`}
                  >
                    {filled ? (
                      <span className="block h-2.5 w-2.5 rounded-full bg-[#e891b0]" />
                    ) : isCaret ? (
                      <span className="block h-5 w-px animate-pulse bg-love/70" />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
          {error ? (
            <p
              id="apology-pwd-error"
              className="mt-2 text-center text-sm text-rose-600"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="order-2 rounded-xl border border-border-sweet/50 bg-white/90 px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-love/12 sm:order-1"
            >
              返回首页
            </button>
            <button
              type="submit"
              className="order-1 rounded-xl bg-[#e891b0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 sm:order-2"
            >
              确认
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
