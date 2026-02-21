import { z } from "zod";
import { parseTimeToSeconds } from "@/lib/core/time";

const yyyyMmDd = /^\d{4}-\d{2}-\d{2}$/;

export const performanceFormSchema = z.object({
  distanceMeters: z.coerce.number().min(600).max(100000),
  time: z
    .string()
    .min(4, "Time is required in mm:ss or hh:mm:ss format.")
    .refine((value) => {
      try {
        parseTimeToSeconds(value);
        return true;
      } catch {
        return false;
      }
    }, "Time must be mm:ss or hh:mm:ss."),
  date: z.string().regex(yyyyMmDd, "Date must be YYYY-MM-DD."),
  eventType: z.enum(["race", "test"]),
  effortType: z.enum(["all_out", "hard", "controlled"]),
  surface: z.enum(["track", "road", "trail", "mixed"]),
  elevationGainM: z.coerce.number().min(0).max(5000).optional().or(z.literal("")),
  temperatureC: z.coerce.number().min(-30).max(55).optional().or(z.literal("")),
  windKph: z.coerce.number().min(0).max(120).optional().or(z.literal(""))
});

export const runnerProfileSchema = z.object({
  age: z.coerce.number().int().min(12).max(90).optional().or(z.literal("")),
  weeklyKmCurrent: z.coerce.number().min(10).max(250),
  weeklyKmMaxTolerated: z.coerce.number().min(10).max(300),
  daysPerWeekAvailable: z.coerce.number().int().min(3).max(6),
  preferredLongRunDay: z.enum([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]),
  maxHr: z.coerce.number().int().min(120).max(240).optional().or(z.literal("")),
  restingHr: z.coerce.number().int().min(30).max(100).optional().or(z.literal("")),
  lthr: z.coerce.number().int().min(100).max(220).optional().or(z.literal("")),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  injuryNotes: z.string().max(500).optional(),
  preferredUnits: z.enum(["km", "mile"])
});

export const raceGoalSchema = z.object({
  goalDistance: z.enum(["5k", "10k", "half"]),
  targetDate: z.string().regex(yyyyMmDd, "Date must be YYYY-MM-DD."),
  targetTime: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || value.trim() === "") return true;
      try {
        parseTimeToSeconds(value);
        return true;
      } catch {
        return false;
      }
    }, "Target time must be mm:ss or hh:mm:ss."),
  ambition: z.enum(["finish", "realistic_pb", "aggressive_pb"]),
  daysPerWeek: z.coerce.number().int().min(3).max(6),
  longRunDay: z.enum([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]),
  trackAccess: z.boolean(),
  planLengthWeeks: z.union([z.literal(4), z.literal(8), z.literal(12), z.literal(16)])
});

export type PerformanceFormValues = z.infer<typeof performanceFormSchema>;
export type RunnerProfileFormValues = z.infer<typeof runnerProfileSchema>;
export type RaceGoalFormValues = z.infer<typeof raceGoalSchema>;
