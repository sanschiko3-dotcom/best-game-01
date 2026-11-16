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

export const WAVES_TOTAL = 18; // survive wave 10 and dawn breaks: you win
export const BOSS_WAVES = [6, 12, 18];
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
 stalker: {name:'Stalker',hp:38,speed:120,radius:14,damage:12,score:110,emberChance:0.8,colour:'#a3b3c9'},
 splitter: {name:'Splitter',hp:55,speed:65,radius:20,damage:12,score:140,emberChance:0.8,colour:'#67d8b3'},
 siphon: {name:'Siphon',hp:65,speed:90,radius:16,damage:8,score:160,emberChance:1,colour:'#e371cc'}
});

// Later nights replace the baseline with threats suited to their terrain.
export function waveComp(n, night = Math.min(3, Math.ceil(n / 6))) {
  const mix = baselineWaveComp(n);
  if (night === 1) return mix;
  if (night === 2) {
    mix.wisp = (mix.wisp || 0) + 5;
    mix.spitter = (mix.spitter || 0) + 3;
    mix.shade = Math.max(2, (mix.shade || 0) - 4);
  } else {
    mix.stalker = (mix.stalker || 0) + 4;
    mix.siphon = (mix.siphon || 0) + 3;
    mix.splitter = (mix.splitter || 0) + 3;
  }
  return mix;
}
