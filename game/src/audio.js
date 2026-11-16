// LUMENWARDEN — audio.js
// One job: every sound in the game, synthesised with WebAudio.
// No audio files, no network: oscillators and noise buffers only.
// Everything is guarded so the game plays silently (never crashes)
// when audio is unavailable or the player has muted it.

let ctx = null;
let master = null;
let muted = false;
let droneNodes = null;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  startDrone();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  try {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* sound is never worth a crash */ }
}

function noise(dur, vol = 0.15, filterFreq = 1200, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  try {
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  } catch { /* sound is never worth a crash */ }
}

export const sfx = {
  dash() { noise(0.22, 0.18, 3500); tone(440, 0.18, 'sine', 0.1, 110); },
  nova() { noise(0.9, 0.3, 2200); tone(70, 0.8, 'triangle', 0.3, 25); },
  enrage() { tone(120, 0.6, 'sawtooth', 0.25, 45); tone(155, 0.5, 'square', 0.12); },
  shopBuy() { [660, 880, 1320].forEach((f,i) => tone(f, 0.2, 'sine', 0.14, null, i * 0.08)); },
  eliteSpawn() { tone(740, 0.35, 'triangle', 0.12, 370); },
  flare() { tone(880, 0.16, 'sine', 0.16, 220); noise(0.12, 0.08, 3200); },
  hit() { tone(220, 0.08, 'square', 0.1, 140); },
  kill() { tone(520, 0.18, 'triangle', 0.16, 90); noise(0.15, 0.1, 900); },
  pickup() { tone(660, 0.09, 'sine', 0.14, 990); },
  hurt() { tone(160, 0.25, 'sawtooth', 0.2, 60); noise(0.2, 0.12, 500); },
  brazier() { tone(330, 0.4, 'sine', 0.16, 660); tone(495, 0.5, 'sine', 0.1, 990, 0.08); },
  waveHorn() { tone(196, 0.7, 'triangle', 0.2, 196); tone(294, 0.7, 'triangle', 0.14, 294, 0.05); },
  bossRoar() { tone(98, 0.9, 'sawtooth', 0.22, 49); noise(0.8, 0.14, 300); },
  upgrade() { tone(523, 0.12, 'sine', 0.14); tone(659, 0.12, 'sine', 0.14, null, 0.1); tone(784, 0.22, 'sine', 0.16, null, 0.2); },
  victory() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, null, i * 0.16)); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16, null, i * 0.2)); },
  click() { tone(700, 0.05, 'sine', 0.1); },
};

// A low ambient drone under the whole game: two detuned sines plus a
// slow breathing gain, quiet enough to sit behind the effects.
function startDrone() {
  const c = ensure();
  if (!c || droneNodes || muted) return;
  try {
    const g = c.createGain();
    g.gain.value = 0.035;
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.7;
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(g.gain);
    o1.connect(g); o2.connect(g); g.connect(master);
    o1.start(); o2.start(); lfo.start();
    droneNodes = { o1, o2, lfo, g };
  } catch { droneNodes = null; }
}
