import { PerformanceForm } from "@/components/performance/PerformanceForm";
import { Panel } from "@/components/ui/Panel";

export default function PerformancePage(): React.JSX.Element {
  return (
    <Panel
      title="Add Performance"
      subtitle="Use a race or hard test to calculate Daniels-style VDOT and downstream training targets."
    >
      <PerformanceForm />
    </Panel>
  );
}

