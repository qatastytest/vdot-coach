import { GoalSetupForm } from "@/components/goal/GoalSetupForm";
import { Panel } from "@/components/ui/Panel";

export default function GoalPage(): React.JSX.Element {
  return (
    <Panel
      title="Goal Setup"
      subtitle="Create a 4-week or 8-week conservative plan for 5K, 10K, or Half Marathon."
    >
      <GoalSetupForm />
    </Panel>
  );
}

