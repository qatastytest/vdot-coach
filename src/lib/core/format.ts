import { formatPace, formatSecondsToClock } from "@/lib/core/time";

export function formatPacePerKm(secondsPerKm: number): string {
  return `${formatPace(secondsPerKm)}/km`;
}

export function formatPacePerMile(secondsPerMile: number): string {
  return `${formatPace(secondsPerMile)}/mi`;
}

export function formatTime(seconds: number): string {
  return formatSecondsToClock(seconds);
}
