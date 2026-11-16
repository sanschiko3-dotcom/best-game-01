// SPDX-License-Identifier: MIT
// Persistent, validated Ember Vault. Storage denial leaves a playable session.
export const VAULT_KEY = 'lumenwarden-vault-v3';
export const VAULT_ITEMS = ['Heart +15 HP', 'Flare +10% damage', 'Dash −8% cooldown', 'Extra socket'];
export function loadVault(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(VAULT_KEY));
    return { bank: Math.max(0, Math.floor(Number(v.bank) || 0)), levels: [0,1,2,3].map(i => Math.min(i===3?1:10, Math.max(0, Math.floor(Number(v.levels?.[i]) || 0)))) };
  } catch { return { bank: 0, levels: [0,0,0,0] }; }
}
export function saveVault(v) { try { localStorage.setItem(VAULT_KEY, JSON.stringify(v)); } catch {} }
export function vaultCost(v, i) {
  return 10 * ((v.levels[i] || 0) + 1);
}
export function vaultMaxed(v, i) {
  return (v.levels[i] || 0) >= (i === 3 ? 1 : 10);
}
export function purchaseVault(v, i) {
  if (!Number.isInteger(i) || i<0 || i>3 || vaultMaxed(v, i)) return false;
  const cost = vaultCost(v, i);
  if(v.bank<cost) return false;
  v.bank-=cost; v.levels[i]++; saveVault(v); return true;
}
export function applyVault(v, p, braziers) {
  p.maxHp+=15*v.levels[0]; p.hp=p.maxHp;
  p.flareDamage*=1+0.1*v.levels[1]; p.dashDelay*=0.92**v.levels[2];
  if(v.levels[3]) braziers.push({x:640,y:240,radius:140,lit:false});
}
