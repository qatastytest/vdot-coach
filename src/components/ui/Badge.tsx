interface BadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warn" | "danger";
}

export function Badge({ label, tone = "neutral" }: BadgeProps): React.JSX.Element {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : tone === "danger"
          ? "bg-rose-100 text-rose-800"
          : "bg-slate-100 text-slate-800";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{label}</span>;
}

