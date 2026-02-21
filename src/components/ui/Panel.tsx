interface PanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Panel({ title, subtitle, children }: PanelProps): React.JSX.Element {
  return (
    <section className="panel">
      <h2 className="h2">{title}</h2>
      {subtitle ? <p className="muted mt-1">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

