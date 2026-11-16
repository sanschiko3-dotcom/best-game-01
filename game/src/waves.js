// LUMENWARDEN — waves.js
// One job: what each wave throws at the player and when.
// A wave is a spawn queue built from its composition; the queue drains
// on a timer, spawning at the arena's edges, away from the Warden.
// Boss waves add the Gloam King once the escort has mostly arrived.

import { sfx } from './audio.js';
import { VIEW, BOSS_WAVES, waveComp } from './config.js';
import { makeEnemy, makeBoss } from './entities.js';

export function buildWave(n, rng) {
  const comp = waveComp(n, Math.min(3, Math.ceil(n / 6)));
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
    spawnGap: Math.max(0.35, 1.05 - n * 0.06),
    bossSpawned: false,
    bossAt: BOSS_WAVES.includes(n),
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
      const night = Math.min(3, Math.ceil(wave.n / 6));
      const elite = (wave.n - 1) % 6 >= 1 && rng.chance(0.08 + (night - 1) * 0.02);
      enemies.push(makeEnemy(type, at.x, at.y, wave.n, elite));
      if (elite) sfx.eliteSpawn();
    }
  } else if (wave.bossAt && !wave.bossSpawned) {
    // The boss enters once the escort is out, with a warning banner.
    wave.bossSpawned = true;
    const at = edgePoint(rng, player.x, player.y);
    enemies.push(makeBoss(at.x, at.y, wave.n));
    state.banner = { text: `${['THE GLOAM KING','THE HOLLOW TIDE','THE GLOAM QUEEN'][Math.min(2,Math.ceil(wave.n/6)-1)]} AWAKENS`, sub: ['Break his crown of dark', 'Drown the tide in light', 'Break her crown of dark'][Math.min(2,Math.ceil(wave.n/6)-1)], t: 2.6 };
  }
}

export function waveCleared(wave, enemies) {
  return wave && wave.queue.length === 0 && enemies.length === 0;
}
