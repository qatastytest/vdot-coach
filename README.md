# VDOT Coach (MVP)

VDOT Coach is a Next.js + TypeScript MVP for runners that provides:

- Daniels-style VDOT calculation from race/test performances
- Race time predictions (1500m, mile, 3K, 5K, 10K, HM, Marathon)
- Training pace zones and lap split conversions
- Heart rate zone estimates using three methods
- Conservative rule-based 4/8/12/16-week training plans for 5K, 10K, HM goals
- Editable workouts with done/skip tracking and plan refresh from feedback
- In-app concept tooltips (LTHR, resting HR, confidence) and quick measurement guidance

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Zod validation
- Vitest unit tests
- Prisma ORM + SQLite (schema designed to be portable to Postgres)

## Setup

1. Create env file:
   - Copy `.env.example` to `.env`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client:
   - `npm run prisma:generate`
4. (Optional) Create DB and seed demo data:
   - `npm run prisma:migrate:dev -- --name init`
   - `npm run prisma:seed`
5. Run app:
   - `npm run dev`
6. Run tests:
   - `npm test`

## GitHub Pages Deploy

- This repo includes automatic deploy workflow: `.github/workflows/deploy-pages.yml`.
- On every push to `main`, GitHub Actions builds static export and deploys to Pages.
- Expected Pages URL for this repo:
  - `https://qatastytest.github.io/vdot-coach/`
- In GitHub repo settings, ensure:
  - `Settings -> Pages -> Build and deployment -> Source = GitHub Actions`

## Strava Sync on GitHub Pages

- `Performance` page now supports both:
  - Strava file import (`CSV` or `JSON`)
  - Direct Strava OAuth + API sync (`Connect Strava` + `Sync now`)
- In static GitHub Pages mode, Strava credentials/token are stored per profile in browser localStorage.
- This is convenient for personal use, but insecure for shared/public devices.
- Recommended minimum safeguards:
  - Never commit `client_secret` or tokens in git history
  - Revoke/rotate token immediately if leaked
  - Use this mode only for private personal usage
- If browser blocks OAuth/token exchange due CORS/policy, keep using file import until backend proxy (Supabase) is added.

## Routes

- `/` Profile login/select screen
- `/dashboard` Home dashboard
- `/performance` Add performance
- `/results` VDOT results and coaching outputs
- `/hr-setup` HR setup and zone preview
- `/goal` Goal setup and plan generation
- `/plan` Training plan overview
- `/plan/[week]/[workout]` Workout detail
- `/settings` Runner profile

## Local Profile Selector (Netflix-style MVP)

- Landing page (`/`) is a profile-login screen with track background.
- You enter `/dashboard` only after selecting or creating a profile.
- Each profile stores its own:
  - runner settings
  - baseline performance/VDOT snapshot
  - race goal
  - generated plan
- Existing legacy single-profile localStorage data is auto-migrated into `My Profile`.
- Profile card customization supports icon, card color, theme label, short description, and 5K PB display.
- This is still local browser persistence (no cloud sync/account auth yet).

## Scientific Formulas (Implemented)

Definitions:

- `v` = speed in meters per minute
- `t` = race time in minutes

Formulas:

1. `VO2 race demand = -4.60 + 0.182258 * v + 0.000104 * v^2`
2. `Fraction sustained = 0.8 + 0.1894393 * exp(-0.012778 * t) + 0.2989558 * exp(-0.1932605 * t)`
3. `VDOT = VO2 race demand / Fraction sustained`

Notes:

- Internal math uses full precision floating-point
- Displayed VDOT is rounded to 0.1
- Race prediction solver uses binary search for equivalent-VDOT time (not hardcoded table lookup)

## Pace Zones and HR Zones

- Pace zones are derived from VDOT-based intensity bands (Daniels-style approximation)
- Zones included: Easy, Marathon, Threshold, Interval, Repetition
- Lap conversions shown for 200m, 300m, 330m, 400m, 1000m
- HR estimation methods:
  - Percent of max HR
  - Karvonen (HR reserve)
  - LTHR-based

## Plan Generator Rules (MVP)

- Week 1 starts at 90-100% of current weekly km (default 95%)
- Weekly progression is conservative (roughly 5-7%)
- Deload and taper logic included
- Supports 4, 8, 12, and 16 week durations
- Weekly km never exceeds `weekly_km_max_tolerated`
- Run-day templates:
  - 3 days: one quality, one easy, one long run
  - 4+ days: max 2 key sessions + long run + easy/recovery
- Missed workout and fatigue fallback guidance included per week/workout
- Workout edits, done/skip status, and "actual workout" logging supported
- Refresh button regenerates a conservative plan from completion/skip feedback

## Validation and Error Handling

- Zod validation for performance, profile, and goal forms
- Time parsing supports `mm:ss` and `hh:mm:ss`
- Distance/time ranges are guarded for unrealistic inputs
- Surface and effort are enum constrained

## Testing

Test coverage includes:

- VDOT sample correctness
- VDOT monotonic behavior
- Prediction round-trip consistency
- Pace zone sanity checks
- HR method outputs
- Plan generator constraints (hard session count, days/week, max volume, taper reduction)

## Disclaimers

- This tool provides training guidance, not medical advice.
- HR zones are estimates and vary with conditions.
- Trail/non-all-out efforts reduce prediction confidence.
- Easy runs should prioritize effort and consistency over exact pace.

## MVP Persistence Scope

- MVP runs in single local-user mode without auth.
- UI stores profile/baseline/goal/plan in browser localStorage.
- Prisma schema is included for persistence evolution and backend integration.

## Known Limitations

- No authentication/multi-user support
- No backend API persistence wired yet (schema present, UI uses local storage)
- Direct Strava OAuth in static hosting has security and CORS constraints
- No adaptive day-by-day feedback loop yet

## Suggested V2

- Persistent server storage for plans and historical baselines
- Adaptive replanning from missed workouts and fatigue signals
- Printable/exportable plan and workouts
- Better weather/elevation correction models
- Calendar sync and notifications
