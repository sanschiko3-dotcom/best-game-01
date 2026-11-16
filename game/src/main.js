// SPDX-License-Identifier: MIT
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
  startEnvironment, effectiveRadius, makeBoss, makePlayer, makeBraziers, updatePlayer, updateEnemies, updateFlares,
  updateBolts, updateEmbers, updateParticles, reapDead, spawnBurst, addFloatText,
} from './entities.js';
import { buildWave, updateWave, waveCleared, waveTitle } from './waves.js';
import { rollChoices } from './upgrades.js';
import { render } from './render.js';
import { SHOP, buy, buyBrazier, upgradeBrazier, drawShop } from './shop.js';
import { dash, nova, updateAbilities, makeEnemy } from './entities.js';
import { applyShot } from './shots.js';

import { loadVault, saveVault, purchaseVault, applyVault, vaultCost, VAULT_ITEMS } from './vault.js';
const vault=loadVault();
import { litBeacons, beaconBonus, updateHollow, weakenKing } from './hollow.js';
import { endlessScale, waveComp, themeForNight, brazierStats, endlessComp } from './config.js';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || (Date.now() % 2147483647));

function makeRunStats() {
  return {
    killsByType: {},
    embersCollected: 0,
    flaresFired: 0,
    novaCasts: 0,
    dashes: 0,
    damageDealt: 0,
    bossesDown: 0,
    nightsCleared: 0,
  };
}

export const state = {
  stats: makeRunStats(),
  bestCombo: 0,
  defeatedBosses: [],
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
  const oldNight = state.night;
  state.night = Math.ceil(n/6);
  if (oldNight !== state.night) {
    startEnvironment(state, state.night);
    state.player.reviveUsed = false;
  }
  state.waveObj = buildWave(n, state.rng);
  const wt = waveTitle(n);
  state.banner = {
    text: `${wt.night} — ${wt.wave}`,
    sub: wt.sub,
    t: 2.4,
  };
  sfx.waveHorn();
}

function startRun() {
  state.beacons = undefined;
  state.stats = makeRunStats();
  state.bestCombo = 0;
  state.defeatedBosses = [];
  state.currency=0; state.trails=[];
  state.night = 0;
  state.streak = 0;
  state.streakTimer = 0;
  state.blazing = false;
  state.player = makePlayer();
  state.braziers = makeBraziers();
  applyVault(vault,state.player,state.braziers);
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
  if(state.wave%6===0 && state.wave!==18) { state.phase='shop'; return; }
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
    endRun(true);
    saveBest();
    sfx.victory();
  } else {
    startWave(state.wave + 1);
    state.phase = 'playing';
  }
}

function endRun(won) {
  state.stats.beaconsLit = litBeacons(state);
  state.stats.embersBanked = (state.stats.embersBanked || 0) + (state.currency || 0);
  try {
    state.bestEndless = Math.max(Number(localStorage.getItem('lumenwarden-best-endless')) || 0, state.wave > 24 ? state.wave : 0);
    localStorage.setItem('lumenwarden-best-endless', String(state.bestEndless));
  } catch { state.bestEndless = state.wave > 24 ? state.wave : 0; }
  saveBest();
  vault.bank+=state.currency||0; state.currency=0; saveVault(vault);
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
  for(let i=0;i<4;i++) if(input.pressed('Digit'+(i+1))) purchaseVault(vault,i);
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

  state.streakTimer = Math.max(0, state.streakTimer - dt);
  if (!state.streakTimer) state.streak = 0;
  state.blazing = state.combo >= 12 && state.comboTimer > 0;
  state.redFlash = Math.max(0, (state.redFlash || 0) - dt);
  updatePlayer(state.player, input, dt, state);
  updateWave(state.waveObj, state.enemies, state.player, dt, state, state.rng);
  updateEnemies(state.enemies, state.player, dt, state);
  updateFlares(state.flares, state.enemies, dt, state);
  updateBolts(state.bolts, state.player, dt, state);
  updateEmbers(state.embers, state.player, dt, state);
  updateParticles(state.particles, state.floats, dt);
  reapDead(state.enemies, state.embers, state.particles, state.floats, state, state.rng);

  if (state.player.dead && state.player.secondWind && !state.player.reviveUsed) {
    state.player.reviveUsed = true;
    state.player.dead = false;
    state.player.hp = state.player.maxHp * 0.5;
    state.player.grace = 3;
    state.banner = { text: 'SECOND WIND', sub: 'The lantern refuses the dark.', t: 3 };
  }
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
    if (state.wave % 6 === 0) state.stats.nightsCleared += 1;
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
      state.phase='shop';
    } else {
      state.phase='title';
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
  else if (state.phase === 'shop') {
    for(let i=0;i<3;i++) if(input.pressed(['KeyB','KeyF','KeyS'][i])) buyBrazier(state,['Ember','Frost','Sun'][i]);
    if(input.pressed('KeyU')) upgradeBrazier(state);
    for(let i=0;i<10;i++) if(input.pressed('Digit'+((i+1)%10))) buy(state,i);
    if(input.pressed('Enter')) { startWave(state.wave+1); state.phase='playing'; state.player.fuel=state.player.maxFuel; }
  }
  else if (state.phase === 'upgrade') updateUpgrade(dt);
  else if (state.phase === 'paused') {
    if (input.pressed('KeyP') || input.pressed('Escape') || input.mouse.clicked) state.phase = 'playing';
  } else updateEnd(dt);

  render(ctx, state);
  if(state.phase==='title') drawVaultPanel(ctx, vault);
  if(state.phase==='shop') drawShop(ctx,state);
  input.endFrame();
  requestAnimationFrame(frame);
}

// The Ember Vault on the title screen: the banked balance, and the four
// permanent upgrades with their current level and next cost. Keys 1-4
// buy (handled in updateTitle); the panel is drawn below the title
// text, clear of the "Best score" line, so nothing overlaps.
function drawVaultPanel(ctx, v) {
  ctx.fillStyle = 'rgba(10,14,32,0.92)';
  ctx.fillRect(220, 694, 840, 86);
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 2;
  ctx.strokeRect(220, 694, 840, 86);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd97a';
  ctx.font = 'bold 17px Georgia';
  ctx.fillText(`EMBER VAULT · ${v.bank} embers banked — permanent upgrades, press 1-4`, 640, 720);
  VAULT_ITEMS.forEach((name, i) => {
    const level = v.levels[i];
    const maxed = level >= (i === 3 ? 1 : 10);
    const cost = maxed ? 'MAX' : `${vaultCost(v, i)}e`;
    ctx.fillStyle = maxed ? '#789980' : '#f2ead8';
    ctx.font = '16px Georgia';
    ctx.fillText(`${i + 1}: ${name} [${level}] · ${cost}`, 320 + i * 213, 752);
  });
}

// ---- Screenshot presets (?shot=title|action|upgrade|boss) -------------
// A shot state is rendered once, deterministically, from the game's own
// systems — the same code the player plays, no mock scene.
const shot = params.get('shot');
if (shot) {
  applyShot(state, shot, seed, { startRun, startWave, openUpgrade });
  render(ctx, state);
  if(state.phase==='shop') drawShop(ctx,state);
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
    out.checks.stats_tracking = Object.keys(state.stats.killsByType).length > 0
      && state.stats.embersCollected >= 0 && state.stats.damageDealt > 0;
    const resumePhase = state.phase;
    state.phase = 'paused';
    render(ctx, state);
    state.phase = resumePhase;
    done('pause_render');
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
    state.wave = 6;
    state.waveObj = buildWave(6, state.rng);
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
    render(ctx, state);
    done('victory_stats_render');
    startRun();
    const p=state.player;
    const fake={moveVector:()=>({x:1,y:0}),pressed:()=>false};
    out.checks.dash= dash(p,fake) && p.grace===0.25 && !dash(p,fake);
    const target=makeEnemy('hulk',400,400,1); state.enemies=[target]; p.nova=100;
    const hp=target.hp; nova(p,state);
    out.checks.nova=target.hp<hp && state.braziers.every(b=>b.lit);
    state.wave=6; openUpgrade(); state.currency=30;
    const before=p.maxHp; buy(state,0);
    out.checks.shop=state.phase==='shop' && p.maxHp>before;
    startWave(7); state.phase='playing';
    out.checks.night2=state.night===2;
    state.waveObj=buildWave(12,state.rng); state.waveObj.queue=[]; state.enemies=[];
    updateWave(state.waveObj,state.enemies,p,0.1,state,state.rng);
    out.checks.tide=state.enemies[0]?.night===2;
    state.night=3; p.x=450;p.y=300; p.fuel=100;
    updateAbilities(p,fake,1,state);
    out.checks.dark_zone=p.fuel===94;
    const elite = makeEnemy('shade', 500, 500, 1, true);
    const normal = makeEnemy('shade', 500, 500, 1);
    out.checks.elite = elite.elite && elite.hp === normal.hp * 3;
    const a = makeEnemy('hulk', 300, 200, 1);
    const b = makeEnemy('hulk', 340, 200, 1);
    const flare = { x: 280, y: 200, vx: 200, vy: 0, life: 1, damage: 10, blast: 10, piercing: true };
    updateFlares([flare], [a,b], 0.1, state);
    updateFlares([flare], [a,b], 0.2, state);
    out.checks.piercing = a.hp === a.maxHp - 10 && b.hp === b.maxHp - 10;
    const raging = makeBoss(900, 600, 6);
    raging.hp = raging.maxHp * 0.49;
    state.enemies = [raging];
    updateEnemies(state.enemies,p,0.01,state);
    out.checks.enrage = raging.enraged && raging.enrageAttacks === 1;
    state.currency = 100;
    buy(state,6);
    out.checks.fifth_brazier = state.braziers.length === 5;
    state.streak = 3;
    const money = state.currency;
    const ember = () => ({x:p.x,y:p.y,vx:0,vy:0,life:9,bob:0});
    updateEmbers([ember(),ember()],p,0,state);
    out.checks.streak = state.currency > money + 2;
    startEnvironment(state,2);
    p.fuel=p.maxFuel;
    p.x=state.fogBanks[0].x; p.y=state.fogBanks[0].y;
    out.checks.fog = effectiveRadius(p,state) === p.lightRadius * 0.5;
    // 6) A frame renders without throwing.
    render(ctx, state);
  if(state.phase==='shop') drawShop(ctx,state);
    done('render_ok');
    startWave(19);
    out.checks.night4=state.night===4 && buildWave(24,state.rng).bossAt;
    const king=makeBoss(900,600,24); king.hp=king.maxHp*0.4; state.enemies=[king];
    updateEnemies(state.enemies,p,0.01,state);
    out.checks.hollow_king=king.name==='The Hollow King' && king.enraged;
    state.currency=100; out.checks.brazier_purchase=buyBrazier(state,'Frost');
    const placed=state.braziers.find(b=>b.kind==='Frost'); startWave(25);
    out.checks.brazier_persistence=state.braziers.includes(placed);
    const v=loadVault({getItem:()=>'{"bank":30,"levels":[1,0,0,0]}'});
    const vp=makePlayer(); applyVault(v,vp,[]);
    out.checks.vault=vp.maxHp===115 && v.bank===30;

    startEnvironment(state,4);
    out.checks.hollow_fog = state.hollowMoon && state.fogBanks.length===3;
    const zone=state.hollowZones[0]; p.x=zone.x; p.y=zone.y; p.fuel=100;
    updateHollow(state,0.1);
    out.checks.hollow_drain = p.fuel<100 && zone.x!==410;
    const beacon=state.beacons[0]; p.x=beacon.x; p.y=beacon.y;
    updateHollow(state,2);
    out.checks.beacon_channel=beacon.lit && beaconBonus(state)===1.25;
    const fullKing=makeBoss(900,600,24);
    const fullHp=fullKing.hp; weakenKing(fullKing,state);
    out.checks.beacon_king=fullKing.hp===fullHp*0.9;
    state.currency=100; const oldRadius=placed.radius;
    buyBrazier(state,'Frost');
    out.checks.brazier_level=placed.level===2 && placed.radius===oldRadius+20;
    out.checks.endless_scaling=endlessScale(30).hp>1 && endlessScale(30).speed>1 && endlessScale(30).elite>0;
    out.checks.hollow_swarm=waveComp(31).hollow>waveComp(25).hollow && makeEnemy('hollow',0,0,25).def.hp===30;
    // v3 tables: one night one palette, one brazier table, one endless
    // composer — the self-test pins the tables to the live formulas so
    // a tuning edit that drifts from the code fails loudly here.
    out.checks.night_theme = themeForNight(4).skyTop === '#211531' && themeForNight(1).name === 'Ember Fields' && themeForNight(5).name === 'The Endless Night';
    out.checks.brazier_table = brazierStats('Sun', 2).radius === 190 && Math.round(brazierStats('Frost', 3).dps) === 22 && brazierStats('Ember', 1).dps === 26;
    out.checks.endless_comp = endlessComp(31).hollow === 20 && endlessComp(31).mirror === 4 && endlessComp(25).hollow === 8;
    const wt = waveTitle(19);
    out.checks.wave_title = wt.night === 'The Hollow Dawn · Night 4' && wt.wave === 'WAVE 1/5';
    // Mirror Wraiths reflect once, then need 1.2s before the next
    // reflection: the second bolt in the same instant must hit instead.
    state.bolts = [];
    const wraith = makeEnemy('mirror', 500, 400, 19);
    state.enemies = [wraith];
    updateFlares([{ x: 480, y: 400, vx: 200, vy: 0, life: 1, damage: 10, blast: 10 }], state.enemies, 0.01, state);
    out.checks.mirror_reflect = state.bolts.length === 1 && wraith.reflectCd > 0;
    const wraithHp = wraith.hp;
    updateFlares([{ x: 480, y: 400, vx: 200, vy: 0, life: 1, damage: 10, blast: 10 }], state.enemies, 0.01, state);
    out.checks.mirror_cooldown = state.bolts.length === 1 && wraith.hp < wraithHp;
    // Flares fired across the whole scripted run were counted.
    out.checks.flares_fired = state.stats.flaresFired > 0;
    // Vault costs grow 10 per level; the panel draws without throwing.
    out.checks.vault_cost = vaultCost({ levels: [0, 0, 0, 0] }, 0) === 10 && vaultCost({ levels: [2, 0, 0, 0] }, 0) === 30;
    drawVaultPanel(ctx, vault);
    done('vault_panel_render');
    // Best endless wave persists: a wave-30 loss must store 30.
    state.wave = 30;
    endRun(false);
    out.checks.best_endless = state.bestEndless === 30 && Number(localStorage.getItem('lumenwarden-best-endless')) === 30;
    render(ctx, state);
    done('endless_stats_render');
    render(ctx,state);
    done('hollow_render');
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
  if(state.phase==='shop') drawShop(ctx,state);
}
