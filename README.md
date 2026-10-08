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
