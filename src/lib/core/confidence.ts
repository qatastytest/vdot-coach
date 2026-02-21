import { ConfidenceResult, PerformanceInput } from "@/lib/core/types";

export function assessPerformanceConfidence(input: PerformanceInput): ConfidenceResult {
  const reasons: string[] = [];
  const elevation = input.elevationGainM ?? 0;
  const wind = input.windKph ?? 0;

  if (input.surface === "trail" || input.surface === "mixed") {
    reasons.push("Off-road terrain introduces variable effort and pacing.");
  }

  if (input.effortType === "controlled") {
    reasons.push("Controlled effort does not represent maximal race capability.");
  }

  if (elevation >= 150 || wind >= 25) {
    reasons.push("Significant elevation gain or wind can distort race equivalence.");
  }

  if (
    input.effortType === "all_out" &&
    (input.surface === "track" || (input.surface === "road" && elevation <= 30)) &&
    wind <= 15
  ) {
    return { label: "high", reasons: ["All-out effort on track/flat road supports strong reliability."] };
  }

  if (
    input.surface === "road" &&
    elevation <= 120 &&
    wind <= 20 &&
    input.effortType !== "controlled"
  ) {
    return {
      label: "medium",
      reasons:
        reasons.length > 0
          ? reasons
          : ["Road performance is usable but environmental factors may reduce precision."]
    };
  }

  return {
    label: "low",
    reasons:
      reasons.length > 0
        ? reasons
        : ["This effort/context is less reliable for translating to precise training/race predictions."]
  };
}
