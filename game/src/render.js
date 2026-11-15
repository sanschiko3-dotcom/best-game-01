// LUMENWARDEN — render.js
// One job: everything the player sees, drawn on one canvas.
// The signature look is darkness with light: the world is drawn
// normally, then a darkness overlay is punched through with radial
// gradients at the lantern, the braziers, flares and embers, so the
// light itself is the picture. HUD and menus draw on top, unlit.

import { VIEW, PALETTE, PLAYER, WAVES_TOTAL, BOSS } from './config.js';

let darkCanvas = null;
let darkCtx = null;
let stars = null;

function getDark() {
  if (!darkCanvas) {
    darkCanvas = document.createElement('canvas');
    darkCanvas.width = VIEW.w;
    darkCanvas.height = VIEW.h;
    darkCtx = darkCanvas.getContext('2d');
  }
  return { c: darkCanvas, x: darkCtx };
}

function getStars(rng) {
  if (stars) return stars;
  stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: rng.range(0, VIEW.w), y: rng.range(0, VIEW.h * 0.7),
      r: rng.range(0.5, 1.8), tw: rng.range(0, Math.PI * 2),
    });
  }
  return stars;
}

function punchLight(x, ctx, cx, cy, radius, strength = 1) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, `rgba(0,0,0,${0.98 * strength})`);
  g.addColorStop(0.55, `rgba(0,0,0,${0.75 * strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, state, t) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, PALETTE.nightTop);
  g.addColorStop(1, PALETTE.nightBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // Stars, twinkling slowly.
  for (const s of getStars(state.rng)) {
    const a = 0.35 + 0.35 * Math.sin(t * 0.9 + s.tw);
    ctx.globalAlpha = a;
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // A low pale moon, the only cold light in the sky.
  const mg = ctx.createRadialGradient(1120, 92, 8, 1120, 92, 120);
  mg.addColorStop(0, 'rgba(232,236,255,0.5)');
  mg.addColorStop(1, 'rgba(232,236,255,0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(1120, 92, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath(); ctx.arc(1120, 92, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,170,220,0.5)';
  ctx.beginPath(); ctx.arc(1108, 84, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(1132, 100, 5, 0, Math.PI * 2); ctx.fill();

  // Ground: dark field with faint stones and tufts, and a worn ring
  // where the Warden stands guard.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, VIEW.h - 190, VIEW.w, 190);
  ctx.strokeStyle = PALETTE.groundLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, VIEW.h - 190);
  ctx.bezierCurveTo(320, VIEW.h - 210, 700, VIEW.h - 170, VIEW.w, VIEW.h - 195);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(43,58,107,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(VIEW.w / 2, VIEW.h / 2 + 40, 250, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(43,58,107,0.5)';
  ctx.beginPath();
  ctx.arc(VIEW.w / 2, VIEW.h / 2 + 40, 330, 0, Math.PI * 2);
  ctx.stroke();
  for (const s of getStars(state.rng).slice(0, 40)) {
    ctx.fillStyle = 'rgba(120,140,200,0.25)';
    ctx.fillRect((s.x * 1.7) % VIEW.w, VIEW.h - 180 + ((s.y * 2.3) % 170), 3, 3);
  }
}

function drawBrazier(ctx, b, t) {
  const flick = 0.85 + 0.15 * Math.sin(t * 7 + b.x);
  // Stone base.
  ctx.fillStyle = '#232c4a';
  ctx.beginPath();
  ctx.moveTo(b.x - 22, b.y + 16); ctx.lineTo(b.x + 22, b.y + 16);
  ctx.lineTo(b.x + 14, b.y - 2); ctx.lineTo(b.x - 14, b.y - 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#161d38';
  ctx.fillRect(b.x - 26, b.y + 14, 52, 8);
  // Bowl.
  ctx.fillStyle = b.lit ? '#3a2a18' : '#1c2340';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y - 4, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  if (b.lit) {
    const fg = ctx.createRadialGradient(b.x, b.y - 12, 2, b.x, b.y - 12, 46 * flick);
    fg.addColorStop(0, 'rgba(255,207,110,0.9)');
    fg.addColorStop(0.5, 'rgba(255,140,26,0.45)');
    fg.addColorStop(1, 'rgba(255,140,26,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(b.x, b.y - 12, 46 * flick, 0, Math.PI * 2); ctx.fill();
    // Flame tongues.
    ctx.fillStyle = PALETTE.lanternHot;
    ctx.beginPath();
    ctx.moveTo(b.x - 9, b.y - 6);
    ctx.quadraticCurveTo(b.x - 12, b.y - 26 * flick, b.x, b.y - 34 * flick);
    ctx.quadraticCurveTo(b.x + 12, b.y - 26 * flick, b.x + 9, b.y - 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PALETTE.lanternDeep;
    ctx.beginPath();
    ctx.moveTo(b.x - 5, b.y - 6);
    ctx.quadraticCurveTo(b.x - 6, b.y - 18 * flick, b.x, b.y - 24 * flick);
    ctx.quadraticCurveTo(b.x + 6, b.y - 18 * flick, b.x + 5, b.y - 6);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('E — LIGHT  (10 fuel)', b.x, b.y + 44);
  }
}

function drawEmber(ctx, em, t) {
  const bob = Math.sin(em.bob) * 3;
  const g = ctx.createRadialGradient(em.x, em.y + bob, 1, em.x, em.y + bob, 16);
  g.addColorStop(0, 'rgba(255,154,61,0.9)');
  g.addColorStop(1, 'rgba(255,154,61,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(em.x, em.y + bob, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.ember;
  ctx.beginPath();
  ctx.moveTo(em.x, em.y + bob - 8);
  ctx.quadraticCurveTo(em.x + 6, em.y + bob, em.x, em.y + bob + 6);
  ctx.quadraticCurveTo(em.x - 6, em.y + bob, em.x, em.y + bob - 8);
  ctx.fill();
}

function drawEnemy(ctx, e, t) {
  const flash = e.hitFlash > 0;
  const col = flash ? '#ffffff' : e.def ? e.def.colour : PALETTE.boss;
  // A faint aura in the enemy's own colour, so it reads through the dark.
  const aura = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius * 2.6);
  aura.addColorStop(0, e.boss ? 'rgba(255,77,109,0.30)' : 'rgba(120,140,220,0.20)');
  aura.addColorStop(1, 'rgba(120,140,220,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.type === 'shade') {
    // A smoky blob with two burning eyes.
    const wob = 1 + 0.06 * Math.sin(t * 5 + e.wobble);
    ctx.scale(wob, 1 / wob);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, -e.radius * 0.4, e.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.shadeEye;
    ctx.beginPath(); ctx.arc(-5, -3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -3, 2.6, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'wisp') {
    // A cold flame teardrop, darting.
    ctx.rotate(Math.sin(e.wobble) * 0.5);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -e.radius - 6);
    ctx.quadraticCurveTo(e.radius, 0, 0, e.radius);
    ctx.quadraticCurveTo(-e.radius, 0, 0, -e.radius - 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#eafcff';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'hulk') {
    // A heavy rock mass with cracks of dark.
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = e.radius * (0.85 + 0.18 * Math.sin(i * 2.7 + 1));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2c2350';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(2, 2); ctx.lineTo(-4, 12); ctx.stroke();
    ctx.fillStyle = PALETTE.shadeEye;
    ctx.beginPath(); ctx.arc(-6, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, -4, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'spitter') {
    // A spiked orb that keeps its distance.
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.8, Math.sin(a) * e.radius * 0.8);
      ctx.lineTo(Math.cos(a) * (e.radius + 7), Math.sin(a) * (e.radius + 7));
      ctx.stroke();
    }
    ctx.fillStyle = '#f3e2ff';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (e.boss) {
    // The Gloam King: a huge shade crowned in dark thorns.
    const pulse = 1 + 0.04 * Math.sin(t * 3);
    ctx.scale(pulse, pulse);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, e.radius + 14);
    g.addColorStop(0, '#ff4d6d');
    g.addColorStop(0.6, '#7a1f3d');
    g.addColorStop(1, 'rgba(122,31,61,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.radius + 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d0f22';
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.radius * 0.7, Math.sin(a) * e.radius * 0.7 - 8);
      ctx.lineTo(Math.cos(a) * (e.radius + 16), Math.sin(a) * (e.radius + 16) - 8);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath(); ctx.arc(-13, -6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd7de';
    ctx.beginPath(); ctx.arc(-13, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -6, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Health bar for anything hurt.
  if (e.hp < e.maxHp && !flash) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = e.boss ? '#ff4d6d' : '#ffb347';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}

function drawPlayer(ctx, p, t) {
  const bob = Math.sin(p.walkPhase * 6) * 2;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);
  // Cloak: a hooded warden.
  ctx.fillStyle = PALETTE.playerCloak;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.quadraticCurveTo(13, -8, 12, 10);
  ctx.quadraticCurveTo(0, 16, -12, 10);
  ctx.quadraticCurveTo(-13, -8, 0, -16);
  ctx.fill();
  ctx.fillStyle = '#1c2547';
  ctx.beginPath();
  ctx.arc(0, -8, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.arc(-3, -9, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -9, 1.8, 0, Math.PI * 2); ctx.fill();
  // The lantern, swung toward the aim, glowing hot.
  const lx = Math.cos(p.aim) * 24, ly = Math.sin(p.aim) * 24;
  ctx.strokeStyle = '#8a6a2f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lx, ly); ctx.stroke();
  const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 20);
  lg.addColorStop(0, 'rgba(255,217,122,0.95)');
  lg.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(lx - 5, ly - 7, 10, 14);
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.beginPath(); ctx.arc(lx, ly, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Grace flash ring after a hit.
  if (p.grace > 0 && Math.floor(t * 12) % 2 === 0) {
    ctx.strokeStyle = 'rgba(255,93,108,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawWorld(ctx, state, t) {
  drawBackground(ctx, state, t);
  for (const b of state.braziers) drawBrazier(ctx, b, t);
  for (const em of state.embers) drawEmber(ctx, em, t);
  for (const e of state.enemies) drawEnemy(ctx, e, t);
  for (const f of state.flares) {
    const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 26);
    g.addColorStop(0, 'rgba(255,217,122,1)');
    g.addColorStop(1, 'rgba(255,122,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of state.bolts) {
    ctx.fillStyle = '#c86bff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3e2ff';
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.colour;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (!state.player.dead) drawPlayer(ctx, state.player, t);

  // Floating score text.
  ctx.textAlign = 'center';
  for (const f of state.floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.colour;
    ctx.font = '700 17px Georgia, serif';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawDarkness(ctx, state, t) {
  const { x: dctx } = getDark();
  dctx.clearRect(0, 0, VIEW.w, VIEW.h);
  dctx.globalCompositeOperation = 'source-over';
  // The night is dark, but never blind: silhouettes must still read,
  // or the scene looks empty. Enemies get their own soft holes below.
  dctx.fillStyle = 'rgba(4, 6, 18, 0.80)';
  dctx.fillRect(0, 0, VIEW.w, VIEW.h);
  dctx.globalCompositeOperation = 'destination-out';
  const p = state.player;
  const fuelFrac = p.fuel / PLAYER.maxFuel;
  const lightR = p.lightRadius * (0.3 + 0.7 * fuelFrac) * (1 + 0.03 * Math.sin(t * 6));
  punchLight(0, dctx, p.x, p.y, lightR, 1);
  for (const b of state.braziers) {
    if (b.lit) punchLight(0, dctx, b.x, b.y - 8, b.radius * (0.95 + 0.05 * Math.sin(t * 5 + b.x)), 0.95);
  }
  for (const f of state.flares) punchLight(0, dctx, f.x, f.y, 90, 0.9);
  for (const em of state.embers) punchLight(0, dctx, em.x, em.y, 26, 0.55);
  // Every shadow is faintly visible in the dark — a dim shape with
  // glowing eyes — so the arena always reads as inhabited.
  for (const e of state.enemies) {
    punchLight(0, dctx, e.x, e.y, e.radius + (e.boss ? 64 : 34), e.boss ? 0.65 : 0.5);
  }
  // A sliver of moonlight at the top so the scene never goes blind.
  punchLight(0, dctx, 1120, 92, 130, 0.55);
  ctx.drawImage(dctx.canvas, 0, 0);
}

function drawHud(ctx, state) {
  const p = state.player;
  ctx.textAlign = 'left';
  // Top bar.
  ctx.fillStyle = 'rgba(5,7,15,0.72)';
  ctx.fillRect(0, 0, VIEW.w, 54);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 22px Georgia, serif';
  ctx.fillText(`WAVE ${Math.min(state.wave, WAVES_TOTAL)} / ${WAVES_TOTAL}`, 18, 35);
  ctx.font = '600 17px Georgia, serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(state.endless ? 'ENDLESS NIGHT' : 'THE LONG NIGHT', 215, 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.font = '700 24px Georgia, serif';
  ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, VIEW.w / 2, 35);
  if (state.multiplier > 1) {
    ctx.fillStyle = '#ff9a3d';
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText(`COMBO ×${state.multiplier}`, VIEW.w / 2, 52);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 17px Georgia, serif';
  ctx.fillText(`BANISHED ${state.kills}`, VIEW.w - 18, 24);
  ctx.fillText(`BEST ${state.best.toLocaleString('en-US')}`, VIEW.w - 18, 46);

  // Hearts.
  for (let i = 0; i < 5; i++) {
    const x = 24 + i * 30, y = 78;
    ctx.fillStyle = p.hp > i * 20 ? PALETTE.hp : 'rgba(255,93,108,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x - 10, y - 2, x - 5, y - 10, x, y - 4);
    ctx.bezierCurveTo(x + 5, y - 10, x + 10, y - 2, x, y + 8);
    ctx.fill();
  }
  // Fuel bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 18, 96, 220, 14, 7); ctx.fill();
  ctx.fillStyle = p.fuel < 25 ? '#ff5d6c' : PALETTE.fuel;
  roundRect(ctx, 18, 96, 220 * (p.fuel / PLAYER.maxFuel), 14, 7); ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LANTERN FUEL ${Math.ceil(p.fuel)}`, 18, 128);
  if (p.fuel < 25) {
    ctx.fillStyle = '#ff5d6c';
    ctx.fillText('FUEL LOW — catch embers!', 150, 128);
  }

  // Wave progress: enemies left this wave.
  const left = (state.waveObj ? state.waveObj.queue.length : 0) + state.enemies.length;
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px Georgia, serif';
  ctx.fillText(left > 0 ? `SHADOWS LEFT: ${left}` : 'WAVE CLEAR!', VIEW.w - 18, 78);

  // Boss bar.
  const boss = state.enemies.find((e) => e.boss);
  if (boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, VIEW.w / 2 - 260, VIEW.h - 46, 520, 16, 8); ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    roundRect(ctx, VIEW.w / 2 - 260, VIEW.h - 46, 520 * Math.max(0, boss.hp / boss.maxHp), 16, 8); ctx.fill();
    ctx.fillStyle = '#ffd7de';
    ctx.font = '700 15px Georgia, serif';
    ctx.fillText(BOSS.name.toUpperCase(), VIEW.w / 2, VIEW.h - 54);
  }

  // Banner (wave start, boss warning).
  if (state.banner && state.banner.t > 0) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, state.banner.t);
    ctx.fillStyle = PALETTE.lanternHot;
    ctx.font = '700 44px Georgia, serif';
    ctx.fillText(state.banner.text, VIEW.w / 2, 210);
    if (state.banner.sub) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = '600 19px Georgia, serif';
      ctx.fillText(state.banner.sub, VIEW.w / 2, 244);
    }
    ctx.globalAlpha = 1;
  }

  // Low-fuel / low-hp danger vignette.
  if (p.hp < 30 || state.flash > 0) {
    ctx.fillStyle = `rgba(255,40,60,${Math.max(state.flash * 0.4, p.hp < 30 ? 0.1 + 0.05 * Math.sin(Date.now() / 200) : 0)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  // Hint line.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(242,234,216,0.6)';
  ctx.font = '600 14px Georgia, serif';
  ctx.fillText('WASD move · Mouse aim · Click / Space flare · E light brazier · P pause · M mute', VIEW.w / 2, VIEW.h - 12);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 14); ctx.stroke();
}

function drawTitle(ctx, state, t) {
  drawWorld(ctx, { ...state, enemies: state.titleShadows || [], flares: [], bolts: [] }, t);
  drawDarkness(ctx, { ...state, enemies: state.titleShadows || [], flares: [], bolts: [] }, t);
  ctx.fillStyle = 'rgba(4,6,18,0.45)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  const glow = ctx.createRadialGradient(VIEW.w / 2, 250, 10, VIEW.w / 2, 250, 320);
  glow.addColorStop(0, 'rgba(255,179,71,0.28)');
  glow.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.font = '700 84px Georgia, serif';
  ctx.fillText('LUMENWARDEN', VIEW.w / 2, 250);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'italic 600 24px Georgia, serif';
  ctx.fillText('Keep the last lantern burning through the Long Night.', VIEW.w / 2, 296);
  panel(ctx, VIEW.w / 2 - 330, 340, 660, 208);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 18px Georgia, serif';
  ctx.fillText('The dark sends its shadows in 10 waves. Your lantern is', VIEW.w / 2, 382);
  ctx.fillText('your weapon and your lifeline: light burns shadows,', VIEW.w / 2, 408);
  ctx.fillText('fuel runs out, and embers are the only refill.', VIEW.w / 2, 434);
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.font = '700 18px Georgia, serif';
  ctx.fillText('WASD move  ·  Mouse aim  ·  Click / Space flare', VIEW.w / 2, 472);
  ctx.fillText('E light a brazier  ·  Survive to dawn — Wave 10', VIEW.w / 2, 498);
  const pulse = 0.65 + 0.35 * Math.sin(t * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', VIEW.w / 2, 606);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px Georgia, serif';
  ctx.fillText(`Best score: ${state.best.toLocaleString('en-US')}   ·   An original game — no borrowed art, music or names`, VIEW.w / 2, 660);
}

function drawUpgrade(ctx, state) {
  drawWorld(ctx, state, state.t);
  drawDarkness(ctx, state, state.t);
  ctx.fillStyle = 'rgba(4,6,18,0.62)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.lanternHot;
  ctx.font = '700 40px Georgia, serif';
  ctx.fillText(`WAVE ${state.wave} CLEAR — DAWN IS CLOSER`, VIEW.w / 2, 150);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 20px Georgia, serif';
  ctx.fillText('Choose one blessing for the next wave. Click a card, or press 1 / 2 / 3.', VIEW.w / 2, 188);
  const cw = 300, ch = 240, gap = 30;
  const total = cw * 3 + gap * 2;
  state.choices.forEach((u, i) => {
    const x = VIEW.w / 2 - total / 2 + i * (cw + gap);
    const y = 250;
    const hover = state.hoverChoice === i;
    ctx.fillStyle = hover ? 'rgba(255,179,71,0.16)' : PALETTE.panel;
    roundRect(ctx, x, y, cw, ch, 14); ctx.fill();
    ctx.strokeStyle = hover ? '#ffd97a' : PALETTE.panelEdge;
    ctx.lineWidth = hover ? 3 : 2;
    roundRect(ctx, x, y, cw, ch, 14); ctx.stroke();
    ctx.fillStyle = PALETTE.lanternHot;
    ctx.font = '700 54px Georgia, serif';
    ctx.fillText(u.glyph, x + cw / 2, y + 82);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 24px Georgia, serif';
    ctx.fillText(u.name, x + cw / 2, y + 126);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 16px Georgia, serif';
    const words = u.desc.split(' ');
    let line = '', ly = y + 158;
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 30) { ctx.fillText(line.trim(), x + cw / 2, ly); ly += 22; line = w; }
      else line += ' ' + w;
    }
    ctx.fillText(line.trim(), x + cw / 2, ly);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '700 16px Georgia, serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cw / 2, y + ch - 18);
  });
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px Georgia, serif';
  ctx.fillText(`Score ${state.score.toLocaleString('en-US')}  ·  ${state.kills} shadows banished  ·  Next: Wave ${state.wave + 1}`, VIEW.w / 2, 560);
}

function drawPause(ctx, state) {
  drawWorld(ctx, state, state.t);
  drawDarkness(ctx, state, state.t);
  ctx.fillStyle = 'rgba(4,6,18,0.7)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 52px Georgia, serif';
  ctx.fillText('PAUSED', VIEW.w / 2, 360);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 20px Georgia, serif';
  ctx.fillText('Press P or click to return to the night.', VIEW.w / 2, 404);
}

function drawEnd(ctx, state, won) {
  drawWorld(ctx, state, state.t);
  drawDarkness(ctx, state, state.t);
  ctx.fillStyle = won ? 'rgba(255,190,90,0.22)' : 'rgba(20,4,10,0.66)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  if (won) {
    ctx.fillStyle = '#ffd97a';
    ctx.font = '700 64px Georgia, serif';
    ctx.fillText('DAWN BREAKS', VIEW.w / 2, 260);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'italic 600 23px Georgia, serif';
    ctx.fillText('The Long Night ends. Your lantern never went out.', VIEW.w / 2, 308);
  } else {
    ctx.fillStyle = '#ff5d6c';
    ctx.font = '700 64px Georgia, serif';
    ctx.fillText('THE LIGHT GOES OUT', VIEW.w / 2, 260);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'italic 600 23px Georgia, serif';
    ctx.fillText(`The shadows take the lantern on Wave ${state.wave}.`, VIEW.w / 2, 308);
  }
  panel(ctx, VIEW.w / 2 - 280, 350, 560, 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, VIEW.w / 2, 404);
  ctx.font = '600 19px Georgia, serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`${state.kills} shadows banished  ·  Best ${state.best.toLocaleString('en-US')}`, VIEW.w / 2, 442);
  ctx.fillText(won ? 'Endless Night continues — press R for more waves.' : 'The Warden rises again — press R to retry.', VIEW.w / 2, 478);
  ctx.fillStyle = PALETTE.lanternHot;
  const pulse = 0.65 + 0.35 * Math.sin(state.t * 3);
  ctx.globalAlpha = pulse;
  ctx.font = '700 24px Georgia, serif';
  ctx.fillText('PRESS R TO PLAY AGAIN', VIEW.w / 2, 600);
  ctx.globalAlpha = 1;
}

export function render(ctx, state) {
  const t = state.t;
  ctx.save();
  if (state.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  if (state.phase === 'title') {
    drawTitle(ctx, state, t);
  } else if (state.phase === 'upgrade') {
    drawUpgrade(ctx, state);
  } else if (state.phase === 'paused') {
    drawPause(ctx, state);
  } else if (state.phase === 'gameover') {
    drawEnd(ctx, state, false);
  } else if (state.phase === 'victory') {
    drawEnd(ctx, state, true);
  } else {
    drawWorld(ctx, state, t);
    drawDarkness(ctx, state, t);
    drawHud(ctx, state);
  }
  ctx.restore();
}
