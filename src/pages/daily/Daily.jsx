const Daily = () => {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 pt-12">
      <div className="w-full rounded-3xl border border-love/25 bg-white/80 p-8 text-center shadow-soft ring-1 ring-love/10 backdrop-blur-sm">
        <div className="mb-4 text-5xl" aria-hidden>
          📝✨
        </div>
        <h1 className="font-display text-xl font-bold text-neutral-700">
          日常页还在悄悄生长中
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          先把今天的喜欢存好，等这里长满了小日常，再来一起翻页吧～
        </p>
        <div className="mt-6 inline-flex rounded-full bg-love/15 px-4 py-2 text-xs font-medium text-love">
          Coming soon
        </div>
      </div>
    </div>
  );
};

export default Daily;
