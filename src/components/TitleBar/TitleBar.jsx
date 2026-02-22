import style from './TitleBar.module.scss';

const TitleBar = (props) => {
  const { icon, title } = props;

  return (
    <div className={style.titleBar}>
      {icon && <img src={icon} alt={title} />}
      <span>{title}</span>
    </div>
  );
};

export default TitleBar;