import { useMemo, useState } from 'react';
import cx from 'classnames';
import style from './Confess.module.scss';
import RejectModel from './RejectModel/RejectModel';
import AcceptModel from './AcceptModel/AcceptModel';
import reject1 from './images/reject1.jpg';
import reject2 from './images/reject2.jpg';
import reject3 from './images/reject3.jpg';
import reject4 from './images/reject4.jpg';

// 内容段落
const PARAGRAPHS = [
  '“玲珑骰子安红豆，入骨相思知不知。”',
  '我想...我是喜欢上你了',
  '如果将自己比作一本书，只有在遇到有意义的事情的时候，这本书才会翻动的话，那在遇到你很久很久之前，属于我的这本书就已经尘封在角落了',
  '记不得那天是怎么样的了，或是晴天，或是雨天，也难得勇敢一次，在评论区捞到了你，即使这样，我也从未奢望过我们能有什么未来',
  '可就在慢慢的交往中，我开始期待早上起来你的消息，开始期待你会和我说些什么，开始期待你会分享生活中的琐事，我知道，我心动了',
  '总是觉得你只是一个分享欲很强的女生，只是喜欢分享，至于是不是我应该无所谓，我这样误会到，却依旧享受着你对我的分享欲，在灰色笼罩下的生活，像一束光照了下来，我没敢奢望我能一直拥有这束光，但是在它照在我身上的时候，我却将其全部视作是我的',
  '也很开心，这些都是我的误会',
  '我的喜欢是小心翼翼的，不是说他脆弱，而是他很真诚，现在，我变得自私了些，我希望，这束光真正属于我，而不是短暂出现在我的生活中',
  '请和我交往吧！'
];

// 拒绝按钮的文案
const REJECT_BTN_TEXTS = [
  '拒绝',
  '再想想呢',
  '再考虑一下',
  '不接受拒绝',
  '同意', // 最后一个为默认值
];

const REJECT_MODELS = [
  {
    src: reject1,
    info: '给你次机会重选'
  },
  {
    src: reject2,
    info: '还来，重选！'
  },
  {
    src: reject3,
    info: '你想死不是？'
  },
  {
    src: reject4,
    info: '求求你了，和我交往吧！'
  }
];

const Confess = () => {
  const [rejectStep, setRejectStep] = useState(0);
  const [rejectModelVisible, setRejectModelVisible] = useState(false);
  const [acceptModelVisible, setAcceptModelVisible] = useState(false);

  const rejectText = useMemo(() => {
    const text = REJECT_BTN_TEXTS[rejectStep];
    return text || REJECT_BTN_TEXTS[REJECT_BTN_TEXTS.length - 1];
  }, [rejectStep]);

  // 计算当前应该显示的拒绝弹窗图片
  const currentRejectModel = useMemo(() => {
    if (rejectStep > 0 && rejectStep <= REJECT_MODELS.length) {
      return REJECT_MODELS[rejectStep - 1];
    }
    return null;
  }, [rejectStep]);


  // 接受的回调
  const acceptHandler = () => {
    setAcceptModelVisible(true);
  };

  // 拒绝的回调
  const rejectHandler = () => {
    if (rejectStep < REJECT_BTN_TEXTS.length - 1) {
      const newStep = rejectStep + 1;
      setRejectStep(newStep);
      setRejectModelVisible(true);
    } else {
      acceptHandler();
    }
  };

  return (
    <div className={style.confess}>
      {/* 主题部分 */}
      <div className={style.container}>
        <div className={style.title}>恋爱申请书</div>
        <div className={style.content}>
        <div className={style.tomomo}>致 MOMO:</div>
          <div className={style.showloving}>
            {PARAGRAPHS.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className={style.btns}>
            <button
              className={cx(
                style.reject,
                {
                  [style.warn]: rejectStep === REJECT_BTN_TEXTS.length - 2,
                  [style.accept]: rejectStep > REJECT_BTN_TEXTS.length - 2,
                }
              )}
              onClick={rejectHandler}
            >
              {rejectText}
            </button>
            <button className={style.accept} onClick={acceptHandler}>同意</button>
          </div>
        </div>
      </div>

      {/* 底部部分 */}
      <div className={style.footer}>
        <p className={style.toRighht}>🎉 2025.12.27</p>
      </div>

      {/* 拒绝弹窗 */}
      <RejectModel
        visible={rejectModelVisible}
        onClose={() => setRejectModelVisible(false)}
        src={currentRejectModel?.src}
        info={currentRejectModel?.info}
      />

      <AcceptModel
        visible={acceptModelVisible}
        onClose={() => setAcceptModelVisible(false)}
      />
    </div>
  );
};

export default Confess;
