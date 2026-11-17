// SPDX-License-Identifier: MIT
// LUMENWARDEN — shop.js
// One job: dawn purchases, their effects, and the shop panel.

import { RELICS, pickRelic } from './relics.js';
import { sfx } from './audio.js';
import { MIRROR_SHOP_TIERS, VIEW, BRAZIER_TYPES, brazierStats } from './config.js';

export const SHOP = [
  {
    name: 'Kindled Heart', desc: '+25 maximum health', cost: 8,
    apply(p) {
      p.maxHp += 25;
      p.hp = p.maxHp;
    },
  },
  {
    name: 'Deep Reservoir', desc: '+30 maximum fuel', cost: 8,
    apply(p) {
      p.maxFuel += 30;
      p.fuel = p.maxFuel;
    },
  },
  {
    name: 'Quickstep', desc: 'Dash recovers 20% faster', cost: 10,
    apply(p) { p.dashDelay *= 0.8; },
  },
  {
    name: 'Dawn Conduit', desc: 'Nova charges 35% faster', cost: 10,
    apply(p) { p.novaGain *= 1.35; },
  },
  {
    name: 'Sanctuary', desc: 'Braziers heal 50% faster', cost: 6,
    apply(p) { p.healMul *= 1.5; },
  },
  {
    name: 'Sunlance', desc: 'Flares pierce every shadow once', cost: 9,
    once: 'pierce',
    apply(p) { p.pierce = true; },
  },
  {
    name: 'Fifth Brazier', desc: 'A sanctuary at arena centre', cost: 25,
    once: 'fifthBrazier',
    apply(p, state) {
      p.fifthBrazier = true;
      state.braziers.push({
        x: VIEW.w / 2, y: VIEW.h / 2, radius: 150, lit: false,
      });
    },
  },
  {
    name: 'Second Wind', desc: 'Revive once each night at half HP', cost: 20,
    once: 'secondWind',
    apply(p) { p.secondWind = true; },
  },
  {
    name: 'Frost Lantern', desc: 'Slow shadows in your light by 25%', cost: 14,
    once: 'frost',
    apply(p) { p.frost = true; },
  },
  {
    name: 'Ember Greed', desc: 'Longer streaks and richer embers', cost: 12,
    once: 'greed',
    apply(p) { p.greed = true; },
  },
];

SHOP.push(
{tier:'rack',field:'mirrorRack',name:'Mirror Rack',desc:'+1 mirror (two tiers)',cost:15,apply(p){p.mirrorRack=(p.mirrorRack||0)+1;}},
{tier:'glass',field:'glass',name:'Polished Glass',desc:'+40% beam DPS (three tiers)',cost:12,apply(p){p.glass=(p.glass||0)+1;}},
{tier:'pivot',field:'pivot',name:'Quick Pivot',desc:'+80 beam length (two tiers)',cost:10,apply(p){p.pivot=(p.pivot||0)+1;}},
{name:'Relic Cache',desc:'Random unowned relic',cost:MIRROR_SHOP_TIERS.cache.cost,once:'cache',apply(p,s){const r=s.rng.pick(RELICS.filter(r=>!s.relics.includes(r.id)));if(r)pickRelic(s,r.id);p.cache=true;}});
export function buy(state, index) {
  const item = SHOP[index];
  if (!item) return false;
  const tier = MIRROR_SHOP_TIERS[item.tier];
  const level = state.player[item.field] || 0;
  if (tier && level >= tier.maxLevel) return false;
  const cost = tier ? tier.costs[level] : item.cost;
  if (state.currency < cost) return false;
  if (item.once && state.player[item.once]) return false;
  state.currency -= cost;
  item.apply(state.player, state);
  sfx.shopBuy();
  return true;
}

export function drawShop(ctx, state) {
  ctx.fillStyle = 'rgba(12,16,30,.97)';
  ctx.fillRect(45, 50, 1190, 672);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 38px Georgia';
  ctx.fillText('DAWN SHOP', 640, 100);
  ctx.font = '20px Georgia';
  ctx.fillText(`${state.currency} embers · Prepare for the next night`, 640, 135);
  SHOP.forEach((item, index) => {
    const x = 70 + (index % 2) * 580;
    const y = 160 + Math.floor(index / 2) * 62;
    const tier = MIRROR_SHOP_TIERS[item.tier];
    const level = state.player[item.field] || 0;
    const pips = tier ? '●'.repeat(level) + '○'.repeat(tier.maxLevel - level) : '';
    const cost = tier ? tier.costs[level] : item.cost;
    const owned = (item.once && state.player[item.once]) || (tier && level >= tier.maxLevel);
    ctx.strokeStyle = owned ? '#789980' : '#a38350';
    ctx.strokeRect(x, y, 550, 58);
    ctx.fillStyle = '#ffe5b0';
    ctx.font = 'bold 22px Georgia';
    const key = index<10?(index+1)%10:['J','K','L','C'][index-10];
    ctx.fillText(`${key}. ${item.name} · ${owned ? 'OWNED' : cost + ' embers'}`, x + 275, y + 29);
    ctx.font = '17px Georgia';
    ctx.fillText(`${pips} ${item.desc}`, x + 275, y + 49);
  });
  ctx.font = '16px Georgia';
  if (state.lastRelicGain) ctx.fillText('Cache recovered: ' + state.lastRelicGain, 640, 610);
  drawBrazierSection(ctx, state);
  ctx.font = '22px Georgia';
  ctx.fillText('ENTER — Set out into the next night', 640, 712);
}

// The brazier foundry: three rows, one per kind, each showing what the
// kind does, what it costs, and what level the Warden's braziers of
// that kind have reached. Buying a kind fills the next empty socket;
// buying it again raises the kind's level everywhere it burns, to a
// maximum of 3. A socket's level is drawn as pips under the brazier in
// the arena, so the shop and the field always agree.
export function drawBrazierSection(ctx, state) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 20px Georgia';
  ctx.fillText('BRAZIERS — B / F / S place or upgrade · U upgrade last placed', 640, 632);
  const kinds = ['Ember', 'Frost', 'Sun'];
  kinds.forEach((kind, i) => {
    const placed = state.braziers.filter((b) => b.kind === kind);
    const level = placed.length ? Math.max(...placed.map((b) => b.level || 1)) : 0;
    const stats = brazierStats(kind, Math.max(1, level));
    const next = level >= 3 ? null : brazierStats(kind, level + 1);
    const x = 100 + i * 400;
    const y = 660;
    ctx.fillStyle = level > 0 ? '#ffe5b0' : '#9aa7c7';
    ctx.font = '17px Georgia';
    const levelText = level === 0 ? 'not placed' : `Lv.${level}${next ? ` → Lv.${level + 1}` : ' · MAX'}`;
    const radiusText = level === 0 ? `${stats.radius}r` : (next ? `${stats.radius}r → ${next.radius}r` : `${stats.radius}r`);
    const dpsText = level === 0 ? `${Math.round(stats.dps)}dps` : (next ? `${Math.round(stats.dps)}dps → ${Math.round(next.dps)}dps` : `${Math.round(stats.dps)}dps`);
    ctx.fillText(
      `${BRAZIER_TYPES[kind].key} ${kind} · ${BRAZIER_TYPES[kind].placeCost}e · ${levelText} · ${radiusText} · ${dpsText}`,
      x + 160, y,
    );
    ctx.fillStyle = '#9aa7c7';
    ctx.font = '14px Georgia';
    ctx.fillText(BRAZIER_TYPES[kind].desc, x + 160, y + 20);
  });
}

export function buyBrazier(state, kind) {
  const type = BRAZIER_TYPES[kind];
  if (!type) return false;
  const socket = state.braziers.find((b) => b.kind === kind && (b.level || 1) < 3)
    || state.braziers.find((b) => !b.kind);
  if (!socket || state.currency < type.placeCost) return false;
  const upgrading = socket.kind === kind;
  const level = upgrading ? (socket.level || 1) + 1 : 1;
  const stats = brazierStats(kind, level);
  state.currency -= type.placeCost;
  Object.assign(socket, {
    kind, level, lit: true,
    radius: stats.radius, lightRadius: stats.lightRadius,
  });
  state.lastBrazierKind = kind;
  if (!upgrading) state.stats.braziersPlaced = (state.stats.braziersPlaced || 0) + 1;
  if (upgrading) sfx.brazierUpgrade(); else sfx.shopBuy();
  return true;
}

// U upgrades whatever the Warden placed most recently: the same purchase
// as pressing that kind's letter again, through one key.
export function upgradeBrazier(state) {
  if (!state.lastBrazierKind) return false;
  return buyBrazier(state, state.lastBrazierKind);
}
