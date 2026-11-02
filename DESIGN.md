# Design — Laystra "Native Calm"

Visual world for Laystra (iOS, Operate mode). Product truth lives in [PRODUCT.md](PRODUCT.md). Decided 2026-11-02 with the owner: **Native Calm**, light + dark following the system.

## Intent
A well-made iPhone app that disappears into the task: scan numbers between sets, add water in one tap, start/stop a session. Quiet by default; emphasis only for the running session, records (PR), goals reached and destructive actions.

## Rules
- **Native first.** Native stack header with large titles on top-level screens, grouped inset lists, SF Symbols, system text styles, 44 pt targets, edge-swipe back untouched.
- **One tint.** Teal (`#0B7F73` light / `#3FD0BF` dark) drives everything interactive. Other colors carry meaning only: success (running / done), warning (paused / adjusted), danger (destructive), water (blue, water progress), gold (PR).
- **One elevation.** Cards are `surface` on `bg`; no shadow, no border. Never nest cards. Only the floating session pill has a shadow.
- **Type:** iOS text styles via `Txt` (`largeTitle` … `caption`), system font (San Francisco), tabular numerals for clocks and totals. No hard-coded sizes in new code.
- **Motion** (implemented 2026-11-02 with Emil Kowalski's `animate-expo` rules): state feedback only, never decoration. Reanimated 4 on the UI thread, curve `cubic-bezier(0.23, 1, 0.32, 1)`, no ease-in. Respect Reduce Motion. See *Motion* below.
- **Copy:** Spanish, short, names the action ("Empezar sesión", "Añadir").

## Tokens (`mobile/src/theme/theme.ts`)
Semantic colors (`bg`, `surface`, `surfaceInset`, `label`, `labelSecondary`, `labelTertiary`, `separator`, `fill`, `tint`, `onTint`, `tintSoft`, `success`, `danger`, `warning`, `water`, `gold` + `*Soft`), spacing `xs 4 … xxxl 32`, radius `control 10 / card 12`, `TOUCH = 44`. Use `makeStyles((theme) => ({...}))` and `useTheme()`; never raw hex in migrated screens.

## Components (`mobile/src/components/ui/`)
`Txt`, `Screen` (+ `ScreenLoading` / `ScreenError`), `Card`, `Section`, `SectionHeader`, `Row`, `Button` (`filled` = the one primary action per screen, `tinted`, `plain`, `destructive`, `plainDestructive`, `iconOnly`), `Chip`, `TextField`, `ProgressBar`, `Icon` (SF Symbols on iOS, Ionicons stand-in on web). Domain pieces built on them: `SetRow`, `SupersetBlock`, `PrBadge`, `WeightUnitChips`, `SessionBar`, `SessionPill`.

## Migration status
- **All screens redesigned:** Home, Hoy, Sesión, Agua, Perfil, Historial, Rutinas, Progreso, Análisis, Semana, Objetivos, the exercise picker's form, and the navigation shell.
- **Leftover:** the *option rows and bottom sheets* of the exercise pickers inside Sesión / Rutinas / Historial still use the old themed styles (`components/ui/compat`, hand-written sheet styles). They work in light and dark but could share one `Sheet` + `PickerOption` component.
- `app.json` is `userInterfaceStyle: "automatic"`; the user can override in Perfil → Apariencia (Sistema / Claro / Oscuro, stored with AsyncStorage and applied with `Appearance.setColorScheme`).
- **Titles are inline** in the native header (centered, next to the back arrow) -- no large titles, to save vertical space.

## Motion
Frequency gate first: what a user does dozens of times a day gets near-invisible feedback or nothing.
- **Press feedback** (`PressableScale`, used by `Button`, `Chip`, tappable cards, the session pill): scale 0.97 + opacity 0.8 in 120 ms on press-in, released on press-out. Reduce Motion drops the scale.
- **Progress bars** (`ProgressBar`): width and color transition 380 ms when the value changes (water added, goal reached).
- **Session pill:** fade in 180 ms / out 120 ms. **Session bar:** background color eases 200 ms when paused/resumed.
- **Expanded details** (Hoy, Historial, Rutinas): content fades in 120 ms (`FadeInView`); height is NOT animated.
- **Haptics** (`motion/motion.ts`, one per action, never the only feedback): `tick` on changing a chip option, `light` on adding water / starting or pausing a session, `medium` on ending a session, `success` on saving a workout or completing a goal.
- **Deliberately not animated:** tab/screen transitions (native stack), list entrances, scroll effects, bottom sheets (native Modal slide).
- Feel (haptic timing, press scale) must be judged on a **real device in a release build**, not Expo Go / web.

## Verification
No Simulator. Layout/color/type are checked in the Expo Web preview (390×844 @2×, light and dark) with a headless Helium driven by `playwright-core`; the iPhone via Expo Go is the final check (fonts, native header/large titles, safe areas and haptics differ from web).
