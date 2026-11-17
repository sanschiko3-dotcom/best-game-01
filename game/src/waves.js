// SPDX-License-Identifier: MIT
// LUMENWARDEN — waves.js
// One job: what each wave throws at the player and when.
// A wave is a spawn queue built from its composition; the queue drains
// on a timer, spawning at the arena's edges, away from the Warden.
// Boss waves add the Gloam King once the escort has mostly arrived.

import { sfx } from './audio.js';
import { endlessScale } from './config.js';
import { weakenKing } from './hollow.js';
import { VIEW, BOSS_WAVES, waveComp, NIGHT_THEMES, bossNameForNight, bossSubForNight, endlessComp } from './config.js';
import { makeEnemy, makeBoss } from './entities.js';

// ---- v3: wave composition, declared as data ---------------------------
// Each night bends the baseline mix toward its own terrain. Night 1 is
// the baseline untouched; night 2 floods the arena with wisps and
// spitters at the cost of shades; nights 3+ send the hunters —
// stalkers, siphons and splitters. The table lives in config.js and is
// the single source of truth: waveComp() only applies it, so tuning a
// night means editing one row and nothing else.

// Every boss wave is a multiple of six: the Gloam King on 6, the Hollow
// Tide on 12, the Gloam Queen on 18, and the Hollow King on 24, 30, 36…
// — the crown returns every sixth wave for as long as the run lasts.
export const BOSS_SCHEDULE = {
  every: 6,
  names: ['The Gloam King', 'The Hollow Tide', 'The Gloam Queen', 'The Hollow King', 'The Shattered Regent'],
};

export function isBossWave(n) {
  return n % BOSS_SCHEDULE.every === 0;
}

export function bossWaveName(n) {
  const night = Math.ceil(n / 6);
  return BOSS_SCHEDULE.names[Math.min(BOSS_SCHEDULE.names.length, night) - 1];
}

// (endlessComp lives in config.js, next to ENDLESS_TABLE.)

// Spawn gap: waves start roomy and tighten as the night deepens. The
// endless deep tightens further, but never below 0.30s — the player
// must always be able to read the next arrival.
export function spawnGapFor(n) {
  if (n > 24) return Math.max(0.3, 1.05 - n * 0.06);
  return Math.max(0.35, 1.05 - n * 0.06);
}

// The banner text for a wave: night name, wave number, and the taunt.
// Nights 1-3 use their theme names; night 4+ is the Hollow Dawn, and
// the endless deep (night 5+) keeps the same name with a rising number.
export function waveTitle(n) {
  const night = Math.ceil(n / 6);
  const nightName = night <= 5
    ? (night===4 ? 'The Hollow Dawn · Night 4' : NIGHT_THEMES[night - 1].name)
    : 'The Endless Night';
  const wave = n % 6 === 0 ? 'BOSS' : `WAVE ${(n - 1) % 6 + 1}/5`;
  const sub = (n === 5 || n === 10)
    ? 'Something huge moves in the dark…'
    : (night >= 4 ? NIGHT_THEMES[3].sub : 'Hold the light.');
  return { night: nightName, wave, sub };
}

export function buildWave(n, rng) {
  const comp = waveComp(n, Math.ceil(n / 6));
  const queue = [];
  for (const [type, count] of Object.entries(comp)) {
    for (let i = 0; i < count; i++) queue.push(type);
  }
  // Shuffle the mix, but keep the first three spawns gentle.
  const shuffled = rng.shuffle(queue);
  const first = shuffled.filter((t) => t === 'shade').slice(0, 3);
  const rest = shuffled.filter((t, i) => !(t === 'shade' && i < 3));
  const ordered = [...first, ...rng.shuffle(rest)];
  return {
    n,
    queue: ordered,
    spawnTimer: 0.4,
    spawnGap: spawnGapFor(n),
    bossSpawned: false,
    bossAt: isBossWave(n),
  };
}

function edgePoint(rng, px, py) {
  // Pick an arena edge point at least 260px from the player so nothing
  // spawns on top of the Warden.
  for (let tries = 0; tries < 12; tries++) {
    const side = rng.int(0, 3);
    let x, y;
    if (side === 0) { x = rng.range(40, VIEW.w - 40); y = 40; }
    else if (side === 1) { x = rng.range(40, VIEW.w - 40); y = VIEW.h - 40; }
    else if (side === 2) { x = 40; y = rng.range(40, VIEW.h - 40); }
    else { x = VIEW.w - 40; y = rng.range(40, VIEW.h - 40); }
    if (Math.hypot(x - px, y - py) > 260) return { x, y };
  }
  return { x: 60, y: 60 };
}

export function updateWave(wave, enemies, player, dt, state, rng) {
  if (!wave) return;
  if (wave.queue.length > 0) {
    wave.spawnTimer -= dt;
    if (wave.spawnTimer <= 0) {
      wave.spawnTimer = wave.spawnGap * rng.range(0.7, 1.3);
      const type = wave.queue.shift();
      const at = edgePoint(rng, player.x, player.y);
      const night = Math.ceil(wave.n / 6);
      const elite = (wave.n - 1) % 6 >= 1 && rng.chance(Math.min(0.85, 0.08 + (night - 1) * 0.02 + endlessScale(wave.n).elite));
      enemies.push(makeEnemy(type, at.x, at.y, wave.n, elite));
      if (elite) sfx.eliteSpawn();
    }
  } else if (wave.bossAt && !wave.bossSpawned) {
    // The boss enters once the escort is out, with a warning banner.
    wave.bossSpawned = true;
    const at = edgePoint(rng, player.x, player.y);
    const night = Math.ceil(wave.n / 6);
    enemies.push(weakenKing(makeBoss(at.x, at.y, wave.n), state));
    if (night >= 4) sfx.hollowRoar(); else sfx.bossRoar();
    state.banner = { text: `${bossNameForNight(night)} AWAKENS`, sub: bossSubForNight(night), t: 2.6 };
  }
}

export function waveCleared(wave, enemies) {
  return wave && wave.queue.length === 0 && enemies.length === 0;
}
