// SPDX-License-Identifier: MIT
import { sfx } from './audio.js';
import { BEACON_DEFS, brazierStats } from './config.js';

export function litBeacons(state) {
  return (state.beacons || []).filter(beacon => beacon.lit).length;
}

export function beaconBonus(state) {
  return 1 + litBeacons(state) * 0.25;
}

export function createBeacons() {
  // Positions and channel time come from BEACON_DEFS in config.js, so
  // the puzzle layout is tuned in one place. Each beacon remembers its
  // own channel progress and whether the Warden has kindled it.
  return BEACON_DEFS.map((d) => ({
    x: d.x,
    y: d.y,
    radius: d.radius,
    channelTime: d.channelTime,
    progress: 0,
    lit: false,
  }));
}

export function startHollow(state) {
  state.hollowMoon = true;
  state.beacons ||= createBeacons();
  state.fogBanks = [
    { x: 180, y: 200, radius: 170, vx: 23, vy: 9 },
    { x: 670, y: 450, radius: 190, vx: -17, vy: 13 },
    { x: 1080, y: 260, radius: 150, vx: -14, vy: -11 },
  ];
  state.hollowZones = [
    { x: 410, y: 330, radius: 85, vx: 26, vy: 18 },
    { x: 870, y: 510, radius: 100, vx: -21, vy: -15 },
    { x: 680, y: 160, radius: 65, vx: 12, vy: 20 },
  ];
}

export function updateHollow(state, dt) {
  const player = state.player;
  // Hollow zones drift and drain the lantern's fuel. They bounce off
  // the arena walls, so their patrol never leaves the field — the
  // player can learn the pattern and route around the dark.
  for (const zone of state.hollowZones || []) {
    zone.x += zone.vx * dt;
    zone.y += zone.vy * dt;
    if (zone.x < zone.radius || zone.x > 1280 - zone.radius) zone.vx *= -1;
    if (zone.y < zone.radius || zone.y > 800 - zone.radius) zone.vy *= -1;
    zone.pulse = (zone.pulse || 0) + dt;
    if (Math.hypot(player.x - zone.x, player.y - zone.y) < zone.radius) {
      player.fuel = Math.max(0, player.fuel - 8 * dt);
    }
  }
  // Beacons: stand inside one with fuel and it kindles. Channeling
  // burns 3 fuel per second of progress; stepping out lets the kindling
  // cool, half a second of progress lost per second away. A lit beacon
  // never goes out again this run.
  for (const beacon of state.beacons || []) {
    if (beacon.lit) continue;
    const inside = Math.hypot(player.x - beacon.x, player.y - beacon.y) < beacon.radius;
    if (!inside || player.fuel <= 0) {
      beacon.progress = Math.max(0, beacon.progress - dt * 0.5);
      continue;
    }
    const channel = Math.min(dt, player.fuel / 3, beacon.channelTime - beacon.progress);
    player.fuel = Math.max(0, player.fuel - channel * 3);
    beacon.progress += channel;
    if (beacon.progress < beacon.channelTime - 1e-8) continue;
    beacon.lit = true;
    state.banner = {
      text: 'BEACON LIT',
      sub: '+25% brazier damage · Hollow crown weakened',
      t: 3,
    };
    sfx.beaconChime();
  }
  for (const brazier of state.braziers) {
    brazier.damageFlash = Math.max(0, (brazier.damageFlash || 0) - dt);
  }
}

export function brazierDps(brazier, state) {
  // One table, one formula: the burn of a brazier is its kind's base
  // damage grown by its level, then blessed by every lit beacon.
  const stats = brazierStats(brazier.kind, brazier.level || 1);
  return stats.dps * beaconBonus(state);
}

export function weakenKing(boss, state) {
  if (boss.night < 4) return boss;
  boss.hp *= 1 - litBeacons(state) * 0.1;
  boss.maxHp = boss.hp;
  return boss;
}

export function drawHollow(ctx, state, t) {
  // Hollow zones: a bruise of dark with a pulsing violet edge, so the
  // drain is readable before the player walks into it. The pulse is
  // driven by each zone's own clock, so the three zones breathe out of
  // phase instead of in lockstep.
  for (const zone of state.hollowZones || []) {
    const gradient = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius);
    gradient.addColorStop(0, 'rgba(25,3,45,0.8)');
    gradient.addColorStop(1, 'rgba(100,55,150,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();
    const pulse = 0.35 + 0.3 * Math.sin((zone.pulse || 0) * 2.2);
    ctx.strokeStyle = `rgba(168,110,220,${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(216,170,255,${pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const bank of state.fogBanks || []) {
    const gradient = ctx.createRadialGradient(bank.x, bank.y, 0, bank.x, bank.y, bank.radius);
    gradient.addColorStop(0, state.hollowMoon ? 'rgba(210,180,245,0.24)' : 'rgba(160,180,200,0.22)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(bank.x - bank.radius, bank.y - bank.radius, bank.radius * 2, bank.radius * 2);
  }
  for (const beacon of state.beacons || []) {
    ctx.save();
    ctx.translate(beacon.x, beacon.y);
    ctx.fillStyle = beacon.lit ? '#fff0b3' : '#555166';
    ctx.fillRect(-12, -42, 24, 53);
    ctx.fillRect(-20, 8, 40, 8);
    if (beacon.lit) {
      const beam = ctx.createLinearGradient(0, -250, 0, 0);
      beam.addColorStop(0, 'transparent');
      beam.addColorStop(1, 'rgba(255,225,160,0.6)');
      ctx.fillStyle = beam;
      ctx.fillRect(-18, -250, 36, 220);
      ctx.fillStyle = '#ffe8a0';
      ctx.beginPath();
      ctx.arc(0, -45, 15 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Unlit: a cold pillar with the channel ring. While the Warden
      // stands inside, the ring glows warm and fills; outside, it sits
      // dim, waiting. The label tells the cost plainly: stand, burn fuel.
      const inside = state.player && Math.hypot(state.player.x - beacon.x, state.player.y - beacon.y) < beacon.radius;
      ctx.strokeStyle = inside ? '#ffd97a' : '#e8c6ff';
      ctx.lineWidth = inside ? 6 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, beacon.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (beacon.progress / beacon.channelTime));
      ctx.stroke();
      if (inside) {
        ctx.strokeStyle = 'rgba(255,217,122,0.35)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, beacon.radius - 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#d7c5ee';
      ctx.font = '14px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText('STAND HERE · 2s', 0, 38);
    }
    ctx.restore();
  }
}
