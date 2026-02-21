interface InfoTipProps {
  title: string;
  content: string;
}

export function InfoTip({ title, content }: InfoTipProps): React.JSX.Element {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold text-slate-600"
        aria-label={title}
      >
        ?
      </button>
      <span className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 opacity-0 shadow-md transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block">{content}</span>
      </span>
    </span>
  );
}
