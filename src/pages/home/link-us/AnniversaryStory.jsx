import { Fragment } from 'react';
import ChatBubble from './ChatBubble';

const MEMORY_MESSAGES = [
  { align: 'left', text: '“提问，表白可以醒酒吗？”' },
  { align: 'right', text: '“表白不可以，你可以！”' },
  { align: 'left', text: '“差点忘记玩阴阳师的初衷了, cpdd”' },
  { align: 'right', text: '“差点忘记玩阴阳师的初衷了, cpdd”' },
];

export default function AnniversaryStory() {
  return (
    <Fragment>
      <div className="link-us-anniversary-header">
        <p className="font-display text-base font-semibold tracking-wide text-brown-title/80 sm:text-lg">
          2025/12/12 22:02
        </p>
        <p className="mt-1.5 font-display text-sm font-bold text-love">我们在一起啦！</p>
      </div>

      <div
        className="mt-4 flex max-h-[min(52vh,420px)] flex-col gap-3 overflow-y-auto pr-1"
        role="log"
        aria-label="纪念日对话"
      >
        {MEMORY_MESSAGES.map((msg, i) => (
          <ChatBubble key={`memory-${i}`} align={msg.align} index={i}>
            {msg.text}
          </ChatBubble>
        ))}
      </div>
    </Fragment>
  );
}
