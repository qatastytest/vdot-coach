import { PrismaClient, AmbitionLevel, EffortType, EventType, ExperienceLevel, GoalDistance, SurfaceType, Units } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: "local@vdotcoach.app" },
    update: {},
    create: {
      email: "local@vdotcoach.app",
      name: "Local Runner"
    }
  });

  await prisma.runnerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      weeklyKmCurrent: 42,
      weeklyKmMaxTolerated: 58,
      daysPerWeekAvailable: 5,
      preferredLongRunDay: "Sunday",
      maxHr: 188,
      restingHr: 52,
      lthr: 171,
      experienceLevel: ExperienceLevel.intermediate,
      preferredUnits: Units.km
    }
  });

  const performance = await prisma.performance.create({
    data: {
      userId: user.id,
      distanceMeters: 5000,
      timeSeconds: 1260,
      date: new Date("2026-01-15"),
      eventType: EventType.race,
      effortType: EffortType.all_out,
      surface: SurfaceType.road,
      elevationGainM: 20,
      windKph: 8
    }
  });

  await prisma.vdotResult.create({
    data: {
      performanceId: performance.id,
      vdot: 47.8,
      confidenceLabel: "high",
      confidenceReasons: ["All-out road effort with low elevation/wind."],
      vo2Demand: 50.1,
      fractionSustained: 1.05,
      speedMPerMin: 238.1
    }
  });

  await prisma.raceGoal.create({
    data: {
      userId: user.id,
      goalDistance: GoalDistance.k10,
      targetDate: new Date("2026-04-20"),
      targetTimeSeconds: 3000,
      ambition: AmbitionLevel.realistic_pb,
      daysPerWeek: 5,
      longRunDay: "Sunday",
      trackAccess: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
