import { BEAM } from './config.js';
// SPDX-License-Identifier: MIT
import { applyDamage } from './entities.js';
import { sfx } from './audio.js';

const WISP_RADIUS = 55;
const WISP_DAMAGE = 12;
const WISP_INTERVAL = 1.6;
const EXHAUSTED_RELIC_SCORE = 150;

// Effects are queried from ownership so loading a run never stacks bonuses.
export const RELICS = [
  {
    id: 'emberheart',
    name: 'Emberheart',
    glyph: '♥',
    desc: 'Beam +60%, burn +25%',
    flavour: 'A coal that remembers the first sunrise.',
    apply(state) {
      return {
        beamMul: relicBonus(state, 'beamMul'),
        burnMul: relicBonus(state, 'burnMul'),
      };
    },
  },
  {
    id: 'moonshard',
    name: 'Moonshard Lens',
    glyph: '◇',
    desc: 'One extra mirror and bounce',
    flavour: 'Even a broken moon can turn the light.',
    apply(state) {
      return {
        extraMirror: relicBonus(state, 'extraMirror'),
        extraBounce: relicBonus(state, 'extraBounce'),
      };
    },
  },
  {
    id: 'wisp',
    name: 'Wisp Crown',
    glyph: '✦',
    desc: 'Companion fires every 1.6 seconds',
    flavour: 'One small light refuses to leave your side.',
    apply(state) {
      state.companion = companionPos(state);
    },
  },
  {
    id: 'fang',
    name: 'Hollow Fang',
    glyph: '牙',
    desc: 'Kills restore 3 fuel',
    flavour: 'The dark gives back what it has taken.',
    apply(state) {
      return relicBonus(state, 'fuelOnKill');
    },
  },
];

// Ownership and the seeded reward draft.
export function own(state, id) {
  return (state.relics || []).includes(id);
}

export function ownedRelics(state) {
  return RELICS.filter(relic => own(state, relic.id));
}

export function offerRelics(state) {
  const pool = RELICS.filter(relic => !own(state, relic.id));
  state.choices = state.rng.shuffle(pool).slice(0, 2);
  return state.choices;
}

export function grantRelic(state) {
  if (ownedRelics(state).length === RELICS.length) {
    state.score += EXHAUSTED_RELIC_SCORE;
    return false;
  }
  offerRelics(state);
  state.phase = 'relic';
  sfx.relicGrant();
  return true;
}

export function pickRelic(state, id) {
  state.relics ||= [];
  if (own(state, id)) return;
  const relic = RELICS.find(candidate => candidate.id === id);
  if (!relic) return;
  state.relics.push(id);
  state.stats.relicsTaken = (state.stats.relicsTaken || 0) + 1;
  state.lastRelicGain = relic.name;
  if (relic) relic.apply(state);
  sfx.relicPick();
}

export function relicBonus(state, kind) {
  switch (kind) {
    case 'beamMul':
      return own(state, 'emberheart') ? BEAM.emberheartMul : 1;
    case 'burnMul':
      return own(state, 'emberheart') ? 1.25 : 1;
    case 'extraMirror':
    case 'extraBounce':
      return own(state, 'moonshard') ? 1 : 0;
    case 'fuelOnKill':
      return own(state, 'fang') ? 3 : 0;
    default:
      return 0;
  }
}

// The companion targets from the Warden, matching the lantern's aim origin.
export function companionPos(state) {
  const p = state.player;
  return {
    x: p.x + Math.cos(state.t * 2) * WISP_RADIUS,
    y: p.y + Math.sin(state.t * 2) * WISP_RADIUS,
  };
}

function nearestLivingEnemy(state) {
  const p = state.player;
  let nearest;
  let distance = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const candidate = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (candidate < distance) {
      nearest = enemy;
      distance = candidate;
    }
  }
  return nearest;
}

export function updateCompanion(state, dt) {
  if (!own(state, 'wisp')) return;
  state.companion = companionPos(state);
  state.wispTimer = (state.wispTimer || 0) - dt;
  if (state.wispTimer > 0) return;
  const enemy = nearestLivingEnemy(state);
  if (!enemy) return;
  applyDamage(enemy, WISP_DAMAGE, state);
  state.wispShots = (state.wispShots || 0) + 1;
  state.wispTimer = WISP_INTERVAL;
}

export function updateRelics(state, dt) {
  updateCompanion(state, dt);
}
