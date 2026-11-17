import { BEAM } from './config.js';
// SPDX-License-Identifier: MIT
import {
  applyDamage, spawnBurst, webweaverLayWeb, fuelmiteFuse, regentAttacks,
} from './entities.js';
import { relicBonus, updateRelics } from './relics.js';
import { sfx } from './audio.js';

const BEAM_LENGTH = BEAM.length;
const BEAM_WIDTH = BEAM.width;
const BEAM_BASE_DPS = BEAM.baseDps;
const MIRROR_HP = BEAM.mirrorHp;
const BASE_BOUNCES = BEAM.baseBounces;

// Mirror placement and upgrades.
export function capacity(state) {
  const p = state.player;
  return 1 + (p.mirrorRack || 0) + (p.prismShard || 0)
    + relicBonus(state, 'extraMirror');
}

export function beamDps(state) {
  const p = state.player;
  return BEAM_BASE_DPS * (1 + (p.glass || 0) * BEAM.dpsPerGlass)
    * (p.beamMul || 1) * relicBonus(state, 'beamMul');
}

export function beamLength(state) {
  return BEAM_LENGTH + (state.player.pivot || 0) * BEAM.lengthPerPivot + (state.player.beamLengthBonus || 0);
}

export function placeMirror(state) {
  state.mirrors ||= [];
  if (state.mirrors.length >= capacity(state)) return false;
  const p = state.player;
  state.mirrors.push({
    x: p.x,
    y: p.y,
    angle: p.aim + Math.PI / 4,
    hp: MIRROR_HP,
  });
  state.stats.mirrorsPlaced = (state.stats.mirrorsPlaced || 0) + 1;
  sfx.mirrorPlace();
  return true;
}

export function nearestMirror(state) {
  const p = state.player;
  let nearest;
  let distance = Infinity;
  for (const mirror of state.mirrors || []) {
    const candidate = Math.hypot(mirror.x - p.x, mirror.y - p.y);
    if (candidate < distance) {
      nearest = mirror;
      distance = candidate;
    }
  }
  return nearest;
}

export function rotateMirror(state) {
  const mirror = nearestMirror(state);
  if (mirror) mirror.angle += Math.PI / 4;
}

// Beam geometry keeps a shared length budget across reflections.
export function lineDistance(enemy, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1,
    ((enemy.x - a.x) * dx + (enemy.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(enemy.x - a.x - t * dx, enemy.y - a.y - t * dy);
}

export function traceBeam(state) {
  const p = state.player;
  state.beam = [];
  let a = { x: p.x, y: p.y };
  let angle = p.aim;
  let left = beamLength(state);
  let last = null;
  const bounces = BASE_BOUNCES + relicBonus(state, 'extraBounce');
  for (let bounce = 0; bounce <= bounces; bounce++) {
    let hit = null;
    let near = left;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (const mirror of state.mirrors) {
      if (mirror === last) continue;
      const ux = Math.cos(mirror.angle);
      const uy = Math.sin(mirror.angle);
      const den = dx * uy - dy * ux;
      if (Math.abs(den) < 0.001) continue;
      const rx = mirror.x - a.x;
      const ry = mirror.y - a.y;
      const t = (rx * uy - ry * ux) / den;
      const u = (rx * dy - ry * dx) / den;
      if (t > 1 && t < near && Math.abs(u) < 30) {
        near = t;
        hit = mirror;
      }
    }
    const b = { x: a.x + dx * near, y: a.y + dy * near };
    state.beam.push([a, b]);
    left -= near;
    if (!hit || left <= 0) break;
    angle = 2 * hit.angle - angle;
    a = b;
    last = hit;
  }
  return state.beam;
}

export function damageAlongBeam(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const touching = state.beam.some(([a, b]) =>
      lineDistance(enemy, a, b) < BEAM_WIDTH + enemy.radius);
    if (touching) applyDamage(enemy, beamDps(state) * dt, state);
  }
}

// Arena hazards run once per prism tick, including in headless play.
export function smashMirrors(state) {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.type !== 'hulk') continue;
    state.mirrors = state.mirrors.filter(mirror => {
      if (Math.hypot(mirror.x - enemy.x, mirror.y - enemy.y) > enemy.radius + 20) {
        return true;
      }
      spawnBurst(state.particles, mirror.x, mirror.y, '#baf5ff', 12);
      sfx.mirrorBreak();
      return false;
    });
  }
}

export function breakAllMirrors(state, reason = 'MIRRORS SHATTER') {
  state.mirrors = [];
  state.pulseRing = 1;
  sfx.mirrorBreak();
  state.banner = { text: reason, sub: 'Rebuild the light', t: 2 };
}

export function updateWebs(state, dt) {
  const p = state.player;
  p.webSlow = Math.max(0, (p.webSlow || 0) - dt);
  state.webs = state.webs.filter(web => (web.life -= dt) > 0);
  for (const web of state.webs) {
    if (Math.hypot(web.x - p.x, web.y - p.y) < 70) p.webSlow = 2;
  }
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && enemy.type === 'webweaver') {
      webweaverLayWeb(enemy, state, dt);
    }
  }
}

export function updateFuelmites(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && enemy.type === 'fuelmite') fuelmiteFuse(enemy, state, dt);
  }
}

export function updateRegent(state, dt) {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && enemy.boss && enemy.night >= 5) {
      regentAttacks(enemy, state, dt);
    }
  }
}

export function updatePrism(state, dt) {
  state.mirrors ||= [];
  state.webs ||= [];
  updateWebs(state, dt);
  updateRelics(state, dt);
  smashMirrors(state);
  updateFuelmites(state, dt);
  updateRegent(state, dt);
  state.pulseRing = Math.max(0, (state.pulseRing || 0) - dt);
  sfx.beamHum(state.t || 0);
  traceBeam(state);
  damageAlongBeam(state, dt);
}
