// SPDX-License-Identifier: MIT
// LUMENWARDEN — config.js
// One job: every tunable number, colour and definition in the game.
// Nothing here runs game logic; every other module reads from here so
// tuning the game means editing this file and nowhere else.

export const VIEW = { w: 1280, h: 800 };

// Coherent palette: one cold night, one warm light. Everything in the
// game is drawn from these colours so the scene reads at a glance.
export const PALETTE = {
  nightTop: '#0b1026',
  nightBottom: '#05070f',
  ground: '#0d1328',
  groundLine: '#141c3a',
  moon: '#e8ecff',
  moonGlow: '#9fb2ff',
  star: '#cdd7ff',
  lantern: '#ffb347',
  lanternHot: '#ffd97a',
  lanternDeep: '#ff7a1a',
  ember: '#ff9a3d',
  brazierLit: '#ffcf6e',
  brazierCold: '#3a4668',
  shade: '#5a6b9e',
  shadeEye: '#ff5d5d',
  wisp: '#7fe3ff',
  hulk: '#8a7bd8',
  spitter: '#c86bff',
  boss: '#ff4d6d',
  player: '#ffe9b0',
  playerCloak: '#2b3a6b',
  hp: '#ff5d6c',
  fuel: '#ffb347',
  text: '#f2ead8',
  textDim: '#9aa7c7',
  panel: 'rgba(10, 14, 32, 0.92)',
  panelEdge: '#ffb347',
};

export const PLAYER = {
  radius: 15,
  speed: 265,
  accel: 2400,
  friction: 6.5,
  maxHp: 100,
  maxFuel: 100,
  fuelDrain: 1.7, // per second, the lantern always burns
  flareCost: 6, // fuel per flare bolt
  flareCooldown: 0.42,
  flareSpeed: 560,
  flareDamage: 26,
  flareBlast: 78, // explosion radius
  lightRadius: 175, // the lantern's glow; enemies inside it burn
  burnDps: 9, // damage per second to shadows inside the light
  pickupRadius: 46,
  contactGrace: 0.7, // seconds of invulnerability after a hit
};

// Enemy types. Each has a distinct shape, speed and behaviour so the
// player meets real variety, not recolours of one chaser.
export const ENEMIES = {
  shade: {
    name: 'Shade', hp: 22, speed: 74, radius: 14, damage: 9, score: 50,
    emberChance: 0.55, colour: PALETTE.shade,
  },
  wisp: {
    name: 'Wisp', hp: 13, speed: 158, radius: 10, damage: 6, score: 80,
    emberChance: 0.5, colour: PALETTE.wisp,
  },
  hulk: {
    name: 'Hulk', hp: 95, speed: 40, radius: 23, damage: 18, score: 150,
    emberChance: 0.9, colour: PALETTE.hulk,
  },
  spitter: {
    name: 'Spitter', hp: 28, speed: 58, radius: 13, damage: 10, score: 120,
    emberChance: 0.65, colour: PALETTE.spitter, ranged: true,
    shootRange: 340, shootCooldown: 2.4, boltSpeed: 210,
  },
};

export const BOSS = {
  name: 'The Gloam King', hp: 950, speed: 46, radius: 42, damage: 22,
  score: 2500, summonEvery: 7, burstEvery: 5, boltSpeed: 180,
};

// Four braziers stand at fixed points of the arena. Lighting one costs
// fuel but buys a permanent safe circle of burning light.
export const BRAZIERS = [
  { x: 220, y: 190, lit: false, radius: 130 },
  { x: 1060, y: 190, lit: false, radius: 130 },
  { x: 220, y: 610, lit: false, radius: 130 },
  { x: 1060, y: 610, lit: false, radius: 130 },
];
export const BRAZIER_LIGHT_COST = 10; // fuel
export const BRAZIER_BURN_DPS = 26;
export const BRAZIER_HEAL = 2.5; // hp per second while standing in its light

export const EMBER_FUEL = 12; // fuel restored by one ember
export const EMBER_SCORE = 25;

export const WAVES_TOTAL = 30; // survive wave 10 and dawn breaks: you win
export const BOSS_WAVES = [6, 12, 18, 24, 30];
export const WAVE_CLEAR_BONUS = 150;
export const COMBO_WINDOW = 3; // seconds; kills inside it raise the multiplier
export const COMBO_MAX = 5;

// Wave composition: count grows, the mix hardens, hulks and spitters
// join from wave 2 and 3. Boss waves add a boss on top of a small escort.
function baselineWaveComp(n) {
  const local = (n - 1) % 6 + 1;
  const comp = { stalker: n >= 3 ? 2 : 0, splitter: n >= 7 ? 2 : 0, siphon: n >= 7 ? 2 : 0, shade: 4 + n * 2, wisp: n >= 2 ? 2 + n : 0, hulk: 0, spitter: 0 };
  if (n >= 3) comp.hulk = Math.floor((n - 1) / 2);
  if (n >= 4) comp.spitter = n - 2;
  if (BOSS_WAVES.includes(n)) {
    comp.shade = Math.max(3, comp.shade - 4);
    comp.wisp = Math.max(0, comp.wisp - 2);
  }
  return comp;
}

export function enemyScale(n) {
  // Enemies get tougher as the night deepens: +12% hp, +4% speed per wave.
  return { hp: 1 + 0.12 * (n - 1), speed: 1 + 0.04 * (n - 1) };
}

Object.assign(ENEMIES, {
 hollow: {name:'Hollow Wisp',hp:30,speed:170,radius:11,damage:8,score:150,emberChance:0.7,colour:'#e1c8ff'},
 mirror: {name:'Mirror Wraith',hp:50,speed:80,radius:17,damage:13,score:220,emberChance:1,colour:'#c4efff'},
 thief: {name:'Lantern Thief',hp:45,speed:145,radius:12,damage:9,score:200,emberChance:1,colour:'#b9ff92'},
 stalker: {name:'Stalker',hp:38,speed:120,radius:14,damage:12,score:110,emberChance:0.8,colour:'#a3b3c9'},
 splitter: {name:'Splitter',hp:55,speed:65,radius:20,damage:12,score:140,emberChance:0.8,colour:'#67d8b3'},
 siphon: {name:'Siphon',hp:65,speed:90,radius:16,damage:8,score:160,emberChance:1,colour:'#e371cc'}
});

// Later nights replace the baseline with threats suited to their terrain.
// The night adjustments come from NIGHT_COMPS (config, single source of
// truth) and the endless additions from endlessComp(); the mix is built
// the same way for every wave, campaign or endless.
export function waveComp(n, night = Math.min(5, Math.ceil(n / 6))) {
  const mix = baselineWaveComp(n);
  Object.assign(mix, endlessComp(n));
  const adj = NIGHT_COMPS[Math.min(5, night)] || null;
  if (adj) {
    for (const [type, delta] of Object.entries(adj)) {
      const floor = type === 'shade' ? 2 : 0;
      mix[type] = Math.max(floor, (mix[type] || 0) + delta);
    }
  }
  return mix;
}

export function endlessScale(n) {
  const beyond = Math.max(0, n - 24);
  return {
    hp: 1 + beyond * 0.09,
    speed: 1 + Math.min(1.5, beyond * 0.015),
    elite: Math.min(0.65, beyond * 0.012),
  };
}

// ---- v3: The Hollow Dawn -------------------------------------------------
// One night, one palette. Night 1 is the exact v2 sky and ground; nights
// 2-3 deepen the sky a shade each while the ground and moon stay v2;
// the Hollow Dawn (night 4) goes pale violet, and the endless deep
// (night 5+) darker still.
export const NIGHT_THEMES = [
  {
    name: 'Ember Fields', skyTop: '#0b1026', skyBottom: '#05070f',
    ground: '#0d1328', groundLine: '#141c3a', moon: '#e8ecff',
    moonGlow: 'rgba(232,236,255,0.5)', fog: 'rgba(160,180,200,0.22)',
    sub: 'Hold the light.',
  },
  {
    name: 'Drowned Hollow', skyTop: '#0a1226', skyBottom: '#05070f',
    ground: '#0d1328', groundLine: '#141c3a', moon: '#e8ecff',
    moonGlow: 'rgba(232,236,255,0.5)', fog: 'rgba(160,180,200,0.22)',
    sub: 'Hold the light.',
  },
  {
    name: 'Gloam Citadel', skyTop: '#0c0f28', skyBottom: '#060812',
    ground: '#0d1328', groundLine: '#141c3a', moon: '#e8ecff',
    moonGlow: 'rgba(232,236,255,0.5)', fog: 'rgba(160,180,200,0.22)',
    sub: 'Hold the light.',
  },
  {
    name: 'The Hollow Dawn', skyTop: '#211531', skyBottom: '#100e21',
    ground: '#21182e', groundLine: '#2c2140', moon: '#f0dfff',
    moonGlow: 'rgba(240,223,255,0.55)', fog: 'rgba(210,180,245,0.24)',
    sub: 'The crown breaks. Keep moving.',
  },
  {
    name: 'The Shattered Dawn', skyTop: '#382343', skyBottom: '#20132c', ground: '#32233b', groundLine: '#73525b', moon: '#ffe39b', moonGlow: 'rgba(255,210,120,.6)', fog: 'rgba(210,160,255,.2)', sub: 'Reflect the shattered sun.',
  },
  {
    name: 'The Endless Night', skyTop: '#160a24', skyBottom: '#0a0616',
    ground: '#180f28', groundLine: '#241736', moon: '#e6d4ff',
    moonGlow: 'rgba(230,212,255,0.5)', fog: 'rgba(210,180,245,0.28)',
    sub: 'There is no dawn. Only light.',
  },
];

export function themeForNight(night) {
  const n = Math.max(1, Math.min(NIGHT_THEMES.length, night || 1));
  return NIGHT_THEMES[n - 1];
}

// Boss names and taunts, one per night. Night 4+ is the Hollow King;
// beyond that the crown only grows heavier, the name stays.
export const BOSS_NAMES = ['The Gloam King', 'The Hollow Tide', 'The Gloam Queen', 'The Hollow King', 'The Shattered Regent'];
export const BOSS_SUBS = [
  'Break his crown of dark',
  'Drown the tide in light',
  'Break her crown of dark',
  'Break the hollow crown',
  'Shatter the broken crown',
];

export function bossNameForNight(night) {
  return BOSS_NAMES[Math.min(BOSS_NAMES.length, night || 1) - 1] || 'The Hollow King';
}

export function bossSubForNight(night) {
  return BOSS_SUBS[Math.min(BOSS_SUBS.length, night || 1) - 1] || 'Break the hollow crown';
}

// Brazier kinds, one table for every number the shop, the burn and the
// renderer agree on. Values mirror the v2 formulas exactly:
// radius = base + 20 per extra level, dps = base x (1 + 0.30 per level),
// Frost slow = 0.50 - 0.08 per extra level, Sun light = base + 20.
export const BRAZIER_TYPES = {
  Ember: {
    label: 'Ember Brazier', placeCost: 8, key: 'B',
    baseRadius: 140, radiusPerLevel: 20,
    baseDps: 26, dpsGrowth: 0.30,
    slow: 1, slowPerLevel: 0,
    lightBonus: 0, lightPerLevel: 30,
    flame: '#ff9a3d', flameHot: '#ffd97a', desc: 'Steady burning circle',
  },
  Frost: {
    label: 'Frost Brazier', placeCost: 12, key: 'F',
    baseRadius: 140, radiusPerLevel: 20,
    baseDps: 14, dpsGrowth: 0.30,
    slow: 0.5, slowPerLevel: 0.08,
    lightBonus: 0, lightPerLevel: 30,
    flame: '#7fe3ff', flameHot: '#c4f5ff', desc: 'Chills shadows to half speed',
  },
  Sun: {
    label: 'Sun Brazier', placeCost: 16, key: 'S',
    baseRadius: 170, radiusPerLevel: 20,
    baseDps: 52, dpsGrowth: 0.30,
    slow: 1, slowPerLevel: 0,
    lightBonus: 20, lightPerLevel: 30,
    flame: '#ffd76c', flameHot: '#fff3c4', desc: 'Fierce burn, wide light',
  },
};

export function brazierStats(kind, level) {
  const t = BRAZIER_TYPES[kind] || BRAZIER_TYPES.Ember;
  const lv = Math.max(1, Math.min(5, level || 1));
  const extra = lv - 1;
  return {
    kind, level: lv,
    radius: t.baseRadius + t.radiusPerLevel * extra,
    dps: t.baseDps * (1 + t.dpsGrowth * extra),
    slow: t.slow === 1 ? 1 : Math.max(0.2, t.slow - t.slowPerLevel * extra),
    lightRadius: t.baseRadius + t.lightBonus + t.lightPerLevel * extra,
    cost: t.placeCost,
    flame: t.flame, flameHot: t.flameHot,
  };
}

// The three beacons of the Hollow Dawn: stand inside one with fuel and
// it kindles over two seconds. Each lit beacon is +25% brazier damage
// and -10% Hollow King health.
export const BEACON_DEFS = [
  { x: 320, y: 440, radius: 42, channelTime: 2 },
  { x: 640, y: 220, radius: 42, channelTime: 2 },
  { x: 960, y: 440, radius: 42, channelTime: 2 },
];

// Endless scaling, one row per six-wave block past wave 24. The block
// number is what endlessScale() and the wave composer both read, so the
// difficulty curve is declared once and honoured everywhere.
export const ENDLESS_TABLE = [
  { block: 0, waves: '25-30', hpMul: 1.09, speedMul: 1.02, eliteBonus: 0.01, hollowBonus: 0, mirrorBonus: 0, webBonus: 0, fuelBonus: 0 },
  { block: 1, waves: '31-36', hpMul: 1.63, speedMul: 1.09, eliteBonus: 0.08, hollowBonus: 6, mirrorBonus: 1, webBonus: 2, fuelBonus: 3 },
  { block: 2, waves: '37-42', hpMul: 2.17, speedMul: 1.18, eliteBonus: 0.14, hollowBonus: 12, mirrorBonus: 2, webBonus: 4, fuelBonus: 6 },
  { block: 3, waves: '43-48', hpMul: 2.71, speedMul: 1.26, eliteBonus: 0.21, hollowBonus: 18, mirrorBonus: 3, webBonus: 6, fuelBonus: 9 },
  { block: 4, waves: '49-54', hpMul: 3.25, speedMul: 1.35, eliteBonus: 0.27, hollowBonus: 24, mirrorBonus: 4, webBonus: 8, fuelBonus: 12 },
  { block: 5, waves: '55+', hpMul: 3.79, speedMul: 1.44, eliteBonus: 0.34, hollowBonus: 30, mirrorBonus: 5, webBonus: 10, fuelBonus: 15 },
];

export function endlessBlock(n) {
  const beyond = Math.max(0, n - 24);
  const block = Math.min(ENDLESS_TABLE.length - 1, Math.floor(beyond / 6));
  return ENDLESS_TABLE[block];
}

// Each night bends the baseline mix toward its own terrain. Night 1 is
// the baseline untouched; night 2 floods the arena with wisps and
// spitters at the cost of shades; nights 3+ send the hunters —
// stalkers, siphons and splitters. Shade never drops below 2, so the
// arena is never empty of its basic shadow.
export const NIGHT_COMPS = {
  4: { stalker: 5, siphon: 4, splitter: 4, webweaver: 1 },
  5: { hulk: 4, spitter: 4, siphon: 5, webweaver: 2, fuelmite: 3 },
  2: { wisp: 5, spitter: 3, shade: -4 },
  3: { stalker: 4, siphon: 3, splitter: 3 },
};

// Endless composition: what the dark sends once the campaign is over.
// Hollow Wisps arrive in a growing swarm from wave 25, and from wave 19
// the Mirror Wraiths and Lantern Thieves join a few at a time, one more
// pair every six waves. Counts only ever grow — the night never relents.
export function endlessComp(n) {
  const out = {};
  if(n>=19) out.webweaver=2+Math.floor((n-19)/6);
  if(n>=25) out.fuelmite=4+Math.floor((n-25)/3);
  if (Math.ceil(n / 6) >= 5) out.hollow = 8 + (n - 25) * 2;
  if (n >= 19) {
    const pair = 2 + Math.floor((n - 19) / 6);
    out.mirror = pair;
    out.thief = pair;
  }
  if (n >= 31) {
    const row = endlessBlock(n);
    out.webweaver += row.webBonus;
    out.fuelmite += row.fuelBonus;
  }
  return out;
}

Object.assign(ENEMIES,{webweaver:{name:'Webweaver',hp:42,speed:62,radius:14,score:180,damage:7,colour:'#d4c9ed',emberChance:.7,ranged:true,shootRange:350,shootCooldown:4,boltSpeed:150},fuelmite:{name:'Fuelmite',hp:18,speed:185,radius:10,score:90,damage:14,colour:'#ffe278',emberChance:.4,ranged:false,shootRange:0,shootCooldown:0,boltSpeed:0}});

export const BEAM = {
  length: 520,
  width: 26,
  baseDps: 30,
  mirrorHp: 40,
  baseBounces: 1,
  lengthPerPivot: 80,
  dpsPerGlass: 0.40,
  emberheartMul: 1.6,
};

export const MIRROR_SHOP_TIERS = {
  rack: { costs: [15, 25], maxLevel: 2 },
  glass: { costs: [12, 12, 12], maxLevel: 3 },
  pivot: { costs: [10, 10], maxLevel: 2 },
  cache: { cost: 30 },
};
