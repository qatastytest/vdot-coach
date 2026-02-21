import Link from "next/link";
import { Panel } from "@/components/ui/Panel";

export default function HomePage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Panel
        title="VDOT Coach MVP"
        subtitle="Scientifically grounded calculator and conservative rule-based planning for 5K, 10K, and Half Marathon goals."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/performance" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">1. Add Performance</p>
            <p className="muted mt-1">Calculate VDOT and confidence label.</p>
          </Link>
          <Link href="/results" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">2. Review Results</p>
            <p className="muted mt-1">Predictions, pace zones, lap splits, HR estimates.</p>
          </Link>
          <Link href="/goal" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">3. Generate Plan</p>
            <p className="muted mt-1">4 or 8 weeks with practical alternatives.</p>
          </Link>
        </div>
      </Panel>

      <Panel title="MVP Disclaimers" subtitle="Important context before training decisions.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>This tool provides training guidance, not medical advice.</li>
          <li>HR zones are estimates and vary with conditions and fatigue state.</li>
          <li>Trail or non all-out efforts reduce prediction reliability.</li>
          <li>Easy runs should prioritize effort and consistency over exact pace.</li>
        </ul>
      </Panel>
    </div>
  );
}

