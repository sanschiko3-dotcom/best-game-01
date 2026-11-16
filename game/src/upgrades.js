// SPDX-License-Identifier: MIT
// LUMENWARDEN — upgrades.js
// One job: the three-choice reward offered after every cleared wave.
// Each upgrade is one clear decision (more light, more damage, more
// speed, cheaper burn...), applied to the player's fields, so the
// choice the player makes shapes the rest of the run.

export const UPGRADES = [
  {
    id: 'wide', name: 'Wide Glow', glyph: '◎',
    desc: '+30% lantern light radius. Your safe circle grows.',
    apply(p) { p.lightRadius *= 1.3; },
  },
  {
    id: 'bright', name: 'Bright Flare', glyph: '✦',
    desc: '+40% flare damage and +25% blast radius.',
    apply(p) { p.flareDamage *= 1.4; p.flareBlast *= 1.25; },
  },
  {
    id: 'swift', name: 'Swift Boots', glyph: '»',
    desc: '+15% move speed. Outrun the dark.',
    apply(p) { p.speedMul *= 1.15; },
  },
  {
    id: 'longburn', name: 'Long Burn', glyph: '◐',
    desc: 'Lantern fuel drains 25% slower.',
    apply(p) { p.fuelDrainMul *= 0.75; },
  },
  {
    id: 'magnet', name: 'Ember Magnet', glyph: '⌖',
    desc: '+70% ember pickup radius. Fuel finds you.',
    apply(p) { p.pickupMul *= 1.7; },
  },
  {
    id: 'wick', name: 'Thick Wick', glyph: '♥',
    desc: 'Restore 40 HP now and burn shadows 25% hotter.',
    apply(p) { p.hp = Math.min(100, p.hp + 40); p.burnDps *= 1.25; },
  },
  {
    id: 'twin', name: 'Twin Flare', glyph: '‡',
    desc: 'Every flare fires two bolts. (Once per run.)',
    once: true,
    apply(p) { p.twinFlare = true; },
  },
  {
    id: 'kindle', name: 'Kindled Heart', glyph: '♦',
    desc: '+30 fuel now and +15 max fuel for the rest of the night.',
    apply(p) { p.fuel = Math.min(100, p.fuel + 30); },
  },
];

export function rollChoices(rng, taken, count = 3) {
  const pool = UPGRADES.filter((u) => !(u.once && taken.has(u.id)));
  return rng.shuffle(pool).slice(0, Math.min(count, pool.length));
}
