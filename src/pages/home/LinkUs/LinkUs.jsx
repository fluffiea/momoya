import { useState, useRef, useEffect, Fragment } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import style from './LinkUs.module.scss';
import yayaAvatar from './images/yaya.jpg';
import momoAvatar from './images/momo.jpg';

// 我们的周年纪念日
const ANNIVERSARY = new Date(2025, 11, 12, 22, 2, 0); // 2025-12-12 22:02:00

const LinkUs = () => {
  const timers = useRef({});
  const [showAnniversary, setShowAnniversary] = useState(false); // 是否展示周年纪念日
  const [anniversary, setAnniversary] = useState({
    days: '...',
    hours: '...',
    minutes:'...',
    seconds: '...',
  });
  const [partners, setPartners] = useState([
    {
      name: '江江',
      avatar: yayaAvatar,
      showAvatar: true,
    },
    {
      name: 'heart',
    },
    {
      name: '萌萌',
      avatar: momoAvatar,
      showAvatar: true,
    }
  ]);

  // 切换头像显示
  const switchAvatarShow = (index) => {
    setPartners(prev => prev.map((p, i) => {
      if (index === i) {
        return { ...p, showAvatar: !p.showAvatar}
      }
      return p;
    }));
  };

  // 点击头像切换显示
  const handleAvatarClick = (index) => {
    switchAvatarShow(index);
    clearTimeout(timers.current[index]);
    timers.current[index] = setTimeout(() => {
      switchAvatarShow(index);
      clearTimeout(timers.current[index]);
    }, 1000);
  };

  // 计算周年纪念日
  const calculateAnniversary = () => {
    const now = new Date();
    const diff = now.getTime() - ANNIVERSARY.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setAnniversary({ days, hours, minutes, seconds });
  };

  // 计算周年纪念日
  useEffect(() => {
    clearInterval(timers.current['anniversary']);
    timers.current['anniversary'] = setInterval(calculateAnniversary, 1000, true);

    // 清除定时器
    return () => {
      Object.values(timers.current).forEach((timer) => {
        clearTimeout(timer);
        clearInterval(timer);
      });
    };
  }, []);

  const renderYayaSay = (p, key) => (
    <Motion.span
      key={key}
      className={style.yayaSay}
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {p}
    </Motion.span>
  );

  const renderMomoSay = (p, key) => (
    <Motion.span
      key={key}
      className={style.momoSay}
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {p}
    </Motion.span>
  );

  return (
    <div className={style.linkUs}>
      {/* 展示我们的小脑袋瓜 */}
      <div className={style.partners}>
        {partners.map((p, index) => {
          if (p.name === 'heart') {
            return (
              <div 
                key={p.name}
                className={style.heart}
                onClick={() => setShowAnniversary(prev => !prev)}
              >
                ❤️
              </div>
            );
          }
          return (
            <div className={style.partner} key={p.name}>
              <AnimatePresence>
                {p.showAvatar ? (
                  <Motion.img
                    key="showwAvatar"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.3 }}
                    src={p.avatar}
                    alt={p.name}
                    onClick={() => handleAvatarClick(index)}
                  />
                ) : (
                  <Motion.span
                    key="hideAvatar"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {p.name}
                  </Motion.span>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      {/* 展示我们的周年纪念日 */}
      <div className={style.anniversary}>
        {showAnniversary ? (
          <Fragment>
            <span className={style.title}>2025/12/12 22:02</span>
            <span className={style.subTitle}>我们在一起啦！</span>
            {/* 一句情话 */}
            <div className={style.quote}>
              {renderYayaSay('“提问，表白可以醒酒吗？”', '0')}
              {renderMomoSay('“表白不可以，你可以！”', '1')}
              {renderYayaSay('“差点忘记玩阴阳师的初衷了, cpdd”', '2')}
              {renderMomoSay('“差点忘记玩阴阳师的初衷了, cpdd”', '3')}
            </div>
          </Fragment>
        ) : (
          <Fragment>
            <span className={style.title}>这是我们一起走过的</span>
            <div className={style.card}>
              <div className={style.days}>
                <span>{anniversary.days}</span>
                <span className={style.daysUnit}>天</span>
              </div>
              <div className={style.time}>
                <span className={style.hours}>{anniversary.hours}小时</span>
                <span className={style.minutes}>{anniversary.minutes}分钟</span>
                <span className={style.seconds}>{anniversary.seconds}秒钟</span>
              </div>
            </div>
          </Fragment>
        )}
      </div>
    </div>
  );
};

export default LinkUs;