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
      <div className="home-romance-bg min-h-screen w-full" aria-hidden />
      <Modal
        visible
        closeOnBackdropClick={false}
        onClose={() => {}}
        width="min(90%, 20rem)"
        ariaLabelledBy={titleId}
        backdropClassName={APOLOGY_MODAL_BACKDROP}
        contentClassName={APOLOGY_MODAL_PANEL}
      >
        <form onSubmit={handleSubmit}>
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
            className="mt-4 w-full rounded-xl border border-border-sweet/60 bg-white px-3 py-2.5 text-center font-mono text-lg tracking-[0.35em] text-neutral-800 shadow-inner outline-none ring-love/0 transition placeholder:text-neutral-300 focus:border-love/50 focus:ring-2 focus:ring-love/25"
            placeholder="••••"
          />
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
