import { WorkoutDetail } from "@/components/plan/WorkoutDetail";

interface WorkoutDetailPageProps {
  params: Promise<{
    week: string;
    workout: string;
  }>;
}

export default async function WorkoutDetailPage({ params }: WorkoutDetailPageProps): Promise<React.JSX.Element> {
  const resolved = await params;
  const weekIndex = Number(resolved.week);
  const workoutIndex = Number(resolved.workout);

  return <WorkoutDetail weekIndex={weekIndex} workoutIndex={workoutIndex} />;
}
