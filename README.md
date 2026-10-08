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
