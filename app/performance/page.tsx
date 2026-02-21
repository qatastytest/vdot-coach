import { PerformanceForm } from "@/components/performance/PerformanceForm";
import { Panel } from "@/components/ui/Panel";

export default function PerformancePage(): React.JSX.Element {
  return (
    <Panel
      title="Add Performance"
      subtitle="Use race/test input and Strava imports to calculate Daniels-style VDOT, update plan status, and refine predictions."
    >
      <PerformanceForm />
    </Panel>
  );
}

