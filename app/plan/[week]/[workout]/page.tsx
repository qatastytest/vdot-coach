import { WorkoutDetail } from "@/components/plan/WorkoutDetail";

interface WorkoutDetailPageProps {
  params: Promise<{
    week: string;
    workout: string;
  }>;
}

export function generateStaticParams(): Array<{ week: string; workout: string }> {
  const params: Array<{ week: string; workout: string }> = [];
  for (let week = 0; week < 8; week += 1) {
    for (let workout = 0; workout < 6; workout += 1) {
      params.push({ week: String(week), workout: String(workout) });
    }
  }
  return params;
}

export const dynamicParams = false;

export default async function WorkoutDetailPage({ params }: WorkoutDetailPageProps): Promise<React.JSX.Element> {
  const resolved = await params;
  const weekIndex = Number(resolved.week);
  const workoutIndex = Number(resolved.workout);

  return <WorkoutDetail weekIndex={weekIndex} workoutIndex={workoutIndex} />;
}
