# Iron Nest — Firing Solution Calculator

A **mobile-first Angular fire-control companion** for [IRON NEST: Heavy Turret Simulator](https://store.steampowered.com/app/2950790/).

**Public site (after GitHub Pages is enabled):** https://halfe85.github.io/IronNest-Firingsollutioncalculator/

## What it does

- Instant bearing, powder charge and elevation calculation using the community-tested **in-game** equation: `elevation ° = distance (km) × 12 / charges`.
- Works with kilometres or metres and all six charge bands (1–6; 5–30 km).
- Automatic **Low angle**, **Economy** and **Match history** charge-selection modes, plus manual charges.
- All purchasable shell codes documented for October 2026 (shell selection affects the log, not the shared firing equation).
- Optional time-on-target mode using **manually measured** projectile flight time.
- Persistent shot history and mobile-friendly, seven-round **Gun 1 / Gun 2** assignment queues; no login or server.
- Fully responsive, touch-friendly interface with accessible labels, text scaling and a copyable solution.
- Static deployment to GitHub Pages from GitHub Actions.

## Development

Requires Node.js 22.12+ (Angular 21 compatible).

```bash
npm install
npm start
npm run build -- --base-href /IronNest-Firingsollutioncalculator/
npm test
```

`npm test` exercises the pure firing calculations with the Node test runner after compiling the TypeScript test files.

## Publish on GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Run **Actions → Deploy Angular to GitHub Pages → Run workflow** (or push a new commit to `main`).
4. The site will be available at https://halfe85.github.io/IronNest-Firingsollutioncalculator/ once the deployment completes.

The workflow is in `.github/workflows/deploy.yml`. No tokens or additional hosting fees required.

## Verification boundary

This is **game math**, not real-world ballistics. The published relationship is based on player testing and is subject to game updates. Max elevation is 60°, max 6 charges at 30 km. We do not predict flight time because the game does not use this equation to determine it; time-on-target requires a measured time input.

**Sources:** [Steam community formula discussion](https://steamcommunity.com/app/2950790/discussions/0/588434434320143257/), [Reddit mathematics discussion](https://www.reddit.com/r/IronNest/comments/1vjgvbb/math/), [October 2026 shell reference](https://npctips.com/iron-nest/data/shell-types/).

Inspired by [Joe Oakley's unofficial Fire Control Calculator](https://joeoakley52.github.io/UNOFFICIAL-Iron-Nest-FCC/); independent Angular implementation, not a copied site.

Not affiliated with or endorsed by the game's developers.

## Tactical map & triangulation

Open the new **Tactical map** tab for a responsive 20-column (A–T) × 10-row (1–10, bottom to top) in-game map. Every major square is 1 km; coordinates like `N7 9:6` use a 10×10 subdivision (100 m each).

Set the positions of Iron Nest and three spotters, then enter range, bearing, or 16-point compass-direction observations. The app geometrically intersects forward bearing rays and range circles, filters them by compass reports, and shows any surviving target coordinates. If more than one possible target exists, add more evidence or choose a candidate; ambiguity is never hidden.

**Sample input**: Iron Nest `S9 0:5`, Spotter #1 `P7 1:3` reports SSW, Spotter #2 `O8 2:5` reports 6.57 km, Spotter #3 `N7 9:6` reports 187°. Target estimates around `N2 2:0`; bearing from Nest **212.56°**, range **8.89 km**, two charges **53.36°**.

Tap **Use in firing calculator** to transfer target name, Nest-relative bearing and range. Save markers locally; the map and reports remain available after refresh. Drag sideways on narrow phone displays; toggle the 100 m subgrid for close inspection.

**Limitations:** The geometry assumes 1 km cells with sub-digits treated as 100 m point offsets from each cell's bottom-left. Player-map marker placement can introduce ~100 m uncertainty. Values are based on reported distances, bearings and compass sectors; corroborate in the current game before firing. The map is a locally drawn coordinate map, not a copy of the game's terrain artwork.

## Multiple missions & changing orders

Every playthrough can use a different Iron Nest position, spotter positions and target count. In the **Tactical map** tab you can **New run**, add/rename/remove targets, select each target's own evidence, and **Save mission** snapshots locally. Changing targets preserves each target's reports. The map shows candidate markers for every currently calculable target; unresolved targets remain unresolved. A second candidate is **not** silently discarded.

Use **Load artillery example** to try the screenshot example with Iron Nest `I6 5:3` and spotters `I10 5:8`, `M7 1:5`, `L1 7:7`. Its first two bearing pairs produce **no valid forward intersection under our currently provisional axis convention**; the third target (6.21 km from Spotter #3 and 5.77 km from Spotter #1) produces *two* candidate cells, `G5 7:3` and `N7 4:7`. This is intentionally flagged rather than assigned a guessed firing solution.

**Map-axis calibration outstanding:** The in-game map artwork/orientation has not been confirmed. A screenshot of the full grid map with compass labels is required to verify the letter/number axis directions before treating these plot solutions as game-accurate. The calculator's artillery elevation math is separate from map orientation.

## Moving targets: train interception

A new **Train tracker** tab ships with the Valle de Mula mission as an editable example:

- Iron Nest `C3 1:8`; station `J6 0:4`; straight rail bearing `090°`.
- Waypoints at 6 km (`10:06:50`), 4 km (`10:10:10`), and 2 km (`10:13:30`) before station arrival at `10:16:50`.
- Derived train velocity for this sample is **36 km/h**, or 10 metres/second.
- Select a waypoint or a custom **game impact time** to interpolate the train position, bearing and range from Iron Nest. Standard powder/elevation calculation follows.
- Set **which side the train approaches from** (on the listed bearing or opposite): a 090° *rail alignment* does not by itself specify inbound direction.
- Enter separately **measured in-game projectile flight time** to obtain the game-clock fire time. The simulator's elevation equation does not predict projectile flight time. Flight time is never fabricated.
- Editable waypoint distances/times, position coordinates, and persistent local inputs; no external API or backend.
- The grid projection is provisional until the in-game map axes are confirmed. A train calculation is only a prediction under the input timetable, not automatic detection of the actual engine.

## Experimental projectile flight-time model

A fan-made ballistics reference publishes an **experimental** charge-speed model (not official developer data): [Iron Nest Wiki community calculator](https://ironnestwiki.com/calculator), baseline game v1.0, reviewed August 10, 2026.

The estimate is `flightSeconds = distanceKm / (0.7 * (0.3 + 0.7 * (3*u*u - 2*u*u*u)))` where `u = (charges-1)/5`. It does **not** include launch delay, terrain, or confirmed shell-specific variation. A separate [community guide](https://ironnestgame.wiki/guides/flight-time/) recommends using current in-game timings rather than asserting a universally verified formula.

**First user-supplied timing sample (8 October 2026)**: bearing 85.6°, distance 8.94 km, 2 charges, reported elevation 53.34°, launch at :00, impact at :34, **34.0 s observed**. Experimental model predicts **34.26 s**, difference 0.26 s. Elevation model predicts **53.64°**, not the reported 53.34°; both inputs are preserved as a discrepancy. Shell type not reported. One close match is not enough to certify the model. Additional measured shots at varying distances and charges are needed.

Calculator and Train Tracker now display predicted flight time and estimated fire time. A measured flight time always overrides the prediction. Estimated values are clearly labeled and should be verified in-game before precise timed intercepts.

### Additional player flight-time measurements — 8 October 2026

**Measured shot observations are distinct from the game's displayed flight time**, and we deliberately retain timing ranges instead of replacing them with calculated values. All three shell types remain unknown.

| ID | Range | Charge | Reported angle | Community angle | Estimated flight | Game-displayed flight | Fire → impact | Observed elapsed |
|---|---:|---:|---:|---:|---:|---:|---|---|
| F01 | 8.94 km | 2 | 53.34° | 53.64° | 34.26 s | ≈34 s | :00 → :34 | 34 s |
| F02 | 3.70 km | 1 | 45.00° | 44.40° | 17.62 s | 19 s | :00 → :18–:19 | 18–19 s |
| F03 | 7.49 km | 2 | 45.00° | 44.94° | 28.70 s | 28.9 s | :10 → :40–:41 | 30–31 s |

The community model differs from the in-game displayed time by **−1.38 s** for F02 and **−0.20 s** for F03 (model minus display). For F03, observed elapsed time exceeds the in-game displayed flight time by **1.1–2.1 s**. This could involve a launch-to-release delay or observation/clock rounding, but the evidence is currently insufficient to determine the cause. In F02 the observed interval straddles 19 s, while F01 was recorded at whole-second precision.

**Status:** This is a calibration *dataset*, not a new fitted speed formula. Continue comparing samples at constant charge and varying range, and if possible note shell type and both the game's flight-time reading and the stopwatch interval. A future change to the model must be supported by independent observations, not by forced fitting to three rounded measurements.

The raw, typed records live in `src/app/flight-field-data.ts` with regression checks in `src/app/firing.test.ts`.

## Mobile-first compact workstation (October 2026 redesign)

- A full-screen `main-container` has three persistent vertical regions: `top-bar`, scrollable `main-content`, and `bottom-bar`. Tabs stay at the top of the scrolling content. The browser document itself no longer needs to scroll vertically.
- The main Calculate tab shows only compact inputs; the fixed footer shows **charges and elevation**, no giant result card or charge ladder. The former time-on-target controls are removed from this tab.
- The footer **?** opens the About modal containing the community firing formula, source links, and caveats.
- Tactical Plotter is a graph of editable **Nest → Spotters → Reference points → Targets**, including target-to-target references. Coordinates use four dropdowns (letter A–T, number 1–10, subcell X 0–9 and Y 0–9), and additional spotters can be added as needed.
- All report origins can be any *resolved* spotter, reference point, or target. Bearing+range, bearing+bearing and range+range geometric intersections are evaluated, with 0.5° bearing tolerance. When two candidates exist, choose one before dependent points can be resolved. Cyclic references and inconsistent readings are visibly unresolved.
- The Gibraltar screenshot mission is the sample: Nest `A2 2:3`, Spotter #1 `B8 6:1`, Spotter #2 `E4 7:7`, reference `The Mole` from 051° (#2) and 088° (#1), reference `Dockmaster's House` 5.73 km from Mole and 084° from #1, and target `HMS Rockingham` 10 km from Dockmaster and 027° from #2. This is a **graph**, not an assumption that everything is observed directly from a spotter.
- The tactical map is hidden behind a **Map modal**. Target details are shown in a modal and feature a **Fire solution** button only when the coordinate is uniquely resolved or a candidate is explicitly selected.
- Fire Solutions shows saved tiles (two columns at typical mobile widths) with **✓ success** and **× miss** actions. A miss opens a dialog for **signed error in kilometres**: positive = long/overshoot, negative = short/undershoot. Same-charge corrected angle uses `(targetDistance - signedMiss) × 12 / charges` when still reachable, with a Retry action.
- Existing shots from the previous browser storage key are migrated automatically; no cloud account or server is required.
- Existing Train Tracker remains accessible under its own tab. Its previous longer forms scroll **only inside** the central page region.
- The exact map orientation and high-fidelity uncertainty treatment still need in-game calibration; the current renderer is explicitly labelled provisional.

## Fire solution equipment and cannon assignment

Every saved Fire Solution tile displays **bearing, elevation, charges, shell type and cannon**. On phones, at most two tiles appear in a row. The cannon can be switched between **Left** and **Right** directly on the saved tile; this change persists in local browser storage.

The **Calculate** tab has both shell type and cannon selection. In **Tactical Plotter**, each target modal independently stores a shell type and cannon selection. The **Fire solution** button passes those selections to the saved shot, rather than falling back to the Calculate tab's previous shell. The corrected shot's shell and cannon carry over when retrying.

Historical shot records with no recorded cannon remain **UNASSIGNED** until a user explicitly selects Left or Right; the app never fabricates an earlier cannon assignment.

## October 2026: two modes inside Tactical Plotter

The top-level **Train** tab has been consolidated into **Tactical Plotter**, with two mode buttons:

- **Normal Plotting** — triangulate targets and intermediate reference points, manually resolve ambiguous intersections, and reuse solved points as observations.
- **Waypoint Targeting** — an editable moving-target **route builder** with a named reference/arrival point, direction, linear waypoints, game-clock timestamps, optional observed flight time and predicted intercept position. Solved points from Normal Plotting can be imported as route references; Iron Nest grid can be synced too.

When editing observations in a Normal Plotting reference/target dialog, **SHOW MAP MARKERS** expands a live embedded map showing all solved positions, current bearing rays, distance circles and possible locations. **FULL MAP** expands it into a modal and returns to point details when closed.

Route templates: **Iron Road / Valle de Mula** uses current screenshot Iron Nest `C2 5:6`, MainStation `J6 0:4`, and user-supplied 6/4/2/0 km waypoint times. **High Tide** is an unfilled template requiring the current run's coordinates and times; no example landing point or ETA is invented. The user can save multiple routes locally (one train or landing craft per route).

Other relevant operation classes found in the player community: High Tide (several moving landing craft at about 36 km/h southward per player accounts), Final Harvest (moving train plus static targets), Rock of Gibraltar (optional moving cruiser), and Phantom Battery (mobile artillery, but no verified timed route). These support a generic route module without assuming all moving missions are trains.

Caveat: this version handles **straight-line routes with timed distances from a reference**; branched roads, curved paths, multiple legs with individual bearings, target acceleration, and automatically propagating observation uncertainty are not yet modeled. The map axis orientation remains provisional.

### Speed-based waypoint clock generation

For missions such as High Tide where a patrol/landing craft has a known speed but the order names only an arrival ETA, the Waypoint Targeting mode offers **Optional constant speed (km/h)** and **Calculate missing times**.

Given at least one real game-clock timestamp and the route distances, the calculator fills **missing** waypoint times using `arrival - distance/speed`, with midnight wrap. Existing reported clock times are preserved, and if two known times contradict the chosen constant-speed model by more than 2 s, no values are changed. There is **no invented start/arrival clock**. High Tide provides a suggested speed of 36 km/h only as an editable, community-observed value, not a guaranteed value from every run.

Each moving vehicle can be stored independently as a saved route. Its source reference point may be copied from a solved normal-plotting reference or entered manually.

## Manual waypoint / coordinate-aware firing UI (October 2026)

The two Tactical Plotter modes are now selected using one dropdown: **Observation** and **Waypoint**. No scenario templates, mission name, or automatically imported solved-reference dropdown are present. The Waypoint route builder starts with empty time, bearing and grid inputs; users explicitly enter their own mission data. Friendly spotters remain in Observation and can be used for bearings, ranges and reference-point chains, including missions with moving targets. Changing modes preserves each mode's locally saved observations/routes.

**Calculate** requires the player to specify/confirm the Iron Nest position via letter / grid row / subcell X/Y selectors. It projects the specified bearing and distance to an approximate target grid on the 20×10 game map. A saved Fire Solution card displays that target grid, together with bearing, elevation, charges, shell and left/right cannon.

Pressing **X** on a solution card opens a grid correction modal. Two distinct reports are supported:

- **Target position**: the new grid is the real target location (e.g. it was farther away). Calculate the bearing and distance from the original Nest to that grid, retaining powder charge if within range, otherwise selecting minimum sufficient charges.
- **Shell impact**: the new grid is where a previously aimed shell landed. Apply a first-order vector correction to the previous aiming coordinate, using `newAim = oldAim + intendedTarget - observedImpact`. This can correct both overshoot and lateral bearing error but has not yet been calibrated for dispersion.
  
The original intended target coordinates are preserved for repeated impact corrections; revisions are retained locally for audit (up to 30). Historical saved shots that lacked a Nest origin require the player to enter one before receiving a grid correction. A solution that would leave the map or valid game firing range is rejected instead of inventing coordinates.

### Shared Observation / Waypoint coordinate inputs

Waypoint now reuses the **same four-dropdown GridSelect component** already used in Observation for Iron Nest and the route reference / arrival grid: **A–T**, **1–10**, **X 0–9**, **Y 0–9**. The Iron Nest coordinate is inherited from Observation automatically. Editing it in Waypoint emits a change back to the Observation graph; it remains one shared map position across both modes, not two unrelated copies. The route reference remains a manual four-field entry: the removed `Use resolved normal-plot reference` dropdown is not restored. Existing locally saved route reference coordinates are preserved, and a route loaded later uses the current Observation Iron Nest position (rather than silently substituting its historical origin). The route reference stays unset until a dropdown is changed or the explicit A1 0:0 confirmation is used.

This applies to mobile as well: the two coordinate groups stack vertically on narrow screens. Waypoint math still uses the exact same grid parse format `C2 5:6` behind the selector.

## Per-waypoint manual, observed and reference-based grids

Waypoint Targeting now offers four distinct location methods for each non-arrival waypoint:
- **Calculated**: route reference grid + shared bearing / direction + reported route distance (backward compatible).
- **Manual grid**: enter the exact A–T / 1–10 / X / Y location with the shared GridSelect.
- **Observed grid**: enter the grid from an in-game spotter report and its associated game clock time. This is a player-entered observation; it is not an automatically imported Observation-mode point.
- **Relative**: pick the route arrival reference or another waypoint by stable ID, then enter that source's bearing and distance. Cycle / missing reference / off-map detection prevents false firing solutions.

Each waypoint remains on a saved route. For mobile, the waypoint list renders as **compact summaries** of name, grid, time and source method; tapping one expands only that waypoint's inputs. Two-column fields collapse to one column on narrow phones. The map opens in a modal rather than consuming the main scroll region, and draws **individually resolved route segments** and waypoint markers even before all game-clock times have been reported.

Movement prediction interpolates between the positions of neighboring waypoints, allowing bends and updated observations, while preserving the previous straight-line missions' time/distance model. Route distances are still reported route-kilometres used for estimating segment speeds, **not** necessarily Euclidean distance for a curved course. Positions are never extrapolated outside the reported time window. All modes use the game-grid axis convention provisionally until confirmed with an in-game map.

### Per-waypoint direction from reference

Every calculated waypoint now has its own **Bearing from Arrival Reference** and **Direction from Reference** dropdown (along bearing or opposite +180°). Relative waypoints similarly have an independent direction toggle. The former route-wide Direction control was removed from the header. Manual/Observed waypoints do not need a direction because they use exact grid coordinates. Old locally saved routes retain their previous global bearing/direction as defaults until each waypoint is edited, and new routes require bearings entered per waypoint. The straight segments joining resulting positions can turn between waypoints. On mobile, direction and bearing stack inside the single expanded waypoint editor.
