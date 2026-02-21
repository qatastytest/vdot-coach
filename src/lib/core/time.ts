const TIME_2_PART_RE = /^(\d{1,2}):([0-5]\d)$/;
const TIME_3_PART_RE = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;

export function parseTimeToSeconds(raw: string): number {
  const value = raw.trim();
  const threePart = value.match(TIME_3_PART_RE);
  if (threePart) {
    const hours = Number(threePart[1]);
    const minutes = Number(threePart[2]);
    const seconds = Number(threePart[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const twoPart = value.match(TIME_2_PART_RE);
  if (twoPart) {
    const minutes = Number(twoPart[1]);
    const seconds = Number(twoPart[2]);
    return minutes * 60 + seconds;
  }

  throw new Error("Time must be mm:ss or hh:mm:ss.");
}

export function formatSecondsToClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatPace(secondsPerUnit: number): string {
  const mins = Math.floor(secondsPerUnit / 60);
  const secs = Math.round(secondsPerUnit % 60);
  if (secs === 60) {
    return `${mins + 1}:00`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
