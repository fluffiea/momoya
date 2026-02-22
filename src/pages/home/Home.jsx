import style from './Home.module.scss';
import LinkUs from './LinkUs/LinkUs';
import LoveNote from './LoveNote/LoveNote';
import HeartLetter from './HeartLetter/HeartLetter';

const Home = () => {
  return (
    <div className={style.home}>
      <LinkUs />
      <LoveNote />
      <HeartLetter />
    </div>
  );
};

export default Home;