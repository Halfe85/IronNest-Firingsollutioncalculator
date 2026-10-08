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