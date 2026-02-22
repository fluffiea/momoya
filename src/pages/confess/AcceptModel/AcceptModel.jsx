import style from './AcceptModel.module.scss';
import Model from '../../../components/Model/Model';
import accept from './images/accept.png';

const AcceptModel = (props) => {
  return (
    <Model {...props} width="86%">
      <div className={style.acceptModel}>
        <div className={style.title}>
          <p>欧耶！</p>
          <p>我就知道你会同意的~</p>
        </div>
        <div className={style.content}>
          <p className={style.toRight}>⭐ momo & yaya</p>
          <p className={style.toRight}>⭐ 2025.12.12</p>
          <p>BIBOBIBO~</p>
          <p>请多指教</p>
          <p>嗯~就这样，渐渐地越来越喜欢彼此❤️</p>
          <img src={accept} alt="" />
        </div>
      </div>
    </Model>
  );
};

export default AcceptModel;
