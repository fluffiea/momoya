import style from './RejectModel.module.scss';
import Model from '../../../components/Model/Model';

const RejectModel = (props) => {
  const {
    visible,
    onClose,
    src,
    info,
  } = props;

  return (
    <Model visible={visible} onClose={onClose}>
      <div className={style.rejectModel}>
        <img src={src} alt="暂无图片" />
        <div className={style.info}>{info}</div>
      </div>
    </Model>
  );
};

RejectModel.defaultProps = {
  visible: false,
  onClose: () => {},
  src: '',
  info: '',
};

export default RejectModel;
