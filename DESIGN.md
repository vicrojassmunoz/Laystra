# Design — Laystra "Native Calm"

Visual world for Laystra (iOS, Operate mode). Product truth lives in [PRODUCT.md](PRODUCT.md). Decided 2026-11-02 with the owner: **Native Calm**, light + dark following the system.

## Intent
A well-made iPhone app that disappears into the task: scan numbers between sets, add water in one tap, start/stop a session. Quiet by default; emphasis only for the running session, records (PR), goals reached and destructive actions.

## Rules
- **Native first.** Native stack header with large titles on top-level screens, grouped inset lists, SF Symbols, system text styles, 44 pt targets, edge-swipe back untouched.
- **One tint.** Teal (`#0B7F73` light / `#3FD0BF` dark) drives everything interactive. Other colors carry meaning only: success (running / done), warning (paused / adjusted), danger (destructive), water (blue, water progress), gold (PR).
- **One elevation.** Cards are `surface` on `bg`; no shadow, no border. Never nest cards. Only the floating session pill has a shadow.
- **Type:** iOS text styles via `Txt` (`largeTitle` … `caption`), system font (San Francisco), tabular numerals for clocks and totals. No hard-coded sizes in new code.
- **Motion** (not yet implemented): state feedback only, 150–250 ms, respect Reduce Motion.
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

## Verification
No Simulator. Layout/color/type are checked in the Expo Web preview (390×844 @2×, light and dark) with a headless Helium driven by `playwright-core`; the iPhone via Expo Go is the final check (fonts, native header/large titles, safe areas and haptics differ from web).
