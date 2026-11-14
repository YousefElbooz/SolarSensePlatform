# Branch plan: `doc_representation_modifications`

**Written:** 14 November 2026
**Base:** `ui_enhancments` (after the UI fixes listed in `PLATFORM_REVIEW_2026-11-14.md` are committed)
**Owner:** Yosef
**Source:** team decision in the group chat, 14 Nov 2026 (Mahmoud Hossam), summarised in section 1

---

## 1. What the team decided

Translated and condensed from the chat:

1. Stop spreading effort across the whole website for now.
2. **Keep a copy of the website as it is today and set it aside.**
3. Reduce the working version to **two things only**: the **simulation** (digital twin) and a **test page for the prediction model**. Remove everything else.
4. **Keep the images, videos and motion.** They are liked.
5. Mahmoud will send the dataset's feature list (received, section 5) and the **regions with their numbers** (not received yet).

The site will then contain:

- **A.** The digital twin simulation.
- **B.** A form to enter the AI model's input **by hand**: location (saved regions only), hour, weather.
- **C.** A form that **picks the location on a map**, chooses the hour from a dropdown, and **gets the weather from an API** or lets the user type it. The API needs a date, which may be in the future.

## 2. Scope

| | In this branch | Not in this branch |
|---|---|---|
| Keep | Cinematic landing (film, scroll motion, 3D panel), digital twin, globe location picker, design system, English/Arabic | |
| Add | `/predict` page with two input modes, a 23-feature weather contract, a point-prediction API, region config from the ML team | Training or changing the model itself; pvlib work |
| Remove | Planner and business case, report, regions atlas page, panels page, Operate dashboard, site pages, model benchmark, AI assistant, login/register, scheduler, Prisma schema | |

**Definition of done:** the site has three destinations (`/`, `/twin`, `/predict`); a visitor can produce a prediction by typing weather or by picking a place and date; every number on screen is labelled with where it came from; `npm run typecheck` and `npm run build` pass; the removed routes redirect instead of 404.

## 3. Step 0: set the current site aside

Do this before any deletion. A tag is a permanent, named copy; the old branches stay untouched as well.

```bash
git checkout ui_enhancments
git add -A && git commit -m "fix(ui): responsive nav, visible scrollbar, 404 and error pages, plain twin headline"
git tag -a v1-full-platform -m "Full Plan + Operate platform before the doc_representation_modifications cut"
git push origin ui_enhancments v1-full-platform
git checkout -b doc_representation_modifications
git push -u origin doc_representation_modifications
```

To see the old site again later: `git checkout v1-full-platform`.

Also fix the outer `GP` folder before committing anything there (review finding 4): add a `.gitignore` covering `SolarSensePlatform/`, `archive/`, `design/footage/`, `node_modules/`, `.next/`, then `git rm -r --cached .` and `git add .` again.

## 4. Target site

### 4.1 Routes

| Route | Purpose | Built from |
|---|---|---|
| `/` | Short cinematic introduction that leads to the two tools | Existing landing, trimmed (4.2) |
| `/twin` | Digital twin simulation | Existing page, small changes (section 8) |
| `/predict` | Prediction test: **Manual** tab and **Map + weather** tab | New (section 6) |

Navigation shrinks from nine items to three: **Intro**, **Digital twin**, **Prediction test**. With three items every label fits at every width, and the phone tab bar no longer scrolls.

### 4.2 Landing page: what stays

The landing is eleven scroll chapters. Keep the ones that are film and motion; drop the ones that are a sizing tool.

| Chapter | Decision | Note |
|---|---|---|
| `dawn` (hero) | Keep | New headline and two buttons: "Open the digital twin", "Test a prediction" |
| `dunes` | Keep | |
| `why` (dust, heat, four skies) | Keep | This is the argument for the model |
| `panel` (3D panel) | Keep as a showcase | Remove price and sizing copy; keep the three technologies and the 3D viewer |
| `where` (globe) | Keep, repoint | Button opens `/predict?mode=map` instead of feeding the planner |
| `noon` ("what the model sees") | Keep, rewrite | Show the 23 model inputs grouped by kind, live for a default region |
| `space` (roof and budget) | **Remove** | Business planning |
| `predict` (day curve) | **Remove** | Replaced by the real test page |
| `business` | **Remove** | Business planning |
| `dusk` | Keep | |
| `night` | Keep, rewrite | Ends on the two tool buttons instead of the enhancer list |

### 4.3 Files to remove

| Path | Reason |
|---|---|
| `src/app/panels/`, `src/app/regions/`, `src/app/report/`, `src/app/about/` | Out of scope |
| `src/app/app/` (dashboard, `sites/[id]`, `models`, `assistant`) | Out of scope; also holds the invented benchmark figures |
| `src/app/login/`, `src/app/register/` | No accounts in this version |
| `src/app/api/assessments/`, `api/assistant/`, `api/schedule/` | Their pages are gone |
| `src/domain/business.ts`, `agent.ts`, `scheduler.ts`, `benchmarkData.ts` | Only used by removed pages |
| `prisma/` | Never wired in |
| `public/location_globe_prototype.html` | Superseded by `GlobeLocationModal` |
| `RooftopThreeViewer` in `SolarThreeViewers.tsx` | Only used by the removed `space` chapter. Keep `PanelThreeViewer` |
| Unused types in `src/domain/types.ts` | Assessment, enhancer, schedule, benchmark, assistant types |

After each deletion run `npm run typecheck`; the compiler lists every import that still points at a removed file.

Add redirects in `next.config.mjs` so old links do not 404:
`/panels`, `/regions`, `/report/:path*`, `/app/:path*`, `/about`, `/login`, `/register` → `/`.

## 5. The model's input: 23 weather features

This is the list Mahmoud sent. It is the contract between the form, the weather API and the model.

**Status key:** **API** = supplied by Open-Meteo. **Calc** = computed in the browser from date, hour and position. **Default** = no live source; filled from a table and shown as a default.

| # | ERA5 name | Short | Dataset unit | Form unit | Live source (Open-Meteo `hourly`) | Status |
|---|---|---|---|---|---|---|
| 1 | `2m_temperature` | t2m | K | °C | `temperature_2m` + 273.15 | API |
| 2 | `10m_u_component_of_wind` | u10 | m/s | speed + direction | `wind_speed_10m`, `wind_direction_10m`: u = −s·sin(d) | API |
| 3 | `2m_dewpoint_temperature` | d2m | K | °C | `dew_point_2m` + 273.15 | API |
| 4 | `10m_v_component_of_wind` | v10 | m/s | speed + direction | v = −s·cos(d) | API |
| 5 | `total_cloud_cover` | tcc | 0–1 | % | `cloud_cover` ÷ 100 | API |
| 6 | `low_cloud_cover` | lcc | 0–1 | % | `cloud_cover_low` ÷ 100 | API |
| 7 | `medium_cloud_cover` | mcc | 0–1 | % | `cloud_cover_mid` ÷ 100 | API |
| 8 | `high_cloud_cover` | hcc | 0–1 | % | `cloud_cover_high` ÷ 100 | API |
| 9 | `surface_pressure` | sp | Pa | hPa | `surface_pressure` × 100 | API |
| 10 | `total_column_water_vapour` | tcwv | kg/m² | kg/m² | `total_column_integrated_water_vapour` | API |
| 11 | `surface_solar_radiation_downwards` | ssrd | J/m² per hour | W/m² | `shortwave_radiation` × 3600 | API |
| 12 | `total_sky_direct_solar_radiation_at_surface` | fdir | J/m² per hour | W/m² | `direct_radiation` × 3600 | API |
| 13 | `surface_solar_radiation_downward_clear_sky` | ssrdc | J/m² per hour | W/m² | none (`shortwave_radiation_clear_sky` is accepted but returns null) | Calc, from the clear-sky model in `physics.ts` |
| 14 | `total_precipitation` | tp | m | mm | `precipitation` ÷ 1000 | API |
| 15 | `boundary_layer_height` | blh | m | m | `boundary_layer_height` | API |
| 16 | `10m_wind_gust_since_previous_post_processing` | i10fg | m/s | m/s | `wind_gusts_10m` | API |
| 17 | `surface_thermal_radiation_downwards` | strd | J/m² per hour | W/m² | none | Default |
| 18 | `surface_net_solar_radiation` | ssr | J/m² per hour | W/m² | none; ssrd × (1 − albedo) with a regional albedo | Default (derived) |
| 19 | `surface_net_thermal_radiation` | str | J/m² per hour | W/m² | none | Default |
| 20 | `total_column_ozone` | tco3 | kg/m² | Dobson units | none (`ozone` returns null) | Default |
| 21 | `total_column_cloud_ice_water` | tciw | kg/m² | kg/m² | none | Default |
| 22 | `total_column_cloud_liquid_water` | tclw | kg/m² | kg/m² | none | Default |
| 23 | `toa_incident_solar_radiation` | tisr | J/m² per hour | W/m² | `terrestrial_radiation` × 3600 | API (or Calc) |

**Totals: 16 from the API, 1 computed, 6 with no live source.**

Checked on 14 Nov 2026 with a request for Cairo: all sixteen API variables returned 384 non-null hourly values (16 days ahead) with `wind_speed_unit=ms`. A request to the archive endpoint for 1 Oct 2026 also returned values.

Conventions to keep the numbers honest:

- **Request wind in m/s** (`wind_speed_unit=ms`); the default is km/h.
- **Radiation timing matches.** ERA5 radiation is accumulated over the hour *ending* at the timestamp; Open-Meteo radiation is the average over the *preceding* hour. Multiply W/m² by 3,600 to get J/m². Other variables are instantaneous at the timestamp.
- **Send the dataset's units to the model, show friendly units in the form.** One module, `src/domain/features.ts`, owns the list, the units, the valid ranges and both conversions. Nothing else converts.

### 5.1 Where the six defaults come from

Recommended: the ML team exports one small file from the training data, **the mean of each feature per region, month and hour**, as `public/data/feature_defaults.json`. The form fills the six fields from it, marks them "dataset average", and the user can overwrite them. This keeps defaults inside the range the model was trained on, which invented constants would not.

Until that file exists, the six fields are required manual inputs with a neutral placeholder and a visible note.

### 5.2 Mismatch to resolve first

The ERA5 files in the local `archive/` folder do **not** match this list:

- In the list but **not in the archive**: `lcc`, `mcc`, `hcc`, `i10fg`, `strd`, `ssr`, `str`, `tco3`.
- In the archive but **not in the list**: `cdir`, `skt`, `cbh`, `fal`.

So either the model is trained on a newer download than the one in this folder, or the list is the intended set and the data still has to be fetched. **Ask Mahmoud which is true before building the form**, because it decides the 23 fields.

## 6. The prediction test page (`/predict`)

One page, two tabs, one shared result panel. Both tabs end in the same request.

### 6.1 Shared inputs

| Input | Control | Rule |
|---|---|---|
| **Region** | Dropdown of saved regions | Only regions from the ML team's list (section 7). No free coordinates |
| **Date** | Date picker | Needed for the weather API and for the computed features. Range: 1 Jan 2020 to today + 15 days |
| **Hour** | Dropdown | Only the 16 hours in the dataset: 02:00–17:00 UTC. Show Cairo local time (UTC+2, or UTC+3 during daylight saving) next to the UTC value; send UTC |
| **Panel technology** | Three-way switch | Only if the model's output depends on it (question Q3) |

### 6.2 Tab A: manual entry

For someone who wants to type every input and see what the model does with it.

- The 23 fields in six groups: **Temperature and humidity** (t2m, d2m, tcwv), **Wind** (speed, direction, gust), **Cloud** (total, low, medium, high, ice water, liquid water), **Solar radiation** (ssrd, fdir, ssrdc, ssr, tisr), **Thermal radiation and atmosphere** (strd, str, sp, blh, tco3), **Precipitation** (tp).
- Wind is entered as speed and direction; the page shows the resulting u and v.
- Each field has a unit, a valid range, and an inline error that names the range.
- Cross-field checks, as warnings rather than blocks: direct ≤ total radiation; total ≤ clear-sky; low, medium and high cloud not above total by more than rounding; dew point ≤ temperature.
- **Presets** to fill the form in one click: clear summer noon, spring dust day, winter coastal cloud, cool clear morning. These are for demonstration and are labelled as presets.
- "Reset to dataset average" for the chosen region, month and hour, once 5.1 exists.

### 6.3 Tab B: map + weather

For someone who wants a realistic input without typing it.

1. **Pick a place.** Reuse `GlobeLocationModal`. A click or a detected position snaps to the nearest saved region; a point outside every region is refused with a message naming the closest one. A region dropdown sits beside the map for people who prefer it, and the two stay in sync.
2. **Pick a date and hour** (6.1).
3. **Get weather.** One button calls `/api/weather`. The form from Tab A appears filled in.
4. **Every field shows where its value came from**, as a small badge: **API**, **Calculated**, **Dataset average** or **Edited**. Editing a field flips its badge to Edited.
5. The user can change any value, then run the prediction.

Which weather endpoint the server uses:

| Chosen date | Endpoint | Label on the page |
|---|---|---|
| Today to today + 15 | Open-Meteo forecast | "Forecast weather" |
| Recent past (Open-Meteo documents up to 92 days; not tested here) | Open-Meteo forecast with `past_days` | "Recent weather" |
| Older, back to 2020 | Open-Meteo archive | "Historical weather (reanalysis)" |

If the weather request fails, **say so and leave the fields empty** for manual entry. Do not fill in plausible values silently; that is review finding 3.

### 6.4 Result panel

- The predicted value, large, with its unit.
- A source badge: **Model** (with the version the Python service reports) or **Physics stand-in** when the service is not connected. Never a model name on a stand-in result.
- A physics reference beside it: clear-sky power for the same hour and place from `physics.ts`, so the viewer can see whether the prediction is plausible.
- Any warnings from validation or from the service.
- A collapsible "Request and response" block showing the exact JSON sent and received. This is what the team will point at in the seminar.
- A button, **Open this hour in the digital twin**, carrying region, date, hour and the weather values that the twin uses.

## 7. Regions

Location is limited to saved regions. Mahmoud is sending the regions "with their numbers"; until then the code has the four climate regions and eighteen anchor points from the earlier work, with hand-drawn borders marked provisional.

When the list arrives, put it in **one file**, `src/domain/regions.config.ts`, and have the dropdown, the map overlay, the snapping rule and the API validation all read from it. Each entry needs:

| Field | Example | Used for |
|---|---|---|
| `id` | the number the model was trained with | Sent to the model |
| `nameEn`, `nameAr` | Nile Valley & Upper Egypt | Dropdown and map label |
| Geometry | a point, a list of ERA5 cells, or a lat/lon box | Map overlay and snapping |
| Representative point | 24.50° N, 32.75° E | The coordinates sent to the weather API |

Replace the placeholder borders in `src/domain/regions.ts` rather than keeping two definitions.

## 8. Digital twin changes

Small, because the page already works.

1. Read `region`, `date`, `hour` and weather values from the URL, so the "Open in twin" button from `/predict` lands on the same moment.
2. Use the region list from section 7 in the site dropdown.
3. Keep the wording fixed in the UI pass: simulated, not live.
4. Optional, if time allows: split the 2,000-line file into the 3D scene, the equation panels and the controls. No behaviour change.

## 9. API

### `GET /api/weather?region=<id>&date=YYYY-MM-DD&hour=<0-23 UTC>`

Returns the 23 features in **dataset units** plus, for each, its provenance.

```json
{
  "region": "…",
  "datetimeUtc": "2026-11-20T10:00:00Z",
  "endpoint": "forecast",
  "features": { "t2m": 299.35, "u10": -0.88, "…": 0 },
  "provenance": { "t2m": "api", "ssrdc": "calculated", "tco3": "default", "…": "api" },
  "missing": []
}
```

### `POST /api/predict`

```json
{
  "region": "…",
  "datetimeUtc": "2026-11-20T10:00:00Z",
  "panelTech": "pc-Si",
  "features": { "t2m": 299.35, "…": 0 }
}
```

Response:

```json
{
  "prediction": { "value": 0.0, "unit": "…" },
  "source": "model",
  "modelVersion": "…",
  "physicsReference": { "pClearKw": 0.0 },
  "warnings": []
}
```

Rules for both routes:

- **Validate every input on the server** with one schema generated from `features.ts`: required fields present, numbers finite and in range, region in the saved list, hour within 02–17 UTC. Reject with a 400 that names the field.
- The Next.js route forwards to the Python service at `PYTHON_ML_SERVICE_URL`. If the variable is unset or the service fails, return the physics stand-in with `"source": "stand-in"` and a warning. The page shows that state plainly.
- The existing `GET /api/predict` returns a whole-day forecast for the planner. Replace it; nothing kept uses it.
- Update `docs/PYTHON_ML_SERVER_INTEGRATION.md` to the new point-prediction contract.

## 10. Questions for the ML team

The page cannot be finished without these. Send them with the feature mismatch in 5.2.

| # | Question | Why it blocks |
|---|---|---|
| Q1 | What exactly does the model output: power in kW for a reference system, power per kWp, a clear-sky index, or something else? | Unit and label of the result |
| Q2 | Is the output for one hour (the hour entered) or for the next hour? | Wording of the result |
| Q3 | Does the output depend on the panel technology (pc-Si, a-Si:H/sc-Si, CIGS)? Is that an input, or three separate models? | Whether the page has a technology switch |
| Q4 | Which inputs besides the 23 weather features: region id, latitude and longitude, hour, day of year, month? In what encoding? | The request body |
| Q5 | Does it need earlier hours (lag features)? If so, manual single-hour entry cannot work as described. | Feasibility of Tab A |
| Q6 | The exact feature order and whether scaling happens inside the saved model or must be done before calling it. | Correct predictions |
| Q7 | How is it served: a FastAPI service the team runs, or a model file the site loads? | Section 9 |
| Q8 | The regions and their numbers (section 7). | Location input |
| Q9 | Can you export the per-region, per-month, per-hour feature means (5.1)? | The six fields with no live source |

## 11. Work order

Each step is one commit and leaves the site working.

| # | Step | Done when |
|---|---|---|
| 0 | Commit UI fixes, tag `v1-full-platform`, create the branch (section 3) | Tag and branch exist on the remote |
| 1 | Delete the removed routes, API routes and domain files (4.3); add redirects | `npm run typecheck` and `npm run build` pass; old URLs redirect |
| 2 | Cut navigation to three items | Labels fit at 375 px and 1,024 px with no scrolling |
| 3 | Trim the landing page (4.2) | Scrolls dawn to night with no planner chapters; both tool buttons work |
| 4 | Add `src/domain/features.ts`: the 23 features, units, ranges, conversions, with unit tests for the conversions | Round-trip tests pass, including wind speed/direction ↔ u/v |
| 5 | Add `regions.config.ts` (placeholder data until Q8) and point everything at it | One definition of regions in the codebase |
| 6 | Rewrite `/api/weather` (section 9) with the three endpoints and provenance | Returns 23 keys for a future date, a recent date and a 2021 date |
| 7 | Rewrite `/api/predict` as a validated point prediction with a labelled stand-in | Bad input returns a 400 naming the field |
| 8 | Build `/predict`, Tab A | A preset fills the form and returns a result with a source badge |
| 9 | Build `/predict`, Tab B | Picking a region and a future date fills the form with badges; a failed fetch leaves it empty with a message |
| 10 | Twin reads URL parameters; "Open in twin" button | The twin opens on the same region and hour |
| 11 | Connect the real model once Q1–Q7 are answered | The badge reads "Model" with a version |
| 12 | Pass at phone width, keyboard only, Arabic, and reduced motion | Notes in the PR description |

Steps 1–3 need nothing from the ML team. Steps 4–10 can be built against the stand-in. Only step 11 waits for the model.

## 12. Rules for what the page may claim

1. A value is labelled with its source wherever it appears: API, calculated, dataset average, edited, model, stand-in.
2. No benchmark tables, skill scores or "verified" badges until the ML team supplies real evaluation output, with the run that produced it.
3. A stand-in never carries a model name or version.
4. Weather for a future date is called a forecast; for a past date, reanalysis.
5. Only the region's representative point is sent to the weather service, never a user's exact position.

## 13. Risks

| Risk | Effect | Response |
|---|---|---|
| The feature list changes after 5.2 is answered | Form and contract rework | All 23 definitions live in `features.ts`; a change is one file |
| Six features have no live source | Tab B cannot be fully automatic | Dataset averages (5.1), shown as defaults |
| The model needs lag features (Q5) | Single-hour manual entry is invalid | Ask first; if yes, Tab B fetches the preceding hours and Tab A becomes "edit one hour of a fetched day" |
| Forecast weather comes from a different model than ERA5 | Predictions on live weather drift from test accuracy | Say so on the page; compare a past date through the archive endpoint as a sanity check |
| Deleting pages breaks shared imports | Build fails | Delete in small commits with a type check after each |
| The Python service is unreachable during a demo | No prediction | Labelled stand-in, tested on purpose before the seminar |
