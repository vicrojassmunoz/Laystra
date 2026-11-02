# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users
Currently one person: the developer, on their own iPhone (Expo/EAS, no Mac). Two situations matter:
- **At the gym, between sets:** quick, often one-handed taps, glanceable numbers, a phone that may be sweaty or held awkwardly. Logging a set must cost seconds.
- **At home / during the day:** checking what is due today, progress per exercise, personal records, water intake, body metrics and goals.

Built for one user first, but nothing should make sharing it with a few friends painful later (no hard-coded personal assumptions in structure, copy tone stays friendly rather than private-journal).

## Product Purpose
A personal physical-progress tracker: predefined routines assigned to weekdays, a session you start and stop to log the day's training in a few taps, and progress that is visible over weeks. Success is that logging never gets in the way of training and the numbers (volume, PRs, water, body weight) are trustworthy and easy to read back.

## Positioning
Not just a workout logger: a single **daily health view** where training, water, body metrics and (planned) steps live together. Backend is self-hosted by the owner (FastAPI + SQLite behind a Cloudflare Tunnel), so the data stays theirs. No accounts, no cloud service.

## Operating Context
- Language of the UI is **Spanish**; copy is informal and short ("Ey, ¿sigues por aquí?").
- Days are organised around **Home** (hub with a 7-day status strip) → **Hoy** (summary of the day, start/resume the session) → **Sesión** (the logging form with session timer, pause, rest timer, next-exercise hint, tips).
- A running session shows a floating pill with its timer on every other screen; a local notification fires after 1 h without new input.
- Weights use per-exercise units (kg, lb, or body weight "PC"); super-sets group several exercises into rounds.
- Dev loop: Expo Go on the owner's iPhone against the local backend; production is an ad-hoc EAS build against the public domain.

## Capabilities and Constraints
Delivered: routines and weekly schedule, Hoy summary, Sesión (timer, pause, notes "Sensaciones", super-sets, free workouts), history with editing and CSV export, per-exercise progress, PR badges (max weight and best-set volume, best set per exercise per session), goals, body metrics, analytics (tonnage, days since last training per muscle group), water tracking (containers, adjustable amounts, goal, history, CSV).

Constraints: Expo SDK 58 (must match the Expo Go on the phone), React Native 0.88, React 19; no heavy state libraries or exotic architecture; iOS only; single user, no auth; most data entry is numeric and must stay fast. Planned but undecided: HealthKit steps (needs an EAS build), rest-timer alarm.

## Brand Commitments
Name: **Laystra**. The owner wants a **clean look** (stated 2026-11-02, the day of the first design pass). No logo or palette is committed yet; the current UI uses plain default controls and grey cards and is the thing being replaced, not preserved.

## Evidence on Hand
Real data exists in the owner's database (real routines, 24+ exercises, logged workouts). There are no testimonials, customers or press, and none should be invented. App icon and splash live in `mobile/assets/`.

## Product Principles
1. **Speed at the point of use.** Anything done between sets (typing weight/reps, adding water, seeing the next exercise) is optimised before anything decorative.
2. **One daily picture.** Training, water and body data belong together; no screen should feel like a separate app.
3. **Numbers you can trust.** Units, PRs, volume and timers are shown consistently and never silently reinterpreted.
4. **Quiet by default, loud only when it matters.** Records, goals reached and "your session is still running" earn emphasis; everything else stays calm.
5. **Feels native to the iPhone.** Follow iOS conventions for navigation, touch targets, typography and motion.

## Accessibility & Inclusion
No product-specific requirement established. Defaults that matter here: large touch targets for one-handed gym use, readable numerals at a glance, respect Reduce Motion for any added animation.
