import { describe, expect, it } from "vitest";
import {
  buildActivityInsights,
  deriveBaselineFromActivities,
  parseStravaImportFile
} from "@/lib/integrations/strava";

describe("Strava integration helpers", () => {
  it("parses JSON activities and computes insights", () => {
    const payload = JSON.stringify([
      {
        id: "a1",
        name: "Morning Run",
        type: "Run",
        start_date_local: "2026-02-10T07:10:00Z",
        moving_time: 1500,
        distance: 5000
      },
      {
        id: "a2",
        name: "Long Run",
        type: "Run",
        start_date_local: "2026-02-15T08:00:00Z",
        moving_time: 5400,
        distance: 16000
      }
    ]);

    const parsed = parseStravaImportFile(payload);
    expect(parsed.activities).toHaveLength(2);
    const insights = buildActivityInsights(parsed.activities);
    expect(insights.runActivities).toBe(2);
    expect(insights.totalRunKm).toBeCloseTo(21, 1);
    expect(insights.fiveKPbSec).toBeTruthy();
  });

  it("derives a baseline from run activities", () => {
    const parsed = parseStravaImportFile(
      JSON.stringify([
        {
          id: "x1",
          name: "Race 5K",
          type: "Run",
          start_date_local: "2026-02-01T08:00:00Z",
          moving_time: 1320,
          distance: 5000
        }
      ])
    );
    const baseline = deriveBaselineFromActivities(parsed.activities);
    expect(baseline).not.toBeNull();
    expect((baseline?.vdot ?? 0) > 40).toBe(true);
  });
});
