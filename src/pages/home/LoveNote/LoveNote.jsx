import style from './LoveNote.module.scss';
import TitleBar from '../../../components/TitleBar/TitleBar';
import starIcon from './icons/star.svg';


const NOTES = [
  '我从不期待完美的爱情，也不奢求完美的你。我喜欢的，是真实、鲜活、有小脾气也有小温柔的你。不用刻意伪装，不用勉强自己，你只要安安心心做你自己，在我这里，你就已经足够好、足够珍贵。',
  '世界很吵，人心很杂，可只要一想到你，我就觉得安稳。我不想和你轰轰烈烈，只想和你安安稳稳。不用成为谁的期待，不用迎合谁的标准，你只要做你自己，我就会一直坚定地站在你身边。',
  '我喜欢你，不是因为你有多优秀，也不是因为你有多完美，而是因为你就是你。有缺点也没关系，有点笨拙也没关系，在我眼里，你所有的样子都可爱，所有的情绪都值得被好好安放。',
  '愿我们不必光芒万丈，只愿彼此温暖相伴。不用追赶时间，不用迎合世俗，慢慢走，好好爱，把普通的日子过成我们喜欢的样子。有你在，就是我全部的心安与欢喜。',
  '我想给你的，是不用小心翼翼的偏爱，是可以放心做自己的底气。你可以脆弱，可以不坚强，可以偶尔偷懒，也可以偶尔任性。因为在我这里，你永远被包容，永远被偏爱，永远值得被好好爱着。',
  '这一生很长，不必急着长大，不必急着完美。我会陪着你，看遍人间烟火，走过四季晨昏。你不用成为更好的别人，只要一直是你，就足够让我心动，足够让我珍惜一辈子。',
  '爱不是要求对方完美，而是接纳对方所有。我喜欢你的阳光，也包容你的低落；喜欢你的温柔，也理解你的倔强。你不用很完美，只要是你，就足够照亮我的全世界。',
  '日子如流水般漫长，我并不着急奔赴某个终点，只愿沿途的风景里一直有你。你不用为了我变成更完美的人，哪怕我们只是一起虚度时光，一起看云卷云舒，只要身边是你，这平庸的岁月就有了意义。',
  '我贪恋的人间烟火，不只是四季三餐，更是有你在的每一个清晨与黄昏。我爱的不是那个无所不能的你，而是这个会在我身边耍赖、会为了小事皱眉、真实又鲜活的你。在这路遥马急的人间，能安安稳稳做你的伴侣，便是我最大的幸运。',
  '我想和你一起，把日子过成我们喜欢的样子。不用太热烈，不用太耀眼，就这般温柔地并肩而行。你有你的棱角，我有我的弧度，我们不必为了彼此刻意打磨，就这样刚刚好地，嵌进对方的生命里。',
];

const LoveNote = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const counts = NOTES.length;
  const note = NOTES[day % counts];
  const date = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;

  return (
    <div className={style.loveNote}>
      <TitleBar icon={starIcon} title="今日寄语" />
      <span className={style.note}>
        <span>“{note}”</span>
        <span className={style.date}>{date}</span>
      </span>
    </div>
  );
};

export default LoveNote;
