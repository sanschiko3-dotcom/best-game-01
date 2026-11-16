// LUMENWARDEN — shop.js
// One job: dawn purchases, their effects, and the shop panel.

import { sfx } from './audio.js';
import { VIEW } from './config.js';

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

export function buy(state, index) {
  const item = SHOP[index];
  if (!item || state.currency < item.cost) return false;
  if (item.once && state.player[item.once]) return false;
  state.currency -= item.cost;
  item.apply(state.player, state);
  sfx.shopBuy();
  return true;
}

export function drawShop(ctx, state) {
  ctx.fillStyle = 'rgba(12,16,30,.97)';
  ctx.fillRect(45, 50, 1190, 650);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 38px Georgia';
  ctx.fillText('DAWN SHOP', 640, 100);
  ctx.font = '20px Georgia';
  ctx.fillText(`${state.currency} embers · Prepare for the next night`, 640, 135);
  SHOP.forEach((item, index) => {
    const x = 70 + (index % 2) * 580;
    const y = 160 + Math.floor(index / 2) * 94;
    const owned = item.once && state.player[item.once];
    ctx.strokeStyle = owned ? '#789980' : '#a38350';
    ctx.strokeRect(x, y, 550, 82);
    ctx.fillStyle = '#ffe5b0';
    ctx.font = 'bold 22px Georgia';
    const key = (index + 1) % 10;
    ctx.fillText(`${key}. ${item.name} · ${owned ? 'OWNED' : item.cost + ' embers'}`, x + 275, y + 29);
    ctx.font = '17px Georgia';
    ctx.fillText(item.desc, x + 275, y + 59);
  });
  ctx.font = '22px Georgia';
  ctx.fillText('ENTER — Set out into the next night', 640, 670);
}
