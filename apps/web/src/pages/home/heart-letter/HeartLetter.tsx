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
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
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

  const handleClick = () => {
    if (path) {
      navigate(path);
    }
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
      className={cx(
        'heart-letter-card flex min-h-0 cursor-pointer flex-col items-center gap-2 p-4 text-center transition duration-200 sm:gap-2.5 sm:p-[18px]',
        'hover:border-love/32 hover:shadow-[0_6px_22px_rgb(249_172_201/0.16)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-love/50',
      )}
      onClick={handleClick}
      aria-label={`打开${title}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-love/35 to-love/52 ring-1 ring-white/70 shadow-sm sm:h-11 sm:w-11">
        <img
          src={icon}
          alt=""
          className="h-6 w-6 sm:h-7 sm:w-7"
        />
      </span>
      <h3 className="line-clamp-2 w-full font-display text-base font-bold leading-snug text-brown-title sm:text-lg">
        {title}
      </h3>
      <p className="line-clamp-2 w-full text-xs leading-snug text-neutral-700 sm:text-sm">
        {subTitle}
      </p>
      <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-1 pt-0.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-block shrink-0 rounded-full bg-love/14 px-2 py-0.5 text-[11px] font-medium text-brown-title/85 sm:text-xs"
          >
            {tag}
          </span>
        ))}
      </div>
    </Motion.div>
  );
};

const HeartLetter = () => {
  return (
    <section
      className="mx-auto w-[92%] max-w-md px-0 pt-6"
      aria-labelledby="heart-letter-heading"
    >
      <HomeRomanceSectionHeading
        id="heart-letter-heading"
        iconSrc={letterIcon}
        title="心动信件"
      />

      <Motion.div
        className="grid grid-cols-2 gap-2.5 sm:gap-3"
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
