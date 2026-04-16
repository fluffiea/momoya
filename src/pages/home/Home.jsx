import LinkUsSection from './link-us/LinkUsSection';
import LoveNote from './love-note/LoveNote';
import HeartLetter from './heart-letter/HeartLetter';

const Home = () => {
  return (
    <div className="home-romance-bg min-h-tab-page">
      <LinkUsSection />
      <LoveNote />
      <HeartLetter />
    </div>
  );
};

export default Home;