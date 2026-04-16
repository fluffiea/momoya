/**
 * 恋区区块标题：今日寄语 / 心动信件共用「胶囊 + 图标 + 标题」骨架（class 由各页传入以保持视觉一致）。
 */
const HomeRomanceSectionHeading = (props) => {
  const { id, iconSrc, iconAlt = '', title, iconWrapperClassName, imgClassName } = props;

  return (
    <h2 id={id} className="mb-4 flex justify-center">
      <span className="inline-flex items-center gap-2.5 rounded-full border border-love/15 bg-love/[0.08] py-2 pl-2.5 pr-4 sm:gap-3 sm:py-2 sm:pl-3 sm:pr-5">
        <span className={iconWrapperClassName}>
          <img src={iconSrc} alt={iconAlt} className={imgClassName} />
        </span>
        <span className="font-display text-lg font-bold tracking-wide text-brown-title sm:text-xl">{title}</span>
      </span>
    </h2>
  );
};

export default HomeRomanceSectionHeading;
