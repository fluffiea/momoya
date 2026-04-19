import cx from 'classnames';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import HomeRomanceSectionHeading from '@/components/ui/HomeRomanceSectionHeading';
import letterIcon from './icons/letter.svg';
import { LETTERS } from './letters';

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
  },
};

type LetterProps = {
  path?: string;
  tags?: string[];
  icon?: string;
  title?: string;
  subTitle?: string;
};

const Letter = (props: LetterProps) => {
  const {
    path = '',
    tags = [],
    icon = '',
    title = '',
    subTitle = '',
  } = props;

  const navigate = useNavigate();
  const stampDate = tags[0];

  const handleClick = () => {
    if (path) navigate(path);
  };

  return (
    <Motion.div
      role="button"
      tabIndex={0}
      variants={cardVariants}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onClick={handleClick}
      aria-label={`打开${title}`}
      className={cx(
        'heart-letter-card group relative flex cursor-pointer items-center gap-3.5 px-3.5 py-3 sm:gap-4 sm:px-4 sm:py-3.5',
      )}
    >
      {/* 封蜡章 */}
      <span
        className="heart-letter-seal relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-[52px] sm:w-[52px]"
        aria-hidden
      >
        <img
          src={icon}
          alt=""
          className="relative z-10 h-5 w-5 brightness-0 invert sm:h-[22px] sm:w-[22px]"
          style={{ filter: 'drop-shadow(0 1px 0 rgb(217 138 168 / 0.35))' }}
        />
      </span>

      {/* 文字区 */}
      <div className="min-w-0 flex-1 pr-12 sm:pr-14">
        <h3 className="truncate font-display text-[15px] font-bold leading-tight text-brown-title sm:text-base">
          {title}
        </h3>
        {subTitle && (
          <p className="mt-1 line-clamp-1 text-[12px] italic leading-snug text-neutral-500 sm:text-[13px]">
            “{subTitle}”
          </p>
        )}
        {/* 装饰：信纸下划线 */}
        <span
          aria-hidden
          className="mt-2 block h-px w-12 bg-gradient-to-r from-love/40 to-transparent sm:w-14"
        />
      </div>

      {/* 邮戳日期 */}
      {stampDate && (
        <span
          aria-hidden
          className="heart-letter-stamp absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 font-display text-[10px] font-bold tracking-[0.06em] tabular-nums sm:px-2 sm:text-[11px]"
        >
          {stampDate}
        </span>
      )}

      {/* 右侧箭头指示（hover 显） */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-1.5 text-[10px] text-love/0 transition group-hover:text-love/60"
      >
        ›
      </span>
    </Motion.div>
  );
};

const HeartLetter = () => {
  return (
    <section
      className="mx-auto w-[92%] max-w-md px-0"
      aria-labelledby="heart-letter-heading"
    >
      <HomeRomanceSectionHeading
        id="heart-letter-heading"
        iconSrc={letterIcon}
        title="心动信件"
      />

      <Motion.div
        className="flex flex-col gap-2.5 sm:gap-3"
        variants={listVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-24px' }}
      >
        {LETTERS.map((letter) => (
          <Letter
            key={letter.path}
            path={letter.path}
            icon={letter.icon}
            tags={letter.tags}
            title={letter.title}
            subTitle={letter.subTitle}
          />
        ))}
      </Motion.div>
    </section>
  );
};

export default HeartLetter;
