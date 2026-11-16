[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/sanschiko3-dotcom/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/sanschiko3-dotcom/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# LUMENWARDEN v3 — Make the best game (best-game-01)

**Keep the last lantern burning through the Long Night.**

An arena survival campaign across three nights, each with five waves and a boss. Light burns enemies, fuel sustains the lantern, and collected embers fund permanent upgrades at dawn. Survive the Gloam Queen to unlock endless play — and past the dawn, the Hollow Dawn answers.

## v3 — The Hollow Dawn

- **Night 4: The Hollow Dawn.** Survive all three nights and the campaign continues into a fourth night under a pale hollow moon: drifting hollow-fog banks, moving hollow zones that drain lantern fuel, and a violet palette all its own. After night 4, the Endless Night deepens every six waves.
- **Beacon puzzle.** Night 4 raises three unlit beacons. Stand inside one with fuel to kindle it over two seconds. Each lit beacon is +25% brazier damage and −10% Hollow King health — light three and the crown breaks much easier.
- **Placeable braziers, three kinds, three levels.** The Dawn Shop now sells braziers by kind: Ember (steady burn, 8e), Frost (chills shadows to half speed, 12e), Sun (fierce burn, wide light, 16e). Buying a kind again raises it to level 3 — wider radius, stronger burn, deeper chill — with level pips drawn under each brazier in the arena. `U` upgrades the last kind placed.
- **Ember Vault (meta-progression).** Embers left at the end of a run are banked into a persistent Vault (localStorage). Spend them on the title screen (keys 1–4) for permanent upgrades: +15 max HP, +10% flare damage, −8% dash cooldown, and a fifth brazier socket.
- **New enemies + boss.** Mirror Wraiths reflect flare bolts back at the Warden (once per 1.2s each), Lantern Thieves hunt lit braziers and douse them, and Hollow Wisps swarm the endless deep in growing numbers. Night 4's boss is the Hollow King, with a faster phase-2 enrage that summons mirrors and thieves.
- **Juice.** Brazier flames grow with level, Frost braziers shed snow motes, Sun braziers throw rotating rays, hollow zones pulse violet, the hollow moon is cratered, and new sounds mark a beacon lit, a brazier upgraded, and the Hollow King's roar.
- **Run report.** The end screen now lists nights survived, beacons lit, braziers placed, embers banked, best endless wave, and flares fired — and the best endless wave persists between runs.

## How to play

| Input | Action |
|---|---|
| WASD / arrow keys | Move the Warden |
| Mouse | Aim the lantern |
| Click (hold) | Fire a flare bolt (costs fuel) |
| E (near a brazier) | Light a brazier — 10 fuel for a permanent burning circle |
| 1 / 2 / 3 or click | Choose a blessing between waves |
| P / Esc | Pause · M mute · R restart after the end |

**Rules, in one paragraph:** shadows inside your lantern's glow (or a
lit brazier's light) take steady burn damage; flare bolts explode on
impact; kills drop embers that refill fuel and raise a combo multiplier
(up to ×5); fuel always drains, so you must keep hunting. Four enemy
types — Shades (chasers), Wisps (fast darters), Hulks (tanks), Spitters
(ranged) — plus the Gloam King boss on waves 5 and 10, who summons
shades and fires radial bursts. Clear a wave to pick 1 of 3 blessings
(wider light, twin flares, thicker wick, ember magnet, and more). Lose
all HP and the light goes out; clear wave 10 and dawn breaks — you win,
with an endless mode after.

## Tech

- Pure static files under `game/` — no build step, no network request,
  no libraries. Open `game/index.html` in desktop Chrome (or
  `node serve.ts`, then http://localhost:8080).
- All art is drawn on canvas and all sound is synthesised with WebAudio;
  there are no asset files at all.
- `main.ts` (Node 22, standard library only) hands the game in: it
  copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored `vendor/makefun-game.ts`.

## Source layout (one job per file)

| File | Job |
|---|---|
| `game/index.html` | Page shell: canvas + module entry |
| `game/src/config.js` | Every tunable number, colour and enemy definition |
| `game/src/random.js` | Seeded RNG (deterministic demo states and tests) |
| `game/src/input.js` | Keyboard + mouse state |
| `game/src/audio.js` | Synthesised sound effects + ambient drone |
| `game/src/entities.js` | Player, enemies, flares, bolts, embers, braziers, collisions |
| `game/src/waves.js` | Wave composition and spawning |
| `game/src/upgrades.js` | The 8 between-wave blessings |
| `game/src/render.js` | All drawing: world, darkness-with-light, HUD, menus |
| `game/src/shots.js` | Deterministic `?shot=` demo states for the screenshots |
| `game/src/main.js` | State machine, loop, and the `?selftest=1` harness |
| `main.ts` | Submission program (copies game + screenshots, writes dossier) |
| `serve.ts` | Tiny static server for local play-testing |

## Screenshots

`1-title.jpg` title screen, `2-action.jpg` mid-wave 4, `3-upgrade.jpg`
the blessing choice, `4-boss.jpg` the Wave 10 boss fight. All four are
real renders of the game's own code (`?shot=…&seed=7`), taken in
headless Chrome via CDP — no edits, no composites.

## Verification (local, 2026-11-16)

- `node --check` passes on every `game/src/*.js`.
- `?selftest=1` in headless Chrome: **SELFTEST PASS** — 14 checks, 0
  console errors (wave spawns and clears, upgrade applies and returns
  to play, boss spawns and takes damage, death → game over, wave 10
  clear → victory, a frame renders).
- Live play-test with real CDP input events (click to start, WASD +
  mouse-aimed flares): no console errors; play-test screenshot shows
  wave 1 in progress with the player firing.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` builds the dossier; two runs
  produce byte-identical output (see `dossier.json`).

## License

MIT — see `LICENSE` (first line: `SPDX-License-Identifier: MIT`).

## Three Nights of the Long Dark

Five waves and a boss guard each dawn: Ember Fields, Drowned Hollow, and Gloam Citadel. Spend collected ember currency on six permanent upgrades between nights. Shift or right-click dashes with brief invulnerability and a burning trail. Q or Space detonates a fully charged Dawn Nova. Stalkers hide outside light; splitters release wisps; siphons steal fuel. The Hollow Tide summons rings of wisps, while the Gloam Queen teleports to extinguish braziers. Fog reduces lantern reach in night two, and cursed ground drains fuel in night three. Survive all three nights to unlock endless play.

## V2 systems

| Input | Action |
|---|---|
| Shift / right-click | Dash with a burning trail |
| Q / Space | Release a fully charged nova |
| 1–9 / 0 | Buy one of ten dawn-shop items |
| Enter | Leave the shop |

Night two adds drifting fog banks that halve light while you stand inside,
with waves favouring wisps and spitters. Night three favours stalkers,
siphons and splitters; cursed patches drain six fuel per second and summon
distant shades. Each patch supports at most two living shades.

Elite enemies begin on the second wave of each night. Their gold crown
marks triple health, double score and three guaranteed ember drops. The
chance starts at eight percent and increases by two points each night.
Bosses enrage below half health, moving forty percent faster and gaining
a crown burst, double wisp ring, or rapid teleport and splitter fountain.

Collect embers within 2.5 seconds to build a flame streak. Every four
pickups increase currency per ember, capped at five. Ember Greed extends
the window and adds another currency bonus every three streak pickups.
Twelve chained kills ignite BLAZING, granting a golden aura and twenty-five
percent more flare damage until the kill combo expires.

The ten-item shop includes true piercing Sunlance, a fifth central brazier,
a once-per-night Second Wind revival, and Frost Lantern's slowing light.
# v3 — The Hollow Dawn

- Night 4 introduces drifting hollow fog, a pale moon and moving fuel-draining ground.
- Endless nights bring scaling enemies and growing Hollow Wisp swarms.
- Channel three beacons to empower braziers and weaken the Hollow King.
- Upgrade Ember, Frost and Sun braziers through three levels.
- Bank embers in the permanent Ember Vault between runs.
- Mirror Wraiths reflect flares; Lantern Thieves douse defensive flames.
- Face the Hollow King and track your best endless wave.

