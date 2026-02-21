import { HrSetupForm } from "@/components/hr/HrSetupForm";
import { Panel } from "@/components/ui/Panel";

export default function HrSetupPage(): React.JSX.Element {
  return (
    <Panel title="Heart Rate Setup" subtitle="Configure optional HR anchors and preview multiple zone estimation methods.">
      <HrSetupForm />
    </Panel>
  );
}

