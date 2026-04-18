import { useCallback, useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import ApologyPasswordGate from './ApologyPasswordGate';
import { readApologyUnlocked, writeApologyUnlocked } from './apologyAuth';

const DATE_LINE = '2026-02-20';

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
    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  if (!unlocked) {
    return <ApologyPasswordGate onSuccess={handleUnlock} />;
  }

  return (
    <div className="home-romance-bg min-h-screen px-5 py-8 pb-safe-page">
      <div className="mx-auto max-w-xl">
        <Motion.div
          className="love-note-card px-5 pb-6 pt-6 sm:px-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
        >
          <header className="border-b border-border-sweet/30 pb-5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-wide text-brown-title sm:text-[1.65rem]">
              道歉信
            </h1>
            <div
              className="mx-auto mt-3 flex max-w-[min(18rem,100%)] items-center gap-2.5 px-1"
              aria-hidden
            >
              <span className="h-px min-w-[1.5rem] flex-1 bg-gradient-to-r from-transparent via-love/30 to-love/40" />
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-love/15 text-[0.85rem] shadow-inner ring-1 ring-white/70">
                💌
              </span>
              <span className="h-px min-w-[1.5rem] flex-1 bg-gradient-to-l from-transparent via-love/30 to-love/40" />
            </div>
            <p className="mt-3 font-display text-[11px] font-medium tracking-[0.2em] text-love/50">
              犯错时间
            </p>
            <p className="mt-1 font-display text-sm tabular-nums text-brown-title/80">{DATE_LINE}</p>
          </header>

          <div className="relative mt-6">
            <div
              className="confess-letter-paper pointer-events-none absolute inset-0 opacity-[0.38]"
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
          </div>
        </Motion.div>
      </div>
    </div>
  );
};

export default Apology;
