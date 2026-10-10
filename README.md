# Iron Nest FCC

**Iron Nest FCC** is an unofficial, mobile-first firing-solution calculator and tactical plotter for [IRON NEST: Heavy Turret Simulator](https://store.steampowered.com/app/2950790/).

**[Open the calculator](https://halfe85.github.io/IronNest-Firingsollutioncalculator/)** · [Source code](https://github.com/Halfe85/IronNest-Firingsollutioncalculator)

The site runs in your browser. No account, backend, or connection to the game is required.

## Features at a glance

| Workspace | Purpose |
| --- | --- |
| **Calculate** | Calculate a firing solution from Iron Nest's grid, bearing, distance, charge and shell. |
| **Tactical Plotter → Observation** | Locate references and targets using spotter bearings, distances and compass reports. |
| **Tactical Plotter → Waypoint** | Plan moving-target routes using timed waypoints and independently defined positions. |
| **Fire Solutions** | Review shots, assign left/right cannon, mark hits and correct missed shots. |

The compact layout is designed for phones. Longer point editors and maps open in scrollable dialogs rather than requiring a desktop-sized screen.

## Getting started

### Calculate

1. Set and confirm **Iron Nest's grid position**.
2. Enter the target bearing (degrees) and distance (kilometres).
3. Select **Auto** or a manual powder charge, shell type and **Left / Right** cannon.
4. Check the elevation and calculated target grid, then choose **+ Fire Solution**.

A firing card records bearing, elevation, charges, shell, cannon and target grid.

The in-game firing rule currently implemented is:

```text
elevation (degrees) = distance (km) × 12 / charges
```

There are **1–6 charges**, each with a maximum reach of **5 km per charge** (up to **30 km** at six charges). Maximum elevation is **60°**. Shell selection identifies the round on the firing card; it does not change this shared equation.

This is a *community-reported game rule*, not a real-world ballistics calculation.

### Tactical Plotter — Observation

Use the **Observation / Waypoint** dropdown inside Tactical Plotter.

In **Observation**, you can:

- Enter Iron Nest and as many named **spotters** as needed.
- Add **reference points** and **targets**.
- Add reports for each reference or target. Every report has an explicit **FROM** point, a type (**Bearing**, **Range**, or **Compass**) and a value.
- Refer to an earlier located reference or target, not just a spotter.
- View bearing rays, range circles, candidate locations and calculated grids on the map.
- Select a candidate when multiple intersections are possible, and create a firing solution once a target is located.

Closing a point modal or switching tabs preserves the entered reports during the current browser session.

**Conflicting reports remain unresolved.** The solver distinguishes impossible forward bearings, intersections outside the map, ambiguous candidates and missing upstream references. When rounded inputs produce a narrowly acceptable estimated intersection, the display uses **≈** and carries that uncertainty through dependent targets. It never automatically swaps observers or reverses bearings.

### Tactical Plotter — Waypoint

**Waypoint** is intended for moving targets, such as trains or ships. There are no mission-specific templates: enter the information provided in your current playthrough.

1. Confirm Iron Nest's grid. Its position is shared with Observation.
2. Enter the route's **arrival / reference grid**, if available.
3. Add any other named **spotter or reference grids** mentioned in the reports.
4. Add waypoints with their reported distance-to-arrival and game-clock time.
5. Expand a waypoint to choose how its position is obtained:

| Position method | Input |
| --- | --- |
| **Calculated** | Bearing origin, bearing, direction and distance from that origin. |
| **Manual** | Exact four-part grid coordinate. |
| **Observed** | Reported grid coordinate and associated time. |
| **Relative** | Another waypoint or reference point, plus bearing, direction and distance. |

Each waypoint may have a **different bearing origin** (arrival point, named spotter/reference, or another waypoint) and its own **Along / Opposite** direction. Its **geometric distance from an origin** is not the same thing as its **remaining travel distance along the route**.

On a phone, waypoints appear as compact rows; tap a row to edit only that waypoint. The map displays the individual route segments, including changes of direction.

The calculator interpolates a moving target **between reported waypoint positions and times**. It does not infer unreported turns, accelerate automatically or extrapolate a position beyond the entered timetable. When a speed and at least one real game-clock timestamp are available, it can fill *missing* waypoint times; it will not overwrite contradictory reported times.

You can save and reopen multiple routes **within the current browser session**.

### Fire Solutions and missed shots

Saved firing cards show the selected target, bearing, elevation, charges, shell, cannon and grid. Select **✓** for a hit or **×** to open the missed-shot correction dialog.

The dialog has **three report categories**:

| Category | Meaning |
| --- | --- |
| **1. Correct target position** | Enter the actual target **grid**, or its **bearing + distance from Iron Nest**, to recalculate the firing solution. |
| **2. Observed shell impact** | Enter where the shell landed. Keep the intended target, but offset the next aiming point by the observed shell error. |
| **3. Target correction from impact** | Enter the **actual shell-impact grid**, then the **bearing (degrees) or 16-point compass direction** and **distance from impact to the target**. Calculate the corrected target grid and firing solution from Iron Nest. |

Category 3 pre-fills the **impact grid selector with the original firing solution's aimed grid**, so operators can adjust the coordinates instead of re-entering them. This is only a starting estimate, **not a confirmed observed impact**; correct it to the actual impact grid if the shell landed elsewhere. The original starting grid remains unchanged after later corrections. Older session cards recover it from the first recorded correction where possible. The target-from-impact method moves the **target itself**; category 2 instead compensates for **shell deviation**.

Corrections update the existing firing card and retain a limited revision history, including the impact origin and reported direction for category 3. These are game-map approximations, not calibrated shell-dispersion models. Corrections outside the map or available charge range are rejected.

## Coordinates and precision

The tactical map currently assumes:

- **Columns:** A–T from left to right (**20 km** total).
- **Rows:** 1–10 from bottom to top (**10 km** total).
- **Subcells:** 0–9 horizontally and vertically, representing **100 m** steps within a 1 km cell.

For example, `C2 5:6` means column C, row 2, horizontal subcell 5 and vertical subcell 6.

**Important:** The map axis convention and marker-centering assumptions are still provisional. Game text may round bearings, distances or marker positions; even geometrically valid results should be checked against the in-game map before use.

## Session storage and privacy

The app automatically saves editable **Calculate**, **Observation**, **Waypoint** and **Fire Solutions** state in browser **IndexedDB**. A tab-scoped token in **sessionStorage** identifies the current session; it does not contain the firing or mission data.

| Action | Expected behavior |
| --- | --- |
| Switch app tabs or close a modal | Inputs remain available. |
| Refresh the current browser tab | State is restored. |
| Start a fresh browser session | A fresh working state is initialized, and previous IndexedDB records are cleared during initialization. |

**Browser limitation:** Closing a tab or browser does *not* guarantee immediate deletion of IndexedDB records. Some browsers can restore sessionStorage after a crash or session restore, which may also restore this app's session. If you need to erase the data immediately, clear the site's storage using your browser's settings.

The application does not sync these records to a server. Data availability depends on browser storage permissions and behavior.

## Projectile flight time

Flight time **cannot be derived from the elevation equation alone**. The Waypoint planner can use manually observed flight time for timing an intercept; it also has an **experimental community flight-time estimate** as a fallback.

Estimated launch times and positions are predictions based on the supplied clock readings and route. Verify timing in-game, particularly when a small difference changes the interception point.

Raw player measurement fixtures and regression tests are maintained in `src/app/flight-field-data.ts` and `src/app/firing.test.ts`.

## Development

**Stack:** Angular 21, TypeScript, browser IndexedDB, static GitHub Pages hosting.

Requires **Node.js 22** (Angular 21 requires a compatible recent Node 22 version) and npm.

```bash
npm install
npm start
```

Run tests and build the production site:

```bash
npm test
npm run build -- --base-href /IronNest-Firingsollutioncalculator/
```

The main source files are under `src/app/`:

| File | Responsibility |
| --- | --- |
| `app.ts`, `app.html` | Calculate, Fire Solutions and shot corrections |
| `tactical-plotter.ts`, `graph-math.ts` | Observation editor, references and triangulation |
| `train-tracker.ts`, `train-math.ts`, `waypoint-geometry.ts` | Waypoint editor, route geometry and timing |
| `map-math.ts`, `grid-select.ts`, `plot-map.ts` | Grid coordinates and map presentation |
| `firing.ts`, `impact-correction.ts` | In-game firing formula and corrections |
| `session-db.ts` | Session-scoped IndexedDB auto-save |

### Deploy to GitHub Pages

Deployment runs automatically on pushes to `main`, or manually through the [GitHub Actions workflow](https://github.com/Halfe85/IronNest-Firingsollutioncalculator/actions). The configuration is `.github/workflows/deploy.yml`.

To enable it on a fork, go to **Settings → Pages → Build and deployment** and select **GitHub Actions**. The build's base URL must match that repository's Pages path.

## References and attribution

- [IRON NEST on Steam](https://store.steampowered.com/app/2950790/)
- [Steam community discussion of the firing formula](https://steamcommunity.com/app/2950790/discussions/0/588434434320143257/)
- [Community flight-time model](https://ironnestwiki.com/calculator)
- [Unofficial Iron Nest FCC by Joe Oakley](https://joeoakley52.github.io/UNOFFICIAL-Iron-Nest-FCC/) — inspiration for this independent implementation

**Disclaimer:** Iron Nest FCC is a fan-made game companion, not affiliated with or endorsed by the game's developer or publisher. All firing mathematics here are for the video game only.
