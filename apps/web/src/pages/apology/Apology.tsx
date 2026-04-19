import { useCallback, useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import ApologyPasswordGate from './ApologyPasswordGate';
import { readApologyUnlocked, writeApologyUnlocked } from './apologyAuth';

const DATE_LINE = '2026.02.20';

const PARAGRAPHS = [
  '我错了宝宝！',
  '今天在和宝宝聊天的时候，说了一些很重的话，很抱歉宝宝，此时此刻，我已经经过反思，认清自己的问题了。对自己在意的人我不应该说话那么重，还让宝宝自己一个人内耗了好久好久。我真是太坏了。',
  '不过宝宝真的超级天使，没有过多的责怪我，但是作为这件错误事情的始作俑者，我必须深刻思考自己的问题。我自己有时候太欠了，这个我也非常清楚，我会慢慢改正的，希望我的宝宝能给我多点耐心，谢谢宝宝。',
  '虽然我惹了宝宝不开心，但是我也需要给宝宝解释一下，有些事情是宝宝误会了嗷，比如我真的没有去试探你有没有反思什么的，我只是想知道你有没有生气，并没有pua你的想法，并没有试探你，看看你有没有反思的想法，请相信我。',
  '我是一个比较容易内耗的人，有时候我很清楚某件事情，但是在情绪上就是有点过不去，所以会在不经意间伤害到你，不过我已经非常清楚自己的问题了，我肯定也会积极改正的，应该不是改正，而是变得更好。',
  '宝宝大人有大量，原谅我好不好呀（虽然我已经知道宝宝没有在生气了，但是我还是诚恳地祈求宝宝原谅）',
  '爱你宝宝，请一定一定不要生气~~😭😭😭',
];

const Apology = () => {
  const [unlocked, setUnlocked] = useState(readApologyUnlocked);
  const reduceMotion = useReducedMotion();

  const handleUnlock = useCallback(() => {
    writeApologyUnlocked();
    setUnlocked(true);
  }, []);

  const cardTransition = reduceMotion
    ? { duration: 0.2 }
    : { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const };

  if (!unlocked) {
    return <ApologyPasswordGate onSuccess={handleUnlock} />;
  }

  return (
    <div className="home-romance-bg px-4 pt-8 pb-safe-page sm:pt-10">
      <Motion.div
        className="mx-auto max-w-xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cardTransition}
      >
        {/* 信封纸主体 */}
        <div className="letter-envelope relative rounded-[28px] border border-white/65 px-5 pt-12 pb-7 sm:px-7 sm:pt-14 sm:pb-8">
          {/* 大封蜡章：浮在顶部中心 */}
          <span
            className="letter-wax-seal absolute left-1/2 -top-7 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full sm:h-[60px] sm:w-[60px]"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="white"
              className="relative h-6 w-6 drop-shadow-[0_1px_1px_rgb(140_40_70/0.5)] sm:h-7 sm:w-7"
            >
              <path d="M12 21s-7-4.5-9.5-9C.5 8.5 2.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4.5 0 6.5 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z" />
            </svg>
          </span>

          {/* 邮戳：右上角圆章 */}
          <span
            className="letter-postmark absolute right-4 top-4 flex h-14 w-14 select-none items-center justify-center rounded-full font-display text-[10px] font-bold leading-tight tracking-[0.04em] text-love/85 sm:right-5 sm:top-5 sm:h-[60px] sm:w-[60px] sm:text-[11px]"
            aria-hidden
          >
            <span className="text-center tabular-nums">
              {DATE_LINE.replace(/\./g, '\n')}
            </span>
          </span>

          {/* 标题 */}
          <header className="text-center">
            <h1 className="font-display text-[26px] font-bold tracking-[0.04em] text-brown-title sm:text-[30px]">
              道歉信
            </h1>
            <div className="mx-auto mt-2 flex max-w-[14rem] items-center gap-2.5" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-love/40" />
              <span className="font-display text-[11px] tracking-[0.32em] text-brown-title/55">
                给我的宝宝
              </span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-love/40" />
            </div>
          </header>

          {/* 正文 */}
          <div className="relative mt-7">
            <div
              className="apology-letter-paper pointer-events-none absolute inset-0 opacity-[0.7]"
              aria-hidden
            />
            <div className="relative text-[15px] leading-[1.78] text-neutral-600/95 sm:text-base">
              {PARAGRAPHS.map((p, index) =>
                index === 0 ? (
                  <p
                    key={p}
                    className="text-center font-display text-base font-semibold leading-relaxed text-brown-title/95 sm:text-lg"
                  >
                    {p}
                  </p>
                ) : (
                  <p key={p} className="mt-4 indent-8">
                    {p}
                  </p>
                ),
              )}
            </div>

            {/* 落款 */}
            <div className="mt-6 text-right text-[13px] text-brown-title/60 sm:mt-7">
              <p className="font-display italic">—— 一个知道错了的我</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center font-display text-[12px] tracking-[0.22em] text-brown-title/50 sm:text-[13px]">
          请收下这封信
        </p>
      </Motion.div>
    </div>
  );
};

export default Apology;
