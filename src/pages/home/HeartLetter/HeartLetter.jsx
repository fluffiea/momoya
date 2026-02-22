import cx from 'classnames';
import { useNavigate } from 'react-router-dom';
import style from './HeartLetter.module.scss';
import letterIcon from './icons/letter.svg';
import heartIcon from './icons/heart.svg';
import badIcon from './icons/bad.svg';
import TitleBar from '../../../components/TitleBar/TitleBar';

const Letter = (props) => {
  const {
    path = '',
    index = 0,
    tags = [],
    icon = '', 
    title = '',
    subTitle = '',
  } = props;

  const navigate = useNavigate();

  const bgColors = ['#FF8E9E', '#BDD9FF'];

  return (
    <div
      className={cx(style.letter, {[style.whiteFont]: !(index % 2)})}
      style={{ backgroundColor: bgColors[index % bgColors.length] }}
      onClick={() => path && navigate(path)}
    >
      <img src={icon} alt={title} />
      <span className={style.title}>{title}</span>
      <span className={style.subTitle}>{subTitle}</span>
      <div className={style.tags}>
        {tags.map(tag => <span key={tag}>{tag}</span>)}
      </div>
    </div>
  );
};

const HeartLetter = () => {
  const letters = [
    {
      path: '/confess',
      icon: heartIcon,
      title: '恋爱申请书',
      subTitle: '前辈，请和我交往',
      tags: ['2025.12.27'],
    },
    {
      path: '/apology',
      icon: badIcon,
      title: '道歉信',
      subTitle: '洗衣粉，我知错了',
      tags: ['2026.02.20'],
      
    }
  ];
  return (
    <div className={style.heartLetter}>
      <TitleBar icon={letterIcon} title="心动信件" />
      <div className={style.letters}>
        {letters.map((letter, index) => (
          <Letter
            key={index}
            index={index}
            path={letter.path}
            icon={letter.icon}
            tags={letter.tags}
            title={letter.title}
            subTitle={letter.subTitle}
          />
        ))}
      </div>
    </div>
  );
};

export default HeartLetter;
