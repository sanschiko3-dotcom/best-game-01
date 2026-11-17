// SPDX-License-Identifier: MIT
// LUMENWARDEN — entities.js
// One job: everything that lives, moves and collides in the arena —
// the Warden, the shadows, flare bolts, enemy bolts, embers, braziers
// and particles — and the rules that bind them (light burns shadows,
// fuel feeds the lantern, contact hurts the Warden).

import {
  VIEW, PLAYER, ENEMIES, BOSS, BRAZIERS, BRAZIER_LIGHT_COST,
  BRAZIER_BURN_DPS, BRAZIER_HEAL, EMBER_FUEL, EMBER_SCORE, COMBO_WINDOW,
  bossNameForNight, brazierStats,
} from './config.js';
import { breakAllMirrors, lineDistance } from './prism.js';
import { relicBonus } from './relics.js';
import { makeRng } from './random.js';
let entityRng=makeRng(73);
export function setEntityRng(rng){entityRng=rng;}
import { sfx } from './audio.js';
import { endlessScale } from './config.js';
import { startHollow, updateHollow, brazierDps } from './hollow.js';

export function makePlayer() {
  return {
    x: VIEW.w / 2, y: VIEW.h / 2 + 60, vx: 0, vy: 0,
    radius: PLAYER.radius, hp: PLAYER.maxHp, fuel: PLAYER.maxFuel,
    aim: -Math.PI / 2, flareTimer: 0, grace: 0, dead: false,
    // Upgradeable stats; upgrades.js mutates these fields.
    lightRadius: PLAYER.lightRadius, burnDps: PLAYER.burnDps,
    flareDamage: PLAYER.flareDamage, flareBlast: PLAYER.flareBlast,
    speedMul: 1, fuelDrainMul: 1, pickupMul: 1, twinFlare: false,
    walkPhase: 0, maxHp:100, maxFuel:100, dashCooldown:0, dashTime:0, dashDelay:2.5, nova:0, novaGain:1, healMul:1, pierce:0,
  };
}

export function makeBraziers() {
  return BRAZIERS.map((b) => ({ ...b }));
}

let enemyId = 0;

export function makeEnemy(type, x, y, wave, elite = false) {
  const def = ENEMIES[type];
  const scale = { hp: 1 + 0.12 * (wave - 1), speed: 1 + 0.04 * (wave - 1) };
  scale.hp *= endlessScale(wave).hp;
  scale.speed *= endlessScale(wave).speed;
  return {
    id: ++enemyId, elite, type, x, y, def,
    hp: def.hp * scale.hp * (elite ? 3 : 1),
    maxHp: def.hp * scale.hp * (elite ? 3 : 1),
    speed: def.speed * scale.speed * (0.9 + entityRng.next() * 0.2),
    radius: def.radius * (elite ? 1.18 : 1), damage: def.damage,
    vx: 0, vy: 0, wobble: entityRng.next() * Math.PI * 2,
    shootTimer: 1 + entityRng.next() * 1.5, hitFlash: 0, burnTick: 0,
    boss: false,
  };
}

export function makeBoss(x, y, wave) {
  const e = makeEnemy('shade', x, y, wave);
  e.boss = true;
  e.night = Math.ceil(wave / 6);
  e.name = bossNameForNight(e.night);
  e.type = 'boss';
  e.hp = BOSS.hp * (wave >= 10 ? 1.35 : 1);
  e.hp *= 1 + Math.max(0,e.night-3)*0.65;
  if (wave >= 30) {
    e.name = 'The Shattered Regent';
    e.pulse = 12;
    sfx.regentRoar();
    e.shards = 8;
    e.sweep = 4;
    e.sweepTime = 0;
    e.sweepWarn = 0;
  }
  e.maxHp = e.hp;
  e.speed = BOSS.speed;
  e.radius = BOSS.radius;
  e.damage = BOSS.damage;
  e.summonTimer = BOSS.summonEvery;
  e.burstTimer = BOSS.burstEvery;
  return e;
}

export function spawnEmber(list, x, y, rng) {
  list.push({
    x: x + rng.range(-8, 8), y: y + rng.range(-8, 8),
    vx: rng.range(-30, 30), vy: rng.range(-30, 30),
    life: 9, bob: rng.range(0, Math.PI * 2),
  });
}

export function spawnBurst(list, x, y, colour, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = entityRng.next() * Math.PI * 2;
    const s = speed * (0.3 + entityRng.next() * 0.7);
    list.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + entityRng.next() * 0.45, maxLife: 0.85,
      size: 2 + entityRng.next() * 3.5, colour,
    });
  }
}

export function addFloatText(list, x, y, text, colour = '#f2ead8') {
  list.push({ x, y, text, colour, life: 1.1 });
}

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function updatePlayer(p, input, dt, state) {
  updateAbilities(p, input, dt, state);
  // Movement: accelerate toward the input direction, friction otherwise.
  const mv = input.moveVector();
  p.vx += mv.x * PLAYER.accel * dt;
  p.vy += mv.y * PLAYER.accel * dt;
  const fr = Math.exp(-PLAYER.friction * dt);
  p.vx *= fr; p.vy *= fr;
  const max = PLAYER.speed * p.speedMul * ((p.webSlow>0 || (state.webs||[]).some(w=>Math.hypot(w.x-p.x,w.y-p.y)<70))?.55:1) * (p.dashTime > 0 ? 3.8 : 1);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > max) { p.vx = (p.vx / sp) * max; p.vy = (p.vy / sp) * max; }
  p.x = Math.max(28, Math.min(VIEW.w - 28, p.x + p.vx * dt));
  p.y = Math.max(28, Math.min(VIEW.h - 28, p.y + p.vy * dt));
  p.walkPhase += sp * dt * 0.05;
  if(sp>30 && entityRng.next()<dt*22) spawnBurst(state.particles,p.x,p.y,'#ff9a3d',1,25);

  // Aim at the mouse; the lantern points where the player looks.
  p.aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

  // The lantern always burns fuel; an empty lantern means a dark, short light.
  p.fuel = Math.max(0, p.fuel - PLAYER.fuelDrain * p.fuelDrainMul * dt);
  if (p.grace > 0) p.grace -= dt;

  // Fire a flare bolt toward the mouse (hold to keep firing).
  p.flareTimer -= dt;
  if (input.fireHeld() && p.flareTimer <= 0 && p.fuel > 0) {
    p.flareTimer = PLAYER.flareCooldown;
    p.fuel = Math.max(0, p.fuel - PLAYER.flareCost);
    const angles = p.twinFlare ? [-0.14, 0.14] : [0];
    for (const off of angles) {
      state.flares.push({
        x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22,
        vx: Math.cos(p.aim + off) * PLAYER.flareSpeed,
        vy: Math.sin(p.aim + off) * PLAYER.flareSpeed,
        piercing: p.pierce, hits: new Set(),
        damage: p.flareDamage * (state.blazing ? 1.25 : 1), blast: p.flareBlast, life: 1.1,
      });
    }
    sfx.flare();
    spawnBurst(state.particles, p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24, '#ffd97a', 4, 90);
  }

  // Lighting a brazier: stand close and press E; it costs fuel, it pays
  // back as a permanent burning circle for the rest of the run.
  if (input.pressed('KeyE')) {
    for (const b of state.braziers) {
      if (!b.lit && dist(p.x, p.y, b.x, b.y) < 70 && p.fuel >= BRAZIER_LIGHT_COST) {
        b.lit = true;
        p.fuel -= BRAZIER_LIGHT_COST;
        sfx.brazier();
        spawnBurst(state.particles, b.x, b.y, '#ffcf6e', 26, 220);
        addFloatText(state.floats, b.x, b.y - 30, 'BRAZIER LIT', '#ffcf6e');
        state.score += 100;
        break;
      }
    }
  }

  // Standing in a lit brazier's light slowly heals the Warden.
  for (const b of state.braziers) {
    if (b.lit && dist(p.x, p.y, b.x, b.y) < b.radius) {
      p.hp = Math.min(p.maxHp, p.hp + BRAZIER_HEAL * p.healMul * dt);
    }
  }
}

// A Lantern Thief reaching a lit brazier snuffs it: the light dies, the
// brazier flashes red so the player sees the theft, and a warning floats
// up. The brazier keeps its kind and level — relighting it with E costs
// fuel again, but the investment is not lost.
function douseBrazier(b, state) {
  if (!b.lit) return false;
  b.lit = false;
  b.damageFlash = 0.6;
  b.dousedAt = state.t;
  addFloatText(state.floats, b.x, b.y - 52, 'DOUSED!', '#ff426f');
  return true;
}

export function updateEnemies(list, p, dt, state) {
  for (const e of list) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    // A Mirror Wraith can only bend one bolt a little more than once a
    // second: the cooldown is what makes the reflection fair instead of
    // a wall the player can never shoot through.
    e.reflectCd = Math.max(0, (e.reflectCd || 0) - dt);
    const d = dist(e.x, e.y, p.x, p.y);
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    let mx = Math.cos(ang), my = Math.sin(ang);
    if(e.type==='thief') {
      const target=state.braziers.filter(b=>b.lit).sort((a,b)=>dist(e.x,e.y,a.x,a.y)-dist(e.x,e.y,b.x,b.y))[0];
      if(target) { const a=Math.atan2(target.y-e.y,target.x-e.x); mx=Math.cos(a); my=Math.sin(a);
        if(dist(e.x,e.y,target.x,target.y)<35) douseBrazier(target, state);
      }
    }
    // Frost braziers chill everything inside their circle. The slow
    // deepens with the brazier's level, so a level-3 Frost Brazier is
    // a real wall: shadows crawl at barely a third of their speed.
    for(const b of state.braziers) {
      if (!b.lit || b.kind !== 'Frost') continue;
      if (dist(e.x, e.y, b.x, b.y) >= b.radius) continue;
      const slow = brazierStats('Frost', b.level || 1).slow;
      mx *= slow; my *= slow;
    }


    if (e.type === 'wisp') {
      // Wisps dart in a sine wobble, hard to lead with a flare.
      e.wobble += dt * 6;
      const perp = ang + Math.PI / 2;
      mx += Math.cos(perp + e.wobble) * 0.7;
      my += Math.sin(perp + e.wobble) * 0.7;
      const m = Math.hypot(mx, my); mx /= m; my /= m;
    } else if (e.type === 'spitter') {
      // Spitters keep their distance and shoot bolts of dark.
      if (d < 220) { mx = -mx; my = -my; }
      else if (d < e.def.shootRange) { mx = 0; my = 0; }
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < e.def.shootRange) {
        e.shootTimer = e.def.shootCooldown;
        state.bolts.push({
          x: e.x, y: e.y,
          vx: Math.cos(ang) * e.def.boltSpeed, vy: Math.sin(ang) * e.def.boltSpeed,
          radius: 7, damage: e.def.damage, life: 4,
        });
        sfx.hit();
      }
    } else if (e.boss) {
      // The Gloam King summons shades and fires radial bursts.
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = BOSS.summonEvery;
        for (let i = 0; i < 3; i++) {
          const a = entityRng.next() * Math.PI * 2;
          list.push(makeEnemy('shade', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, state.wave));
        }
        spawnBurst(state.particles, e.x, e.y, '#ff4d6d', 18, 200);
      }
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burstTimer = BOSS.burstEvery;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          state.bolts.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * BOSS.boltSpeed, vy: Math.sin(a) * BOSS.boltSpeed,
            radius: 8, damage: 12, life: 5,
          });
        }
        sfx.bossRoar();
      }
    }

    const lit = Math.hypot(e.x-p.x,e.y-p.y) < effectiveRadius(p,state) || state.braziers.some(b=>b.lit && Math.hypot(e.x-b.x,e.y-b.y)<b.radius);
    e.hidden = e.type === 'stalker' && !lit;
    if(e.type === 'stalker' && lit) { mx *= 0.4; my *= 0.4; }
    if(e.boss && e.night > 1) bossRitual(e,p,dt,state);
    if (p.frost && d < effectiveRadius(p, state)) { mx *= 0.75; my *= 0.75; }
    if (e.boss) updateEnrage(e, dt, state);
    e.x += mx * e.speed * dt;
    e.y += my * e.speed * dt;
    e.x = Math.max(16, Math.min(VIEW.w - 16, e.x));
    e.y = Math.max(16, Math.min(VIEW.h - 16, e.y));

    // Light burns: enemies inside the lantern's glow (or a lit brazier)
    // take steady damage. This is the game's central rule — light is
    // the weapon, and standing your ground in the glow is a strategy.
    const inLantern = dist(e.x, e.y, p.x, p.y) < effectiveRadius(p,state);
    let inBrazier = false;
    for (const b of state.braziers) {
      if (b.lit && dist(e.x, e.y, b.x, b.y) < b.radius) { inBrazier = true; break; }
    }
    if (inLantern || inBrazier) {
      const dps = inBrazier ? Math.max(p.burnDps, ...state.braziers.filter(b=>b.lit && dist(e.x,e.y,b.x,b.y)<b.radius).map(b=>brazierDps(b,state))) : p.burnDps;
      applyDamage(e, dps * dt * relicBonus(state, 'burnMul'), state);
      e.burnTick += dt;
      if (e.burnTick > 0.25) {
        e.burnTick = 0;
        spawnBurst(state.particles, e.x, e.y - e.radius * 0.5, '#ffb347', 2, 60);
      }
    }

    // Contact damage, with a grace window so one touch is not a stunlock.
    if (d < e.radius + p.radius && p.grace <= 0 && !p.dead) {
      if(e.type === 'siphon') { p.fuel=Math.max(0,p.fuel-8); e.hp=Math.min(e.maxHp,e.hp+18); }
      p.hp -= e.damage;
      p.grace = PLAYER.contactGrace;
      state.shake = Math.min(14, state.shake + 7);
      sfx.hurt();
      spawnBurst(state.particles, p.x, p.y, '#ff5d6c', 10, 180);
      if (p.hp <= 0) { p.hp = 0; p.dead = true; }
    }
  }
}

export function updateFlares(list, enemies, dt, state) {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    // Count each flare once, the first frame it is simulated, so the
    // run report can say how many shots the Warden actually fired.
    if (!f.counted) { f.counted = true; state.stats.flaresFired = (state.stats.flaresFired || 0) + 1; }
    f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
    const mirror=enemies.find(e=>e.hp>0 && e.type==='mirror' && !(e.reflectCd>0) && dist(f.x,f.y,e.x,e.y)<e.radius+8);
    if(mirror) { const a=Math.atan2(state.player.y-mirror.y,state.player.x-mirror.x);
      mirror.reflectCd = 1.2;
      state.bolts.push({x:mirror.x,y:mirror.y,vx:Math.cos(a)*320,vy:Math.sin(a)*320,radius:7,damage:15,life:4});
      list.splice(i,1); continue;
    }
    f.hits ||= new Set();
    if (f.piercing) {
      for (const e of enemies) {
        if (!f.hits.has(e.id) && dist(f.x, f.y, e.x, e.y) < e.radius + 8) {
          f.hits.add(e.id);
          applyDamage(e, f.damage, state);
          e.hitFlash = 0.12;
        }
      }
    }
    let boom = f.life <= 0 || f.x < 0 || f.x > VIEW.w || f.y < 0 || f.y > VIEW.h;
    if (f.piercing) boom = f.life <= 0;
    if (!boom && !f.piercing) {
      for (const e of enemies) {
        if (dist(f.x, f.y, e.x, e.y) < e.radius + 8) { boom = true; break; }
      }
    }
    if (boom) {
      // A flare bursts: everything in its blast radius takes damage.
      spawnBurst(state.particles, f.x, f.y, '#ffd97a', 16, 260);
      state.flash = Math.min(0.5, state.flash + 0.18);
      for (const e of enemies) {
        const d = dist(f.x, f.y, e.x, e.y);
        if (d < f.blast + e.radius && !f.hits.has(e.id)) {
          applyDamage(e, f.damage * (d < f.blast * 0.5 ? 1.25 : 1), state);
          e.hitFlash = 0.12;
        }
      }
      list.splice(i, 1);
    }
  }
}

export function updateBolts(list, p, dt, state) {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > VIEW.w || b.y < 0 || b.y > VIEW.h) {
      list.splice(i, 1);
      continue;
    }
    if (dist(b.x, b.y, p.x, p.y) < b.radius + p.radius && p.grace <= 0 && !p.dead) {
      if (b.webSlow) p.webSlow = b.webSlow;
      p.hp -= b.damage;
      p.grace = PLAYER.contactGrace;
      sfx.hurt();
      spawnBurst(state.particles, p.x, p.y, '#c86bff', 8, 160);
      if (p.hp <= 0) { p.hp = 0; p.dead = true; }
      list.splice(i, 1);
    }
  }
}

export function updateEmbers(list, p, dt, state) {
  for (let i = list.length - 1; i >= 0; i--) {
    const em = list[i];
    em.life -= dt;
    em.bob += dt * 4;
    em.x += em.vx * dt; em.y += em.vy * dt;
    em.vx *= 0.92; em.vy *= 0.92;
    if (em.life <= 0) { list.splice(i, 1); continue; }
    const d = dist(em.x, em.y, p.x, p.y);
    const magnet = PLAYER.pickupRadius * p.pickupMul;
    if (d < magnet * 3.2) {
      // Embers drift toward the Warden when close: collecting them is
      // how the lantern stays lit, so the player chases the drops.
      const a = Math.atan2(p.y - em.y, p.x - em.x);
      em.x += Math.cos(a) * 260 * dt;
      em.y += Math.sin(a) * 260 * dt;
    }
    if (d < p.radius + 12) {
      state.stats.embersCollected += 1;
      p.fuel = Math.min(p.maxFuel, p.fuel + EMBER_FUEL);
      state.streak = (state.streak || 0) + 1;
      state.streakTimer = 2.5 + (p.greed ? 1.5 : 0);
      const bonus = Math.min(4, Math.floor(state.streak / 4));
      state.currency = (state.currency || 0) + 1 + bonus
        + (p.greed ? Math.floor(state.streak / 3) : 0);
      state.score += EMBER_SCORE * state.multiplier;
      sfx.pickup();
      spawnBurst(state.particles, em.x, em.y, '#ff9a3d', 5, 110);
      list.splice(i, 1);
    }
  }
}

export function updateParticles(list, floats, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const pt = list[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
    pt.life -= dt;
    if (pt.life <= 0) list.splice(i, 1);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].y -= 34 * dt;
    floats[i].life -= dt;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }
}

// Sweep dead enemies out of the list, paying score, embers and combo.
export function reapDead(enemies, embers, particles, floats, state, rng) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp > 0) continue;
    enemies.splice(i, 1);
    if(e.type === 'splitter') for(let k=0;k<2;k++) enemies.push(makeEnemy('wisp',e.x+k*24,e.y,state.wave));
    state.player.nova=Math.min(100,state.player.nova+(4+state.multiplier)*state.player.novaGain);
    state.stats.killsByType[e.type] = (state.stats.killsByType[e.type] || 0) + 1;
    state.kills += 1;
    state.player.fuel = Math.min(state.player.maxFuel,
      state.player.fuel + relicBonus(state, 'fuelOnKill'));
    state.comboTimer = COMBO_WINDOW;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.multiplier = Math.min(5, state.combo);
    const gained = (e.boss ? BOSS.score : e.def.score) * state.multiplier * (e.elite ? 2 : 1);
    state.score += gained;
    addFloatText(floats, e.x, e.y - e.radius, `+${gained}`, '#ffd97a');
    spawnBurst(particles, e.x, e.y, e.boss ? '#ff4d6d' : '#ffb347', e.boss ? 40 : 12, e.boss ? 320 : 200);
    if (e.boss) {
      state.stats.bossesDown += 1;
      state.defeatedBosses.push({ night: e.night, name: e.name });
      state.bossDown = true;
      state.shake = 18;
      sfx.kill();
      addFloatText(floats, e.x, e.y - 60, `${e.name} FALLS`, '#ff4d6d');
      for (let k = 0; k < 5; k++) spawnEmber(embers, e.x, e.y, rng);
    } else if (e.elite) {
      for (let k = 0; k < 3; k++) spawnEmber(embers, e.x, e.y, rng);
    } else if (rng.chance(e.def.emberChance)) {
      spawnEmber(embers, e.x, e.y, rng);
    }
    sfx.kill();
  }
}

export function effectiveRadius(p,s) {
  return p.lightRadius * (0.25+0.75*p.fuel/p.maxFuel) * ((s.fogBanks || []).some(b => dist(p.x,p.y,b.x,b.y) < b.radius) ? 0.5 : 1);
}
export function dash(p,input,state) {
  if(p.dashCooldown>0 || p.fuel<4) return false;
  const m=input.moveVector();
  const a=m.x||m.y?Math.atan2(m.y,m.x):p.aim;
  p.vx=Math.cos(a)*1000;
  p.vy=Math.sin(a)*1000;
  p.dashTime=0.25;
  p.grace=Math.max(p.grace,0.25);
  p.dashCooldown=p.dashDelay;
  p.fuel-=4;
  if (state) state.stats.dashes += 1;
  sfx.dash();
  return true;
}
export function nova(p,s) {
  if(p.nova<100) return false;
  s.stats.novaCasts += 1;
  p.nova=0;
  sfx.nova();
  for(const e of s.enemies) { applyDamage(e,180,s); e.hitFlash=0.4; }
  for(const b of s.braziers) b.lit=true;
  s.bolts=[];
  s.flash=1;
  s.shake=18;
  spawnBurst(s.particles,p.x,p.y,'#fff1ac',90,900);
  return true;
}
export const DARK_ZONES = [
 {x:450,y:300,r:100},{x:850,y:520,r:110},{x:680,y:170,r:75}
];
export function updateAbilities(p,input,dt,s) {
  updateEnvironment(s, dt);
  p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  p.dashTime=Math.max(0,p.dashTime-dt);
  if(input.pressed('ShiftLeft')||input.pressed('ShiftRight')||input.pressed('Dash')) dash(p,input,s);
  if(input.pressed('KeyQ')||input.pressed('Space')) nova(p,s);
  s.trails ||= [];
  if(p.dashTime>0) s.trails.push({x:p.x,y:p.y,life:0.65});
  for(const t of s.trails) {
    t.life-=dt;
    for(const e of s.enemies) if(Math.hypot(t.x-e.x,t.y-e.y)<45) applyDamage(e,55*dt,s);
  }
  s.trails=s.trails.filter(t=>t.life>0);
  if(s.night===3 && DARK_ZONES.some(z=>Math.hypot(p.x-z.x,p.y-z.y)<z.r)) p.fuel=Math.max(0,p.fuel-6*dt);
}
function bossRitual(e,p,dt,s) {
  e.ritual=(e.ritual||0)+dt;
  if(e.ritual<5) return;
  e.ritual=0;
  if(e.night===2) {
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      s.enemies.push(makeEnemy('wisp',e.x+Math.cos(a)*120,e.y+Math.sin(a)*120,s.wave));
    }
    p.vx+=(p.x<e.x?-600:600);
    p.x=Math.max(28,Math.min(1252,p.x+(p.x<e.x?-90:90)));
    s.fogWave=1;
  } else {
    const b=s.braziers[Math.floor(s.rng.range(0,3.99))];
    e.x=b.x; e.y=b.y; b.lit=false;
    s.enemies.push(makeEnemy('splitter',e.x,e.y,s.wave));
  }
}

// Phase two has its own repeating attack clock, independent of rituals.
function updateEnrage(e, dt, state) {
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    e.speed *= 1.4;
    e.enrageTimer = 0;
    state.redFlash = 0.7;
    state.banner = {
      text: e.night>=4?'THE HOLLOW KING RAGES':['THE GLOAM KING RAGES', 'THE TIDE RAGES', 'THE QUEEN RAGES'][e.night - 1],
      sub: 'The crown breaks. Keep moving.',
      t: 3,
    };
    sfx.enrage();
  }
  if (!e.enraged) return;
  e.enrageTimer -= dt;
  if (e.enrageTimer > 0) return;
  e.enrageTimer = e.night>=4?3:6;
  if(e.night>=4) { state.enemies.push(makeEnemy('mirror',e.x+50,e.y,state.wave),makeEnemy('thief',e.x-50,e.y,state.wave)); state.shake=12; }
  e.enrageAttacks = (e.enrageAttacks || 0) + 1;
  if (e.night === 1) {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      state.bolts.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260,
        radius: 9, damage: 16, life: 5,
      });
    }
  } else if (e.night === 2) {
    for (const radius of [80, 170]) {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        state.enemies.push(makeEnemy('wisp',
          e.x + Math.cos(angle) * radius,
          e.y + Math.sin(angle) * radius, state.wave));
      }
    }
  } else {
    e.teleportsLeft = 2;
    e.teleportTimer = 0;
  }
}

// Fog and cursed ground belong to a night, rather than a wave.
export function startEnvironment(state, night) {
  state.hollowMoon = false;
  state.hollowZones = [];
  state.fogBanks = night === 2 ? [
    { x: 230, y: 240, radius: 150, vx: 16, vy: 8 },
    { x: 640, y: 480, radius: 155, vx: -12, vy: 10 },
    { x: 1050, y: 250, radius: 145, vx: -9, vy: -14 },
  ] : [];
  state.darkZones = night === 3
    ? DARK_ZONES.map(z => ({ ...z, timer: 12 })) : [];
  if (night >= 4) startHollow(state);
}

function updateEnvironment(state, dt) {
  updateHollow(state, dt);
  for (const bank of state.fogBanks || []) {
    bank.x += bank.vx * dt;
    bank.y += bank.vy * dt;
    if (bank.x > VIEW.w + bank.radius) bank.x = -bank.radius;
    if (bank.x < -bank.radius) bank.x = VIEW.w + bank.radius;
    if (bank.y > VIEW.h + bank.radius) bank.y = -bank.radius;
    if (bank.y < -bank.radius) bank.y = VIEW.h + bank.radius;
  }
  for (const patch of state.darkZones || []) {
    patch.timer -= dt;
    if (patch.timer > 0) continue;
    patch.timer = 12;
    const living = state.enemies.filter(e => e.patch === patch && e.hp > 0);
    if (living.length >= 2) continue;
    if (dist(state.player.x, state.player.y, patch.x, patch.y) <= 300) continue;
    const shade = makeEnemy('shade', patch.x, patch.y, state.wave);
    shade.patch = patch;
    state.enemies.push(shade);
  }
  for (const boss of state.enemies) {
    if (!boss.teleportsLeft) continue;
    boss.teleportTimer -= dt;
    if (boss.teleportTimer > 0) continue;
    spawnBurst(state.particles, boss.x, boss.y, '#c86bff', 24);
    boss.x = 100 + entityRng.next() * (VIEW.w - 200);
    boss.y = 100 + entityRng.next() * (VIEW.h - 200);
    boss.teleportsLeft--;
    boss.teleportTimer = 0.3;
    for (let i = 0; i < 2; i++) {
      state.enemies.push(makeEnemy('splitter', boss.x + i * 35, boss.y, state.wave));
    }
  }
}

// Count effective damage, excluding overkill and already fallen shadows.
export function applyDamage(enemy, amount, state) {
  state.stats.damageDealt += Math.min(Math.max(0, enemy.hp), amount);
  enemy.hp -= amount;
  if(enemy.boss && amount>1) state.shake=Math.max(state.shake,5);
}

// Prism enemies keep their clocks on the entity, independently of movement.
export function webweaverLayWeb(e, state, dt) {
  const p = state.player;
  e.webTimer = (e.webTimer ?? 4) - dt;
  if (e.webTimer <= 0) {
    state.webs.push({ x: p.x, y: p.y, life: 6 });
    e.webTimer = 4;
  }
  if (Math.hypot(e.x - p.x, e.y - p.y) < 70) p.webSlow = 2;
  e.webShotTimer = (e.webShotTimer ?? 2) - dt;
  if (e.webShotTimer > 0) return;
  const angle = Math.atan2(p.y - e.y, p.x - e.x);
  state.bolts ||= [];
  state.bolts.push({
    x: e.x,
    y: e.y,
    vx: Math.cos(angle) * 220,
    vy: Math.sin(angle) * 220,
    radius: 7,
    damage: 0,
    webSlow: 2,
    life: 4,
  });
  e.webShotTimer = 2;
}

export function fuelmiteFuse(e, state, dt) {
  const p = state.player;
  const distance = Math.hypot(e.x - p.x, e.y - p.y);
  if (distance >= 26 && e.fuse === undefined) return;
  if (e.fuse === undefined) sfx.fuelmiteFuse();
  e.fuse = (e.fuse ?? 0.5) - dt;
  e.flash = 0.5 + 0.5 * Math.cos(e.fuse * 40);
  if (e.fuse > 0) return;
  if (distance < 70) {
    p.hp -= 14;
    p.fuel = Math.max(0, p.fuel - 12);
  }
  e.hp = 0;
  spawnBurst(state.particles, e.x, e.y, '#ffe278', 20);
}

export function regentAttacks(e, state, dt) {
  const p = state.player;
  e.pulse = (e.pulse ?? 12) - dt;
  e.shards = (e.shards ?? 8) - dt;
  e.sweep = (e.sweep ?? 4) - dt;
  if (e.pulse <= 0) {
    breakAllMirrors(state);
    e.pulse = 12;
  }
  if (e.shards <= 0) {
    const types = ['fuelmite', 'fuelmite', 'webweaver'];
    for (const [i, type] of types.entries()) {
      state.enemies.push(makeEnemy(type, e.x + 50 * i, e.y + 60, state.wave));
    }
    e.shards = 8;
  }
  if (e.sweep > 0) return;
  e.sweepTime = (e.sweepTime || 0) + dt;
  e.sweepWarn = Math.max(0, 0.8 - e.sweepTime);
  e.sweepAngle = (e.sweepAngle ?? Math.atan2(p.y - e.y, p.x - e.x)) + dt * 0.65;
  const end = {
    x: e.x + Math.cos(e.sweepAngle) * 1100,
    y: e.y + Math.sin(e.sweepAngle) * 1100,
  };
  if (e.sweepTime > 0.8 && lineDistance(p, e, end) < 26) {
    p.hp -= 22 * dt;
  }
  if (e.sweepTime > 3) {
    e.sweep = 5;
    e.sweepTime = 0;
    e.sweepWarn = 0;
    e.sweepAngle = undefined;
  }
}
