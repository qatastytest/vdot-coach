import { RunnerProfileForm } from "@/components/profile/RunnerProfileForm";
import { Panel } from "@/components/ui/Panel";

export default function SettingsPage(): React.JSX.Element {
  return (
    <Panel title="Runner Profile" subtitle="Set your current load, constraints, and preferences for personalized planning.">
      <RunnerProfileForm />
    </Panel>
  );
}

