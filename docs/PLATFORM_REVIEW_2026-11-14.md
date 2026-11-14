# SolarSense Platform: Review

**Date:** 14 November 2026
**Reviewed:** branch `ui_enhancments` at `a05e51c` (Next.js 15, React 19, Tailwind 4, three.js, MapLibre, GSAP, Lenis)
**How:** read the styles, layout, navigation, prediction and weather providers, API routes and domain types in full; outlined the larger pages; ran the dev server and looked at `/`, `/twin`, `/regions`, `/app`, `/app/models`, `/about` and a missing route at a 1,100 px wide window; ran `tsc --noEmit`.
**Not done:** `next build` (the dev server was using `.next`), a line-by-line read of the two 75–80 KB page files, a phone-size pass, and any test of the Arabic layout.

## Summary

The site is well built visually and already further along than the prototypes: the cinematic day-arc landing, the 3D twin with typeset equations, a globe location picker, and a consistent dark design system with real attention to contrast and focus states. The type check is clean.

The main problem is not visual. Several pages present **invented numbers as verified results**. That has to be fixed before anyone outside the team sees it. The second problem is repository hygiene in the outer folder.

## Findings

### Must fix

| # | Finding | Where | Why it matters |
|---|---|---|---|
| 1 | **Fabricated results are labelled "verified".** The model benchmark table (MAE, RMSE, skill scores, Diebold–Mariano p-values) is hand-written data. The Operate page is badged "VERIFIED ERA5 REPLAY (2026 HELD-OUT TEST)". No model has been trained or evaluated. | `src/domain/benchmarkData.ts`, `src/app/app/models/page.tsx:47`, `src/app/app/page.tsx:105`, `src/app/about/page.tsx`, `src/domain/agent.ts:141` | In a graduation project this reads as reporting results that do not exist. An examiner who asks where a number came from has no answer. |
| 2 | **Mock forecasts carry a real-sounding model name.** The physics stand-in returns `modelName: 'XGBoost + PGNN Constrained Ensemble'`, `modelVersion: 'v1.4-era5-egypt'` while `source` is `'mock'`. | `src/domain/providers/predictionProvider.ts:128-130` | The UI shows the model name, not the source flag. |
| 3 | **Fallback weather is silent.** If Open-Meteo fails, hard-coded values come back under the provider name `era5-replay-fallback`. Dust (`dustAod`) is a constant per region in both paths, shown as if measured. Clear-sky radiation is always computed for day 135 at noon, whatever the real time. | `src/domain/providers/weatherProvider.ts` | Values on screen can be invented with no visible sign. |
| 4 | **The outer `GP` folder is a second git repository with 17,125 files staged and no `.gitignore`**: 16,835 from `node_modules`, the `.next` build cache, the 940 MB ERA5 archive and the stock footage. The platform has its own repository inside it. | `C:\Users\Yousef\Desktop\College\GP\.git` | One commit there would capture about 2 GB, including footage the Pexels licence does not allow redistributing. Nothing is committed yet. |

### Should fix

| # | Finding | Where |
|---|---|---|
| 5 | **Navigation was clipped between 1,024 and about 1,300 px**: nine labelled links pushed the language button off the right edge. *Fixed in this pass.* | `src/components/Navbar.tsx` |
| 6 | **Every scrollbar was hidden with `!important`**, on a landing page 19,000 px tall. *Fixed in this pass.* | `src/app/globals.css` |
| 7 | **Missing routes showed the default black 404**, and there was no error screen. *Fixed in this pass.* | `src/app/not-found.tsx`, `src/app/error.tsx` |
| 8 | **Headlines read as feature lists**, for example "True astronomical sun path, 3D component models & typeset governing equations", and eyebrows are packed with jargon. *Twin page fixed in this pass; the others are due for removal.* | page headers |
| 9 | "Live telemetry" on the twin described simulated values. *Fixed in this pass.* | `src/app/twin/page.tsx` |
| 10 | **No input validation on API routes.** `lat`, `lon`, `kWp` are passed through `Number()` unchecked, and `sky` is cast to the union type without a check. | `src/app/api/predict/route.ts`, `weather/route.ts` |
| 11 | **Dead database layer.** A 13 KB Prisma schema exists, but Prisma is not a dependency and nothing imports it. | `prisma/schema.prisma` |
| 12 | **Lint is off and there are no tests.** `eslint.ignoreDuringBuilds: true`, no lint script, no test runner. | `next.config.mjs`, `package.json` |
| 13 | **136 files of an agent design skill are committed inside the app repository**, plus the old HTML globe prototype in `public/`. | `.agents/`, `public/location_globe_prototype.html` |
| 14 | **Two page files are 75–80 KB each** (about 2,000 lines), mixing 3D scene code, equations, state and layout. Hard to review and to change safely. | `src/app/page.tsx`, `src/app/twin/page.tsx` |
| 15 | Fonts load from a render-blocking Google Fonts `<link>`; `next/font` would self-host them and remove the layout shift. | `src/app/layout.tsx` |
| 16 | The mobile tab bar holds nine items and scrolls sideways at phone width. | `src/components/Navbar.tsx` |

### Working well

- A real token system in `globals.css` with documented contrast ratios, focus rings, reduced-transparency and increased-contrast modes.
- Domain logic (`physics`, `panels`, `regions`, providers) is framework-free TypeScript behind provider interfaces, so the prediction source can be swapped without touching pages.
- The privacy rule from the prototype survived: only the snapped 0.25° grid cell is sent to the weather service.
- English and Arabic strings exist side by side throughout.

## Changes made in this pass

All on `ui_enhancments`, uncommitted. `tsc --noEmit` passes; each was checked in the browser at 1,103 px.

| File | Change |
|---|---|
| `src/components/Navbar.tsx` | Below 1,440 px only the current page keeps its text label; the rest show icons with a tooltip and an accessible name. The clock hides on very small screens. Measured before: controls ended at 1,120 px in a 1,103 px window. After: 1,069 px. |
| `src/app/globals.css` | Replaced the global scrollbar removal with a slim themed scrollbar, plus a `.no-scrollbar` opt-out used by the mobile tab bar. Added a site-wide reduced-motion rule. |
| `src/app/layout.tsx` | Plain-language title and description, a title template for inner pages, theme colour, and body colours taken from the tokens. |
| `src/app/not-found.tsx` | New branded 404 page. |
| `src/app/error.tsx` | New error screen with a retry button. |
| `src/app/twin/page.tsx` | New headline and one-sentence explanation stating that every figure is computed, not measured; "Live twin telemetry" became "Simulated values & equations". Arabic strings updated to match. |

Findings 1–3 were **not** fixed here, because the pages involved are removed in the `doc_representation_modifications` plan. If the full version is ever shown again, fix them first.
