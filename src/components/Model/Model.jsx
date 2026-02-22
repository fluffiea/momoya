import { createPortal } from 'react-dom';
import style from './Model.module.scss';

const Model = (props) => {
  const {
    visible = false,
    onClose = () => {},
    children = null,
    width = '60%',
  } = props;

  const closeHandler = (e) => {
    e.stopPropagation();
    onClose();
  };

  const model = () => (
    <div className={style.model} onClick={closeHandler}>
      <div className={style.container} style={{ width }}>{children}</div>
    </div>
  );

  return visible && createPortal(model(), document.body);
};

export default Model;
