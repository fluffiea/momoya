import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { motion as Motion } from 'framer-motion';

const ICON_PX = 36;
const PAD_PX = 12;
const GAP_PX = 10;
const TEXT_PL_START = PAD_PX + ICON_PX + GAP_PX;
const TEXT_PL_END = PAD_PX;

const easeOut = [0.22, 1, 0.36, 1];

function toChars(text) {
  if (!text) return [];
  return [...text];
}

/**
 * 恋区区块标题：整块胶囊可点；初始宽度由内容撑起，锁定后动画过程不增宽。
 * 点击后图标移向右侧，标题逐字左移；再点还原。
 */
const HomeRomanceSectionHeading = (props) => {
  const { id, iconSrc, iconAlt = '', title, className } = props;
  const [iconAtEnd, setIconAtEnd] = useState(false);
  const containerRef = useRef(null);
  const [cw, setCw] = useState(0);
  /** 由首帧（及 title 变化）内容测量得到的固定宽度，避免动效时盒子变宽 */
  const [lockedWidth, setLockedWidth] = useState(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCw(el.offsetWidth);
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setLockedWidth(el.offsetWidth);
  }, [title]);

  useLayoutEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, lockedWidth]);

  const maxIconSlide = Math.max(0, cw - PAD_PX * 2 - ICON_PX);
  const chars = toChars(title);
  const n = chars.length;

  const handleToggle = () => {
    setIconAtEnd((v) => !v);
  };

  const iconDuration = 1.15;
  const stagger = 0.09;
  const charDuration = 0.38;
  const charShift = 6;

  return (
    <h2 id={id} className={cx('mb-4 flex justify-center', className)}>
      <Motion.button
        type="button"
        ref={containerRef}
        initial={false}
        onClick={handleToggle}
        aria-pressed={iconAtEnd}
        aria-label={`切换「${title}」标题与图标位置`}
        className={cx(
          'relative box-border inline-flex h-[52px] max-w-full shrink-0 overflow-hidden rounded-full border border-love/15 bg-love/[0.08]',
          'cursor-pointer py-2 pl-2.5 pr-4 text-left font-inherit sm:py-2 sm:pl-3 sm:pr-5',
          lockedWidth == null && 'w-max',
          'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-love/50',
        )}
        style={
          lockedWidth != null
            ? { width: lockedWidth, maxWidth: '100%', boxSizing: 'border-box' }
            : { maxWidth: '100%', boxSizing: 'border-box' }
        }
      >
        <Motion.span
          aria-hidden
          initial={false}
          animate={{ x: iconAtEnd ? maxIconSlide : 0 }}
          transition={{ duration: iconDuration, ease: easeOut }}
          className={cx(
            'pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2',
            'flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-love/30',
          )}
          style={{ width: ICON_PX, height: ICON_PX }}
        >
          <img src={iconSrc} alt={iconAlt} className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </Motion.span>

        <Motion.div
          className="relative z-10 flex h-full min-h-0 min-w-0 items-center whitespace-nowrap pr-3 font-display text-lg font-bold tracking-wide text-brown-title sm:text-xl"
          initial={false}
          animate={{ paddingLeft: iconAtEnd ? TEXT_PL_END : TEXT_PL_START }}
          transition={{ duration: iconDuration, ease: easeOut }}
        >
          <div className="flex flex-nowrap items-center justify-start gap-0">
            {chars.map((ch, i) => (
              <Motion.span
                key={`${i}-${ch}`}
                className="inline-block will-change-transform"
                initial={false}
                animate={{
                  x: iconAtEnd ? -charShift : 0,
                }}
                transition={{
                  duration: charDuration,
                  ease: easeOut,
                  delay: iconAtEnd ? i * stagger : (n - 1 - i) * stagger,
                }}
              >
                {ch}
              </Motion.span>
            ))}
          </div>
        </Motion.div>
      </Motion.button>
    </h2>
  );
};

export default HomeRomanceSectionHeading;
