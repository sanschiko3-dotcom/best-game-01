import { grantRelic } from './relics.js';
// SPDX-License-Identifier: MIT
// LUMENWARDEN — shots.js
// One job: the deterministic demo states behind ?shot=….
// Each state is built only from the game's own systems (startRun,
// real waves, real enemies, real upgrades) with a fixed seed, so a
// screenshot is a real render of the game's own code — never a mock.
// The four shots mirror the four screenshots/ files:
//   title   — the title screen over drifting shadows
//   action  — mid-wave 4, lantern lit, shadows closing in
//   upgrade — the two-relic choice after a boss wave
//   boss    — wave 10, the Gloam King on screen with his health bar

import { VIEW } from './config.js';
import { makeEnemy, makeBoss, spawnBurst } from './entities.js';

export function applyShot(state, shot, seed, hooks) {
  const rng = state.rng;
  if (shot === 'title') {
    // Title screen as-is; the drifting title shadows are already set up
    // in main.js. The caller renders one deterministic frame.
    state.t = 1.5;
    return;
  }

  hooks.startRun();
  if (shot === 'action') {
    // Jump to wave 4, mid-fight: a full arena, braziers lit, embers
    // on the ground, flares in the air, score already ticking.
    state.wave = 27;state.night=5;state.player.mirrorRack=1;state.mirrors=[{x:780,y:345,angle:.7,hp:40},{x:900,y:450,angle:2,hp:40}];state.beam=[[{x:640,y:440},{x:780,y:345}],[{x:780,y:345},{x:900,y:450}]];
    state.score = 2840;
    state.kills = 31;
    state.combo = 3;
    state.multiplier = 3;
    state.player.x = VIEW.w / 2;
    state.player.y = VIEW.h / 2 + 40;
    state.player.fuel = 68;
    state.player.hp = 74;
    state.player.aim = -0.6;
    state.braziers[0].lit = true;
    state.braziers[3].lit = true;
    const spots = [
      ['webweaver', 420, 300], ['fuelmite', 880, 260], ['shade', 760, 520],
      ['shade', 300, 560], ['wisp', 560, 220], ['wisp', 980, 460],
      ['wisp', 180, 380], ['hulk', 1050, 560], ['spitter', 200, 220],
      ['shade', 640, 640], ['shade', 980, 640], ['wisp', 420, 640],
    ];
    for (const [type, x, y] of spots) state.enemies.push(makeEnemy(type, x, y, 4));
    state.waveObj = { n: 4, queue: ['shade', 'shade', 'wisp'], spawnTimer: 1, spawnGap: 1, bossSpawned: false, bossAt: false };
    state.flares.push({ x: 700, y: 380, vx: 400, vy: -200, damage: 26, blast: 78, life: 0.8 });
    state.flares.push({ x: 520, y: 470, vx: -300, vy: 200, damage: 26, blast: 78, life: 0.6 });
    for (let i = 0; i < 5; i++) {
      state.embers.push({ x: 480 + i * 40, y: 560 - (i % 2) * 50, vx: 0, vy: 0, life: 9, bob: i });
    }
    spawnBurst(state.particles, 700, 380, '#ffd97a', 10, 200);
    spawnBurst(state.particles, 880, 260, '#ffb347', 8, 160);
    state.banner = { text: 'WAVE 27', sub: 'Reflect the shattered sun.', t: 1.8 };
    state.t = 2.0;
    return;
  }

  if (shot === 'upgrade') {
    // A cleared wave 3: the blessing choice, score and kills visible.
    state.wave = 3;
    state.score = 1960;
    state.kills = 22;
    state.player.hp = 82;
    state.player.fuel = 54;
    state.braziers[1].lit = true;
    state.enemies = [];
    state.waveObj = { n: 3, queue: [], spawnTimer: 0, spawnGap: 1, bossSpawned: false, bossAt: false };
    grantRelic(state);
    state.t = 2.0;
    return;
  }

  if(shot==='shop') { state.phase='shop';state.currency=24;state.wave=6;return; }
  if (shot === 'boss') {
    state.night=5;
    // Wave 10: the Gloam King has awakened, escort shades around him,
    // the Warden's lantern low but burning, boss bar on screen.
    state.wave = 30;
    state.score = 12480;
    state.kills = 96;
    state.player.x = VIEW.w / 2;
    state.player.y = VIEW.h - 180;
    state.player.hp = 58;
    state.player.fuel = 41;
    state.player.aim = -Math.PI / 2;
    state.braziers[0].lit = true;
    state.braziers[1].lit = true;
    const boss = makeBoss(VIEW.w / 2, 350, 30);
    boss.sweep = 0;
    boss.sweepTime = 0.4;
    boss.sweepAngle = Math.PI / 2;
    boss.hp = boss.maxHp * 0.62; // already bloodied: a real fight
    state.enemies.push(boss);
    for (const [x, y] of [[420, 380], [860, 380], [300, 520], [980, 520]]) {
      state.enemies.push(makeEnemy('shade', x, y, 10));
    }
    state.enemies.push(makeEnemy('wisp', 640, 470, 10));
    state.waveObj = { n: 10, queue: [], spawnTimer: 0, spawnGap: 1, bossSpawned: true, bossAt: true };
    state.banner = { text: 'THE SHATTERED REGENT AWAKENS', sub: 'Shatter the broken crown', t: 2.2 };
    spawnBurst(state.particles, VIEW.w / 2, 350, '#ff4d6d', 20, 220);
    state.t = 2.0;
    return;
  }
}
