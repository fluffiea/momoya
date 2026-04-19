import PageFooter from '@/components/ui/PageFooter';
import LinkUsSection from './link-us/LinkUsSection';
import LoveNote from './love-note/LoveNote';
import HeartLetter from './heart-letter/HeartLetter';

/**
 * 主页节奏：
 *   ┌─────────────────────────────┐
 *   │  Hero  ─ LinkUsSection      │  视觉重量最大（白卡 + 头像 + 倒计时）
 *   │                             │
 *   │  Pause ─ LoveNote           │  最轻：开放式引文，刻意去卡，作为「呼吸点」
 *   │                             │
 *   │  Beat  ─ HeartLetter        │  中等：信封卡序列
 *   │                             │
 *   │  End   ─ HomeFooter         │  极轻：装饰收尾
 *   └─────────────────────────────┘
 *
 * 段间距由本组件统一控制（mt-12 / sm:mt-14），不再由各 section 自带零散 padding，
 * 避免间距不一致带来的「轻重不均」感。
 */
const Home = () => {
  return (
    <div className="home-romance-bg min-h-full">
      <LinkUsSection />

      <div className="mt-10 sm:mt-12">
        <LoveNote />
      </div>

      <div className="mt-12 sm:mt-14">
        <HeartLetter />
      </div>

      <PageFooter text="愿我们的故事，越写越长" />
    </div>
  );
};

export default Home;
