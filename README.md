# LUMENWARDEN — Make the best game (best-game-01)

**Keep the last lantern burning through the Long Night.**

An original arena-survival game in which light is both your weapon and
your lifeline. The dark sends its shadows in 10 waves; your lantern's
glow burns them, your flare bolts blast them, and the embers they drop
are the only fuel that keeps your light alive. Survive to dawn — Wave
10 brings the Gloam King — then keep going into the Endless Night.

## How to play

| Input | Action |
|---|---|
| WASD / arrow keys | Move the Warden |
| Mouse | Aim the lantern |
| Click / Space (hold) | Fire a flare bolt (costs fuel) |
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
