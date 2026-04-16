import { motion as Motion } from 'framer-motion';

export default function ChatBubble({ align, children, index = 0 }) {
  const isLeft = align === 'left';
  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={
        isLeft
          ? 'max-w-[88%] self-start rounded-2xl rounded-tl-md border border-slate-200/60 bg-linkus-bubble-a px-3.5 py-2.5 text-[15px] leading-relaxed text-linkus-bubble-a-text shadow-sm'
          : 'max-w-[88%] self-end rounded-2xl rounded-tr-md border border-love/20 bg-linkus-bubble-b px-3.5 py-2.5 text-[15px] leading-relaxed text-linkus-bubble-b-text shadow-sm'
      }
    >
      {children}
    </Motion.div>
  );
}
