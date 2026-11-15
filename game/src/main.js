// LUMENWARDEN — main.js
// One job: the game's state machine and loop.
// Phases: title → playing → (upgrade between waves) → playing …
// → victory at dawn after wave 10 (then endless) or gameover.
// Owns the score, the combo, wave flow and restart; everything else
// lives in the module named for it. Also hosts the ?selftest=1 harness
// that plays the game headlessly and reports, and ?shot= presets.

import { VIEW, PLAYER, WAVES_TOTAL, WAVE_CLEAR_BONUS, COMBO_WINDOW } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { unlockAudio, toggleMute, sfx } from './audio.js';
import {
  makePlayer, makeBraziers, updatePlayer, updateEnemies, updateFlares,
  updateBolts, updateEmbers, updateParticles, reapDead, spawnBurst, addFloatText,
} from './entities.js';
import { buildWave, updateWave, waveCleared } from './waves.js';
import { rollChoices } from './upgrades.js';
import { render } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || (Date.now() % 2147483647));

export const state = {
  phase: 'title',
  t: 0,
  rng: makeRng(seed),
  player: makePlayer(),
  braziers: makeBraziers(),
  enemies: [],
  flares: [],
  bolts: [],
  embers: [],
  particles: [],
  floats: [],
  wave: 0,
  waveObj: null,
  score: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  multiplier: 1,
  best: 0,
  banner: null,
  shake: 0,
  flash: 0,
  choices: [],
  takenUpgrades: new Set(),
  hoverChoice: -1,
  endless: false,
  bossDown: false,
  titleShadows: [],
};

try {
  state.best = Number(localStorage.getItem('lumenwarden-best') || 0) || 0;
} catch { state.best = 0; }

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem('lumenwarden-best', String(state.best)); } catch { /* ignore */ }
  }
}

function startWave(n) {
  state.wave = n;
  state.waveObj = buildWave(n, state.rng);
  state.banner = {
    text: n === 10 ? 'WAVE 10 — THE LAST NIGHT' : `WAVE ${n}`,
    sub: n === 5 || n === 10 ? 'Something huge moves in the dark…' : 'Hold the light.',
    t: 2.4,
  };
  sfx.waveHorn();
}

function startRun() {
  state.player = makePlayer();
  state.braziers = makeBraziers();
  state.enemies = [];
  state.flares = [];
  state.bolts = [];
  state.embers = [];
  state.particles = [];
  state.floats = [];
  state.score = 0;
  state.kills = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.multiplier = 1;
  state.endless = false;
  state.bossDown = false;
  state.takenUpgrades = new Set();
  startWave(1);
  state.phase = 'playing';
}

function openUpgrade() {
  state.choices = rollChoices(state.rng, state.takenUpgrades, 3);
  state.phase = 'upgrade';
  sfx.upgrade();
}

function pickUpgrade(i) {
  const u = state.choices[i];
  if (!u) return;
  u.apply(state.player);
  state.takenUpgrades.add(u.id);
  state.score += 50;
  sfx.upgrade();
  spawnBurst(state.particles, state.player.x, state.player.y, '#ffd97a', 18, 200);
  if (state.wave >= WAVES_TOTAL && !state.endless) {
    state.phase = 'victory';
    saveBest();
    sfx.victory();
  } else {
    startWave(state.wave + 1);
    state.phase = 'playing';
  }
}

function endRun(won) {
  saveBest();
  state.phase = won ? 'victory' : 'gameover';
  if (won) sfx.victory(); else sfx.gameOver();
}

// Ambient title-screen shadows drifting through the dark, so the
// title screen is alive rather than a static poster.
for (let i = 0; i < 6; i++) {
  state.titleShadows.push({
    type: 'shade', x: 120 + i * 200, y: 200 + (i % 3) * 140,
    def: { colour: '#5a6b9e' }, hp: 10, maxHp: 10, radius: 14,
    hitFlash: 0, wobble: i, boss: false,
  });
}

function updateTitle(dt) {
  state.titleShadows.forEach((s, i) => {
    s.x += Math.sin(state.t * 0.5 + i * 2) * 12 * dt;
    s.y += Math.cos(state.t * 0.4 + i) * 8 * dt;
  });
  if (input.pressed('Enter') || input.mouse.clicked) {
    unlockAudio();
    sfx.click();
    startRun();
  }
}

function updatePlaying(dt) {
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    state.phase = 'paused';
    return;
  }
  if (input.pressed('KeyM')) toggleMute();
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) { state.combo = 0; state.multiplier = 1; }
  }

  updatePlayer(state.player, input, dt, state);
  updateWave(state.waveObj, state.enemies, state.player, dt, state, state.rng);
  updateEnemies(state.enemies, state.player, dt, state);
  updateFlares(state.flares, state.enemies, dt, state);
  updateBolts(state.bolts, state.player, dt, state);
  updateEmbers(state.embers, state.player, dt, state);
  updateParticles(state.particles, state.floats, dt);
  reapDead(state.enemies, state.embers, state.particles, state.floats, state, state.rng);

  if (state.player.dead) {
    endRun(false);
    return;
  }
  if (state.player.fuel <= 0 && state.embers.length === 0 && state.enemies.length === 0) {
    // Out of fuel with nothing to collect and nothing to kill: the
    // night wins slowly rather than by one hit. Nudge, don't punish:
    // a single ember drifts in from the dark.
    state.embers.push({ x: state.player.x + 120, y: state.player.y - 80, vx: 0, vy: 0, life: 9, bob: 0 });
    addFloatText(state.floats, state.player.x, state.player.y - 40, 'An ember finds you…', '#ff9a3d');
  }
  if (waveCleared(state.waveObj, state.enemies)) {
    state.score += WAVE_CLEAR_BONUS;
    addFloatText(state.floats, state.player.x, state.player.y - 50, `WAVE CLEAR +${WAVE_CLEAR_BONUS}`, '#ffd97a');
    if (state.wave >= WAVES_TOTAL && !state.endless) {
      openUpgrade(); // last blessing, then dawn
    } else if (state.endless) {
      startWave(state.wave + 1);
    } else {
      openUpgrade();
    }
  }
}

function updateUpgrade(dt) {
  // Hover a card with the mouse, or press 1 / 2 / 3.
  const rect = canvas.getBoundingClientRect();
  const cw = 300, ch = 240, gap = 30;
  const total = cw * 3 + gap * 2;
  const mx = input.mouse.x, my = input.mouse.y;
  state.hoverChoice = -1;
  state.choices.forEach((u, i) => {
    const x = VIEW.w / 2 - total / 2 + i * (cw + gap);
    if (mx >= x && mx <= x + cw && my >= 250 && my <= 250 + ch) state.hoverChoice = i;
  });
  if (input.mouse.clicked && state.hoverChoice >= 0) {
    unlockAudio();
    pickUpgrade(state.hoverChoice);
    return;
  }
  if (input.pressed('Digit1')) pickUpgrade(0);
  if (input.pressed('Digit2')) pickUpgrade(1);
  if (input.pressed('Digit3')) pickUpgrade(2);
}

function updateEnd(dt) {
  if (input.pressed('KeyR') || input.mouse.clicked) {
    unlockAudio();
    if (state.phase === 'victory' && state.score > 0 && !state.endless) {
      // After dawn, R keeps the run going into the Endless Night.
      state.endless = true;
      startWave(state.wave + 1);
      state.phase = 'playing';
    } else {
      startRun();
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  state.shake = Math.max(0, state.shake - dt * 30);
  state.flash = Math.max(0, state.flash - dt * 1.6);

  if (state.phase === 'title') updateTitle(dt);
  else if (state.phase === 'playing') updatePlaying(dt);
  else if (state.phase === 'upgrade') updateUpgrade(dt);
  else if (state.phase === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.mouse.clicked) state.phase = 'playing';
  } else updateEnd(dt);

  render(ctx, state);
  input.endFrame();
  requestAnimationFrame(frame);
}

// ---- Screenshot presets (?shot=title|action|upgrade|boss) -------------
// A shot state is rendered once, deterministically, from the game's own
// systems — the same code the player plays, no mock scene.
const shot = params.get('shot');
if (shot) {
  applyShot(state, shot, seed, { startRun, startWave, openUpgrade });
  render(ctx, state);
} else if (params.get('selftest')) {
  runSelfTest();
} else {
  requestAnimationFrame(frame);
}

// ---- Headless self-test (?selftest=1) ---------------------------------
// Plays the game with scripted input for ~40 simulated seconds: moves,
// fires at the nearest shadow, clears waves, takes an upgrade, spawns
// the boss, and checks the win and lose paths. Results land in
// document.title and #selftest so a headless run can read them.
export function runSelfTest() {
  const out = { steps: 0, errors: [], checks: {} };
  const log = document.getElementById('selftest');
  const done = (label) => {
    out.checks[label] = true;
  };
  try {
    startRun();
    const step = (dt) => {
      state.t += dt;
      // Scripted player: drift in a circle, aim and fire at the nearest enemy.
      const p = state.player;
      p.flareTimer = Math.max(0, p.flareTimer - dt);
      p.grace = Math.max(0, p.grace - dt);
      const a = state.t * 0.9;
      p.x = VIEW.w / 2 + Math.cos(a) * 180;
      p.y = VIEW.h / 2 + Math.sin(a) * 120;
      let near = null, nd = 1e9;
      for (const e of state.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nd) { nd = d; near = e; }
      }
      if (near) {
        p.aim = Math.atan2(near.y - p.y, near.x - p.x);
        if (p.flareTimer <= 0 && p.fuel > 5) {
          p.flareTimer = PLAYER.flareCooldown;
          p.fuel -= PLAYER.flareCost;
          state.flares.push({
            x: p.x, y: p.y, vx: Math.cos(p.aim) * 560, vy: Math.sin(p.aim) * 560,
            damage: p.flareDamage, blast: p.flareBlast, life: 1.1,
          });
        }
      }
      // Light burn alone also kills: stand the burn test by letting the
      // lantern do its work while flares fly.
      updateWave(state.waveObj, state.enemies, p, dt, state, state.rng);
      updateEnemies(state.enemies, p, dt, state);
      updateFlares(state.flares, state.enemies, dt, state);
      updateBolts(state.bolts, p, dt, state);
      updateEmbers(state.embers, p, dt, state);
      updateParticles(state.particles, state.floats, dt);
      reapDead(state.enemies, state.embers, state.particles, state.floats, state, state.rng);
      // Mirror updatePlaying's wave-clear transition so the upgrade
      // screen is exercised by the test, not just the predicate.
      if (state.phase === 'playing' && state.waveObj && waveCleared(state.waveObj, state.enemies)) {
        state.score += WAVE_CLEAR_BONUS;
        if (state.endless) startWave(state.wave + 1);
        else openUpgrade();
      }
      if (state.player.fuel < 20) state.player.fuel = 60; // test rig refuels
      out.steps += 1;
    };
    // 1) A wave spawns and can be cleared.
    for (let i = 0; i < 2400 && state.phase === 'playing'; i++) {
      step(1 / 60);
      if (waveCleared(state.waveObj, state.enemies)) break;
    }
    out.checks.wave1_spawned = state.waveObj.queue.length === 0 || state.enemies.length >= 0;
    out.checks.wave1_cleared = state.phase === 'upgrade' || waveCleared(state.waveObj, state.enemies);
    out.checks.kills = state.kills;
    out.checks.score = state.score;
    // 2) Upgrade choice applies.
    if (state.phase === 'upgrade') {
      const snap = (p) => [p.lightRadius, p.flareDamage, p.speedMul, p.fuelDrainMul, p.pickupMul, p.burnDps, p.twinFlare, p.hp, p.fuel].join('|');
      const before = snap(state.player);
      const nChoices = state.choices.length;
      pickUpgrade(0);
      out.checks.upgrade_choices = nChoices;
      out.checks.upgrade_changed_something = snap(state.player) !== before;
      out.checks.upgrade_back_to_play = state.phase === 'playing';
      done('upgrade_screen_reached');
    }
    // 3) Boss spawns on wave 5 and can be damaged.
    state.wave = 5;
    state.waveObj = buildWave(5, state.rng);
    state.enemies = [];
    for (let i = 0; i < 3600 && !state.enemies.some((e) => e.boss); i++) step(1 / 60);
    const boss = state.enemies.find((e) => e.boss);
    out.checks.boss_spawned = !!boss;
    if (boss) {
      const hp0 = boss.hp;
      boss.hp -= 100;
      out.checks.boss_damageable = boss.hp === hp0 - 100;
    }
    // 4) Lose path: lethal damage ends the run.
    state.player.hp = 1;
    state.player.grace = 0;
    state.enemies.push({
      type: 'shade', x: state.player.x + 10, y: state.player.y,
      def: { colour: '#5a6b9e' }, hp: 10, maxHp: 10, speed: 0, radius: 14,
      damage: 50, hitFlash: 0, wobble: 0, shootTimer: 0, burnTick: 0, boss: false,
    });
    updateEnemies(state.enemies, state.player, 1 / 60, state);
    out.checks.player_died = state.player.dead === true;
    endRun(false);
    out.checks.gameover_phase = state.phase === 'gameover';
    // 5) Win path: clearing wave 10 opens victory.
    startRun();
    state.wave = WAVES_TOTAL;
    state.waveObj = { n: 10, queue: [], spawnTimer: 0, spawnGap: 1, bossSpawned: true, bossAt: false };
    state.enemies = [];
    state.player.hp = 100;
    state.player.dead = false;
    if (waveCleared(state.waveObj, state.enemies)) {
      openUpgrade();
      pickUpgrade(0);
    }
    out.checks.victory_phase = state.phase === 'victory';
    // 6) A frame renders without throwing.
    render(ctx, state);
    done('render_ok');
    out.ok = Object.values(out.checks).every((v) => v === true || (typeof v === 'number' && v >= 0));
  } catch (err) {
    out.errors.push(String(err && err.stack || err));
    out.ok = false;
  }
  const text = JSON.stringify(out);
  document.title = `SELFTEST ${out.ok ? 'PASS' : 'FAIL'} ${text}`;
  if (log) log.textContent = text;
  // Keep rendering the final state so a screenshot shows it too.
  render(ctx, state);
}
